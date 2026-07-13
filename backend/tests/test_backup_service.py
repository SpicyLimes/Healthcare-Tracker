# backend/tests/test_backup_service.py
"""backup_service: ids, listing, pruning, create/bundle/upload/restore (fakes only)."""
import gzip
import io
import os
import tarfile
from datetime import datetime, timedelta, timezone

import pytest

from app.services import backup_service as svc


def _fake_dump(libpq_url, out_path):
    with gzip.open(out_path, "wb") as f:
        f.write(b"-- fake dump\n")


def _mk(root, name, db=b"x", uploads=b"y"):
    d = root / name
    d.mkdir()
    if db is not None:
        (d / svc.DB_FILE).write_bytes(db)
    if uploads is not None:
        (d / svc.UPLOADS_FILE).write_bytes(uploads)
    return d


class TestIds:
    @pytest.mark.parametrize("bad", [
        "../etc", "2026-07-13/..", "foo", "manual-", "uploaded-2026-07-13",  # missing time
        "manual-2026-07-13T12:00:00", "safety-2026-07-13T1200", ".", "2026-7-1",
    ])
    def test_invalid_ids_rejected(self, bad):
        with pytest.raises(ValueError):
            svc.backup_dir(bad)

    @pytest.mark.parametrize("good", ["2026-07-13", "manual-2026-07-13T020000",
                                      "safety-2026-07-13T020000", "uploaded-2026-07-13T020000"])
    def test_valid_ids_resolve_under_root(self, good, tmp_backups_dir):
        p = svc.backup_dir(good)
        assert p.parent == tmp_backups_dir


class TestList:
    def test_lists_types_sizes_and_completeness(self, tmp_backups_dir):
        _mk(tmp_backups_dir, "2026-07-12", db=b"abc", uploads=b"de")
        _mk(tmp_backups_dir, "manual-2026-07-13T020000")
        _mk(tmp_backups_dir, "uploaded-2026-07-13T030000", uploads=None)  # incomplete
        (tmp_backups_dir / "stray-file.txt").write_text("ignored")
        (tmp_backups_dir / "not-a-backup").mkdir()  # ignored: bad name

        infos = {i.id: i for i in svc.list_backups()}
        assert set(infos) == {"2026-07-12", "manual-2026-07-13T020000", "uploaded-2026-07-13T030000"}
        assert infos["2026-07-12"].type == "nightly"
        assert infos["2026-07-12"].size_bytes == 5
        assert infos["2026-07-12"].complete is True
        assert infos["manual-2026-07-13T020000"].type == "manual"
        assert infos["uploaded-2026-07-13T030000"].complete is False

    def test_empty_root(self, tmp_backups_dir):
        assert svc.list_backups() == []


class TestPrune:
    def test_keeps_newest_seven_nightlies(self, tmp_backups_dir):
        for i in range(1, 10):
            _mk(tmp_backups_dir, f"2026-07-{i:02d}")
        deleted = svc.prune_backups()
        assert sorted(deleted) == ["2026-07-01", "2026-07-02"]
        assert len(list(tmp_backups_dir.iterdir())) == 7

    def test_prunes_old_manual_and_safety_never_uploaded(self, tmp_backups_dir):
        old = _mk(tmp_backups_dir, "manual-2026-07-01T020000")
        old_s = _mk(tmp_backups_dir, "safety-2026-07-01T020000")
        old_u = _mk(tmp_backups_dir, "uploaded-2026-07-01T020000")
        new = _mk(tmp_backups_dir, "manual-2026-07-12T020000")
        stamp = (datetime.now(timezone.utc) - timedelta(days=10)).timestamp()
        for d in (old, old_s, old_u):
            os.utime(d, (stamp, stamp))

        deleted = svc.prune_backups()
        assert sorted(deleted) == ["manual-2026-07-01T020000", "safety-2026-07-01T020000"]
        assert old_u.exists() and new.exists()


class TestDelete:
    def test_delete_removes_dir(self, tmp_backups_dir):
        _mk(tmp_backups_dir, "uploaded-2026-07-13T020000")
        svc.delete_backup("uploaded-2026-07-13T020000")
        assert list(tmp_backups_dir.iterdir()) == []

    def test_delete_missing_raises(self, tmp_backups_dir):
        with pytest.raises(FileNotFoundError):
            svc.delete_backup("2026-01-01")


class TestCreate:
    def test_creates_manual_backup(self, tmp_backups_dir, tmp_uploads_dir):
        (tmp_uploads_dir / "doc.pdf").write_bytes(b"pdf")
        info = svc.create_backup("manual", dump_runner=_fake_dump)
        assert info.type == "manual" and info.complete
        d = tmp_backups_dir / info.id
        assert (d / svc.DB_FILE).is_file() and (d / svc.UPLOADS_FILE).is_file()
        # uploads tar has the uploads/ top-level dir (backup.sh-compatible)
        with tarfile.open(d / svc.UPLOADS_FILE) as tar:
            assert "uploads/doc.pdf" in tar.getnames()

    def test_failure_cleans_up_dir(self, tmp_backups_dir, tmp_uploads_dir):
        def boom(url, path):
            raise RuntimeError("pg_dump failed")
        with pytest.raises(RuntimeError):
            svc.create_backup("manual", dump_runner=boom)
        assert list(tmp_backups_dir.iterdir()) == []

    def test_rejects_unknown_kind(self, tmp_backups_dir):
        with pytest.raises(ValueError):
            svc.create_backup("uploaded", dump_runner=_fake_dump)


def test_libpq_url_strips_driver(monkeypatch):
    import app.config as app_config
    monkeypatch.setattr(app_config.settings, "database_url",
                        "postgresql+psycopg://u:p@db:5432/health")
    assert svc._libpq_url() == "postgresql://u:p@db:5432/health"


def _combined_tar_bytes(members=None):
    """Build an in-memory combined tar. members: dict name -> bytes."""
    if members is None:
        members = {svc.DB_FILE: b"gzdb", svc.UPLOADS_FILE: b"gzup"}
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w") as tar:
        for name, data in members.items():
            ti = tarfile.TarInfo(name=name)
            ti.size = len(data)
            tar.addfile(ti, io.BytesIO(data))
    buf.seek(0)
    return buf


class TestDownloadBundle:
    def test_round_trip(self, tmp_backups_dir):
        _mk(tmp_backups_dir, "2026-07-12", db=b"dbdata", uploads=b"updata")
        path = svc.build_download_tar("2026-07-12")
        try:
            with tarfile.open(path) as tar:
                assert sorted(tar.getnames()) == [svc.DB_FILE, svc.UPLOADS_FILE]
                assert tar.extractfile(svc.DB_FILE).read() == b"dbdata"
        finally:
            path.unlink()

    def test_incomplete_backup_raises(self, tmp_backups_dir):
        _mk(tmp_backups_dir, "2026-07-12", uploads=None)
        with pytest.raises(FileNotFoundError):
            svc.build_download_tar("2026-07-12")


class TestUpload:
    def test_valid_upload_stored(self, tmp_backups_dir):
        info = svc.store_uploaded_tar(_combined_tar_bytes())
        assert info.type == "uploaded" and info.complete
        d = tmp_backups_dir / info.id
        assert (d / svc.DB_FILE).read_bytes() == b"gzdb"

    def test_rejects_wrong_members(self, tmp_backups_dir):
        with pytest.raises(ValueError):
            svc.store_uploaded_tar(_combined_tar_bytes({svc.DB_FILE: b"x", "evil.sh": b"y"}))
        with pytest.raises(ValueError):
            svc.store_uploaded_tar(_combined_tar_bytes({svc.DB_FILE: b"x"}))  # missing uploads
        assert list(tmp_backups_dir.iterdir()) == []

    def test_rejects_path_traversal_member(self, tmp_backups_dir):
        with pytest.raises(ValueError):
            svc.store_uploaded_tar(_combined_tar_bytes({"../db.sql.gz": b"x", svc.UPLOADS_FILE: b"y"}))
        assert list(tmp_backups_dir.iterdir()) == []

    def test_rejects_non_tar(self, tmp_backups_dir):
        with pytest.raises(ValueError):
            svc.store_uploaded_tar(io.BytesIO(b"this is not a tar file"))
        assert list(tmp_backups_dir.iterdir()) == []

    def test_rejects_symlink_member(self, tmp_backups_dir):
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w") as tar:
            ti = tarfile.TarInfo(name=svc.DB_FILE)
            ti.type = tarfile.SYMTYPE
            ti.linkname = "/etc/passwd"
            tar.addfile(ti)
            ti2 = tarfile.TarInfo(name=svc.UPLOADS_FILE)
            ti2.size = 1
            tar.addfile(ti2, io.BytesIO(b"y"))
        buf.seek(0)
        with pytest.raises(ValueError):
            svc.store_uploaded_tar(buf)
        assert list(tmp_backups_dir.iterdir()) == []
