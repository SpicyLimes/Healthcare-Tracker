# backend/app/services/backup_service.py
"""Filesystem/subprocess service behind the admin Backups page.

Operates on settings.backups_root (the /backups volume shared with the
backup container). Dangerous operations (pg_dump, psql, DROP DATABASE,
alembic) are injectable so tests never touch the real test database.
"""
import gzip
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.config import settings

# Nightly cron dirs (YYYY-MM-DD) or app-created <kind>-<UTC stamp> dirs
BACKUP_ID_RE = re.compile(
    r"^(\d{4}-\d{2}-\d{2}|(manual|safety|uploaded)-\d{4}-\d{2}-\d{2}T\d{6})$"
)
_NIGHTLY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

DB_FILE = "db.sql.gz"
UPLOADS_FILE = "uploads.tar.gz"
KEEP_NIGHTLY = 7          # matches backup.sh's count-based prune
PRUNE_AGE = timedelta(days=7)
_SUBPROCESS_TIMEOUT = 600


@dataclass
class BackupInfo:
    id: str
    type: str  # nightly | manual | safety | uploaded
    created_at: datetime
    size_bytes: int
    complete: bool


def _root() -> Path:
    return Path(settings.backups_root)


def backup_dir(backup_id: str) -> Path:
    """Validate an id against the strict grammar and resolve it under the root."""
    if not BACKUP_ID_RE.match(backup_id):
        raise ValueError(f"Invalid backup id: {backup_id!r}")
    return _root() / backup_id


def _type_of(name: str) -> str:
    for prefix in ("manual", "safety", "uploaded"):
        if name.startswith(prefix + "-"):
            return prefix
    return "nightly"


def _info(d: Path) -> BackupInfo:
    files = [d / DB_FILE, d / UPLOADS_FILE]
    return BackupInfo(
        id=d.name,
        type=_type_of(d.name),
        created_at=datetime.fromtimestamp(d.stat().st_mtime, tz=timezone.utc),
        size_bytes=sum(f.stat().st_size for f in files if f.is_file()),
        complete=all(f.is_file() for f in files),
    )


def list_backups() -> list[BackupInfo]:
    root = _root()
    if not root.is_dir():
        return []
    infos = [_info(d) for d in root.iterdir() if d.is_dir() and BACKUP_ID_RE.match(d.name)]
    infos.sort(key=lambda i: i.created_at, reverse=True)
    return infos


def prune_backups(now: datetime | None = None) -> list[str]:
    """Nightlies: keep the newest KEEP_NIGHTLY (by name). manual-/safety-:
    delete when older than PRUNE_AGE (mtime). uploaded-: never auto-pruned."""
    now = now or datetime.now(timezone.utc)
    root = _root()
    if not root.is_dir():
        return []
    deleted: list[str] = []
    nightly = sorted(
        (d for d in root.iterdir() if d.is_dir() and _NIGHTLY_RE.match(d.name)),
        key=lambda d: d.name,
    )
    excess = nightly[:-KEEP_NIGHTLY] if len(nightly) > KEEP_NIGHTLY else []
    for d in excess:
        shutil.rmtree(d)
        deleted.append(d.name)
    for d in root.iterdir():
        if (
            d.is_dir()
            and d.name.startswith(("manual-", "safety-"))
            and BACKUP_ID_RE.match(d.name)
            and now - datetime.fromtimestamp(d.stat().st_mtime, tz=timezone.utc) > PRUNE_AGE
        ):
            shutil.rmtree(d)
            deleted.append(d.name)
    return deleted


def delete_backup(backup_id: str) -> None:
    d = backup_dir(backup_id)
    if not d.is_dir():
        raise FileNotFoundError(f"Backup not found: {backup_id}")
    shutil.rmtree(d)


def _libpq_url() -> str:
    # pg_dump/psql need a plain libpq URL (no SQLAlchemy driver suffix)
    return re.sub(r"^postgresql\+[^:]+://", "postgresql://", settings.database_url)


def run_pg_dump(libpq_url: str, out_path: Path) -> None:
    """Stream pg_dump output through gzip to out_path."""
    proc = subprocess.Popen(["pg_dump", libpq_url], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert proc.stdout is not None
    with gzip.open(out_path, "wb") as gz:
        shutil.copyfileobj(proc.stdout, gz)
    _, stderr = proc.communicate(timeout=_SUBPROCESS_TIMEOUT)
    if proc.returncode != 0:
        out_path.unlink(missing_ok=True)
        raise RuntimeError(f"pg_dump failed: {stderr.decode(errors='replace')[:500]}")


def create_backup(kind: str, *, dump_runner=None) -> BackupInfo:
    # Resolve at call time so tests can monkeypatch backup_service.run_pg_dump
    dump_runner = dump_runner or run_pg_dump
    if kind not in ("manual", "safety"):
        raise ValueError(f"Invalid backup kind: {kind!r}")
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%S")
    dest = _root() / f"{kind}-{stamp}"
    if dest.exists():
        raise RuntimeError("A backup with this timestamp already exists; retry in a second")
    dest.mkdir(parents=True)
    try:
        dump_runner(_libpq_url(), dest / DB_FILE)
        with tarfile.open(dest / UPLOADS_FILE, "w:gz") as tar:
            tar.add(settings.uploads_root, arcname="uploads")
        prune_backups()
    except Exception:
        shutil.rmtree(dest, ignore_errors=True)
        raise
    return _info(dest)


def build_download_tar(backup_id: str) -> Path:
    """Bundle a backup's two files into one uncompressed temp tar (members are
    already gzipped). Caller is responsible for deleting the returned path."""
    src = backup_dir(backup_id)
    if not (src / DB_FILE).is_file() or not (src / UPLOADS_FILE).is_file():
        raise FileNotFoundError(f"Backup not found or incomplete: {backup_id}")
    fd, tmp = tempfile.mkstemp(suffix=".tar")
    os.close(fd)
    try:
        with tarfile.open(tmp, "w") as tar:
            tar.add(src / DB_FILE, arcname=DB_FILE)
            tar.add(src / UPLOADS_FILE, arcname=UPLOADS_FILE)
    except Exception:
        os.unlink(tmp)
        raise
    return Path(tmp)


def store_uploaded_tar(fileobj) -> BackupInfo:
    """Validate and unpack an uploaded combined tar into uploaded-<ts>/."""
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%S")
    dest = _root() / f"uploaded-{stamp}"
    if dest.exists():
        raise RuntimeError("An upload with this timestamp already exists; retry in a second")
    fd, tmp = tempfile.mkstemp(suffix=".tar")
    try:
        with os.fdopen(fd, "wb") as out:
            shutil.copyfileobj(fileobj, out)
        try:
            tar = tarfile.open(tmp, "r:*")
        except tarfile.TarError:
            raise ValueError("Not a valid backup archive (expected the downloaded .tar)")
        with tar:
            members = tar.getmembers()
            names = sorted(m.name for m in members)
            if names != sorted([DB_FILE, UPLOADS_FILE]):
                raise ValueError(f"Archive must contain exactly {DB_FILE} and {UPLOADS_FILE}")
            if not all(m.isreg() for m in members):
                raise ValueError("Archive contains non-regular files")
            dest.mkdir(parents=True)
            try:
                # filter='data' additionally strips suid/dev/symlink tricks
                tar.extractall(dest, filter="data")
            except Exception:
                shutil.rmtree(dest, ignore_errors=True)
                raise
    finally:
        os.unlink(tmp)
    return _info(dest)
