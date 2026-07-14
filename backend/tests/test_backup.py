"""Tests for backup.sh and restore.sh scripts."""
import gzip
import os
import shutil
import subprocess
from datetime import date, timedelta
from pathlib import Path

import pytest

BACKUP_SH = Path(__file__).parent.parent / "backup" / "backup.sh"
RESTORE_SH = Path(__file__).parent.parent / "backup" / "restore.sh"

TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://healthtracker:change-me-in-real-env@localhost:5432/healthtracker",
)
# pg_dump/psql use the libpq URL format (no driver prefix)
PG_URL = TEST_DB_URL.replace("postgresql+psycopg://", "postgresql://")


@pytest.fixture()
def backup_env(tmp_path):
    """Provide a temp /backups dir and a temp uploads dir for script runs."""
    backups_dir = tmp_path / "backups"
    uploads_dir = tmp_path / "uploads"
    backups_dir.mkdir()
    uploads_dir.mkdir()
    (uploads_dir / "sample.txt").write_text("test upload content")
    return backups_dir, uploads_dir


def _make_wrapper(tmp_path, backups_dir, uploads_dir, script_path):
    """Write a bash wrapper that patches hardcoded paths in the script via sed."""
    wrapper = tmp_path / f"wrapper_{script_path.stem}.sh"
    wrapper.write_text(
        f"""#!/usr/bin/env bash
set -euo pipefail
export DATABASE_URL="{PG_URL}"
sed 's|/backups|{backups_dir}|g; s|-C /app uploads|-C {uploads_dir.parent} uploads|g; s|/app/uploads|{uploads_dir}|g' {script_path} | bash
"""
    )
    wrapper.chmod(0o755)
    return wrapper


@pytest.mark.skipif(
    not shutil.which("pg_dump"),
    reason="pg_dump not available in this environment",
)
def test_backup_creates_expected_files(backup_env, tmp_path):
    """backup.sh creates db.sql.gz and uploads.tar.gz in a dated directory."""
    backups_dir, uploads_dir = backup_env
    today = date.today().strftime("%Y-%m-%d")

    wrapper = _make_wrapper(tmp_path, backups_dir, uploads_dir, BACKUP_SH)
    result = subprocess.run(["bash", str(wrapper)], capture_output=True, text=True)
    assert result.returncode == 0, f"backup.sh failed:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"

    dated_dir = backups_dir / today
    assert dated_dir.exists(), f"Expected backup dir {dated_dir} not created"
    assert (dated_dir / "db.sql.gz").exists(), "db.sql.gz not created"
    assert (dated_dir / "uploads.tar.gz").exists(), "uploads.tar.gz not created"

    with gzip.open(dated_dir / "db.sql.gz", "rb") as f:
        content = f.read()
    assert len(content) > 0, "db.sql.gz is empty"


@pytest.mark.skipif(
    not shutil.which("pg_dump"),
    reason="pg_dump not available in this environment",
)
def test_backup_prunes_old_directories(backup_env, tmp_path):
    """backup.sh deletes the oldest dirs when more than 7 exist."""
    backups_dir, uploads_dir = backup_env

    # Seed 8 dated directories (8 days ago through yesterday)
    today = date.today()
    seeded = []
    for i in range(1, 9):
        d = today - timedelta(days=i)
        name = d.strftime("%Y-%m-%d")
        (backups_dir / name).mkdir()
        seeded.append(name)

    wrapper = _make_wrapper(tmp_path, backups_dir, uploads_dir, BACKUP_SH)
    result = subprocess.run(["bash", str(wrapper)], capture_output=True, text=True)
    assert result.returncode == 0, f"backup.sh failed:\nSTDERR: {result.stderr}"

    # Today's backup dir + 6 of the 8 seeded = 7 total (oldest 2 pruned)
    remaining = sorted(d.name for d in backups_dir.iterdir() if d.is_dir())
    assert len(remaining) == 7, f"Expected 7 backup dirs, got {len(remaining)}: {remaining}"
    # The oldest seeded dir should have been pruned
    assert seeded[-1] not in remaining, f"Oldest dir {seeded[-1]} should have been pruned"


@pytest.mark.skipif(
    not shutil.which("pg_dump"),
    reason="pg_dump not available in this environment",
)
def test_backup_prunes_old_manual_but_never_uploaded(backup_env, tmp_path):
    """backup.sh deletes manual-/safety- dirs older than 7 days, keeps uploaded-."""
    backups_dir, uploads_dir = backup_env
    old_stamp = (date.today() - timedelta(days=10)).strftime("%Y-%m-%d")
    for prefix in ("manual", "safety", "uploaded"):
        d = backups_dir / f"{prefix}-{old_stamp}T020000"
        d.mkdir()
        ts = (date.today() - timedelta(days=10)).strftime("%Y%m%d0200")
        subprocess.run(["touch", "-t", ts, str(d)], check=True)

    wrapper = _make_wrapper(tmp_path, backups_dir, uploads_dir, BACKUP_SH)
    result = subprocess.run(["bash", str(wrapper)], capture_output=True, text=True)
    assert result.returncode == 0, f"backup.sh failed:\nSTDERR: {result.stderr}"

    remaining = {d.name for d in backups_dir.iterdir() if d.is_dir()}
    assert f"uploaded-{old_stamp}T020000" in remaining
    assert f"manual-{old_stamp}T020000" not in remaining
    assert f"safety-{old_stamp}T020000" not in remaining


@pytest.mark.skipif(
    not shutil.which("psql"),
    reason="psql not available in this environment",
)
def test_restore_script_requires_date_argument(tmp_path):
    """restore.sh exits non-zero with no date argument."""
    result = subprocess.run(
        ["bash", str(RESTORE_SH)],
        env={**os.environ, "DATABASE_URL": PG_URL},
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "usage" in result.stderr.lower()


@pytest.mark.skipif(
    not shutil.which("psql"),
    reason="psql not available in this environment",
)
def test_restore_script_errors_on_missing_backup(tmp_path):
    """restore.sh exits non-zero when the requested date directory doesn't exist."""
    result = subprocess.run(
        ["bash", str(RESTORE_SH), "1999-01-01"],
        env={**os.environ, "DATABASE_URL": PG_URL},
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "not found" in result.stderr.lower()
