#!/usr/bin/env python3
"""One-off import of Dawn's medical history into Healthcare Tracker.

Credentials are read from environment variables (never pass passwords as
CLI args — they end up in shell history and process listings):
    HT_EMAIL, HT_PASSWORD

Usage:
    HT_EMAIL=devinrauch@icloud.com HT_PASSWORD='...' \
    python -m scripts.import_dawn_history \
        --base-url http://192.168.50.126:1337 \
        --data docs/project/dawn-history-import-data.yaml \
        --source-dir "/path/to/Documents-to-Upload" \
        [--dry-run]
"""
import argparse
import os
import sys
import tempfile
from pathlib import Path

import requests
import yaml
from pypdf import PdfReader, PdfWriter

# Top-level YAML keys that hold lists of clinical records (everything other
# than `doctors`, which is reported separately, and non-record metadata keys
# like `source_files` and `profile_update`).
RECORD_LIST_KEYS = [
    "vaccinations",
    "dental_history",
    "vision_history",
    "surgeries",
    "hospitalizations",
    "visit_logs",
    "insurance",
    "ailments",
    "medications",
]

# Config-table mapping each YAML list key to:
#   (endpoint path, url prefix used for /api/{prefix}/{id}/documents,
#    ref_field_pair_or_None, type_label)
# `ref_field_pair` is (yaml_field_holding_doctor_key, json_field_for_resolved_uuid)
# or None if the section has no doctor reference at all.
RECORD_SECTIONS: list[tuple[str, str, str, tuple[str, str] | None, str]] = [
    ("vaccinations", "/api/vaccinations", "vaccinations", None, "vaccination"),
    ("dental_history", "/api/dental-history", "dental-history", ("provider_ref", "provider_id"), "dental history entry"),
    ("vision_history", "/api/vision-history", "vision-history", ("provider_ref", "provider_id"), "vision history entry"),
    ("surgeries", "/api/surgeries", "surgeries", ("surgeon_ref", "surgeon_id"), "surgery"),
    ("hospitalizations", "/api/hospitalizations", "hospitalizations", None, "hospitalization"),
    ("visit_logs", "/api/visit-logs", "visit-logs", ("doctor_ref", "doctor_id"), "visit log"),
    ("insurance", "/api/insurances", "insurances", None, "insurance record"),
    ("ailments", "/api/ailments", "ailments", None, "ailment"),
    ("medications", "/api/medications", "medications", None, "medication"),
]

# Keys that should never be copied into a Create payload — `_ref` fields are
# resolved separately (or dropped if unresolved/no map), and `attachments`
# is metadata for the upload step, not a schema field.
NON_PAYLOAD_SUFFIXES = ("_ref",)
NON_PAYLOAD_KEYS = ("attachments", "existing_id")


def login(session: requests.Session, base_url: str, email: str, password: str) -> str:
    resp = session.post(f"{base_url}/api/auth/login", json={"email": email, "password": password})
    resp.raise_for_status()
    csrf = session.cookies.get("csrf_token")
    if not csrf:
        raise RuntimeError("Login succeeded but no csrf_token cookie was set")
    return csrf


def summarize(data: dict) -> None:
    """Print a per-record-type count summary for a dry run."""
    doctors = len(data.get("doctors", []))
    print(f"[DRY RUN] Would import {doctors} doctors")

    total_records = 0
    for key in RECORD_LIST_KEYS:
        count = len(data.get(key, []))
        total_records += count
        print(f"[DRY RUN]   {key}: {count}")

    attachments = len(data.get("profile_document_attachments", []))
    print(f"[DRY RUN]   profile_document_attachments: {attachments}")

    print(f"[DRY RUN] Total clinical records across all types: {total_records}")


def api_post(session: requests.Session, base_url: str, csrf: str, path: str, json: dict) -> dict:
    resp = session.post(f"{base_url}{path}", json=json, headers={"X-CSRF-Token": csrf})
    resp.raise_for_status()
    return resp.json()


def create_doctors(session, base_url, csrf, doctors: list[dict], dry_run: bool) -> dict[str, str]:
    """Create each doctor; return a map of YAML `key` -> created doctor UUID string.

    Doctors with `existing_doctor_id` set already exist in the live app
    (Dawn entered them manually with richer data) — reuse that ID instead
    of creating a duplicate.
    """
    key_to_id: dict[str, str] = {}
    for doc in doctors:
        existing_id = doc.get("existing_doctor_id")
        if existing_id:
            key_to_id[doc["key"]] = existing_id
            print(f"Reusing existing doctor '{doc['name']}' -> {existing_id}")
            continue
        payload = {k: v for k, v in doc.items() if k not in ("key", "existing_doctor_id")}
        if dry_run:
            print(f"[DRY RUN] POST /api/doctors {payload}")
            key_to_id[doc["key"]] = f"dry-run-{doc['key']}"
            continue
        created = api_post(session, base_url, csrf, "/api/doctors", payload)
        key_to_id[doc["key"]] = created["id"]
        print(f"Created doctor '{created['name']}' -> {created['id']}")
    return key_to_id


def parse_page_range(pages: str) -> tuple[int, int]:
    """Parse a 1-indexed inclusive page-range string like "1-5" into (start, end)."""
    start_str, _, end_str = pages.partition("-")
    start = int(start_str.strip())
    end = int(end_str.strip()) if end_str.strip() else start
    return start, end


def split_pdf_pages(source_path: Path, pages: str) -> Path:
    """Extract a 1-indexed inclusive page range from `source_path` into a temp
    PDF file; returns the temp file's path. Caller is responsible for cleanup."""
    start, end = parse_page_range(pages)
    reader = PdfReader(source_path)
    writer = PdfWriter()
    for i in range(start - 1, end):
        writer.add_page(reader.pages[i])
    fd, tmp_name = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    tmp_path = Path(tmp_name)
    with open(tmp_path, "wb") as f:
        writer.write(f)
    return tmp_path


def attach_document(session, base_url, csrf, prefix: str, record_id: str, file_path: Path, original_name: str) -> dict:
    """Upload `file_path` as a document attached to `prefix`/{record_id}. Returns the created document JSON."""
    with open(file_path, "rb") as f:
        resp = session.post(
            f"{base_url}/api/{prefix}/{record_id}/documents",
            files={"file": (original_name, f, "application/pdf")},
            headers={"X-CSRF-Token": csrf},
        )
    resp.raise_for_status()
    return resp.json()


def build_payload(record: dict, ref_pair: tuple[str, str] | None, doctor_ids: dict[str, str]) -> dict:
    """Build a JSON payload for a Create schema from a YAML record dict.

    Strips `*_ref` fields, `attachments`, and resolves the configured doctor
    reference (if present on this record) to a UUID via `doctor_ids`.
    """
    payload = {
        k: v
        for k, v in record.items()
        if k not in NON_PAYLOAD_KEYS and not k.endswith(NON_PAYLOAD_SUFFIXES)
    }
    if ref_pair:
        ref_field, id_field = ref_pair
        ref_key = record.get(ref_field)
        if ref_key:
            payload[id_field] = doctor_ids[ref_key]
    return payload


def process_attachments(
    session,
    base_url,
    csrf,
    prefix: str,
    type_label: str,
    record_id: str,
    attachments: list[dict],
    files_map: dict[str, str],
    source_dir: Path,
) -> int:
    """Split (if needed) and upload each attachment to the given record. Returns count uploaded."""
    count = 0
    for att in attachments:
        file_key = att["file"]
        filename = files_map[file_key]
        source_path = source_dir / filename
        pages = att.get("pages")
        if pages:
            tmp_path = split_pdf_pages(source_path, pages)
            try:
                start, end = parse_page_range(pages)
                upload_name = f"{Path(filename).stem}_pages_{start}-{end}.pdf"
                doc = attach_document(session, base_url, csrf, prefix, record_id, tmp_path, upload_name)
            finally:
                tmp_path.unlink(missing_ok=True)
        else:
            doc = attach_document(session, base_url, csrf, prefix, record_id, source_path, filename)
        print(f"Attached '{doc.get('filename', filename)}' to {type_label} {record_id}")
        count += 1
    return count


def create_record_section(
    session,
    base_url,
    csrf,
    items: list[dict],
    endpoint: str,
    ref_pair: tuple[str, str] | None,
    type_label: str,
    prefix: str,
    doctor_ids: dict[str, str],
    files_map: dict[str, str],
    source_dir: Path,
    dry_run: bool,
    skip_attachments: bool = False,
) -> tuple[int, int]:
    """Create every record in `items` (POST `endpoint`), then process its
    `attachments` (if any). Returns (records_created, documents_attached)."""
    created_count = 0
    attached_count = 0
    for record in items:
        existing_id = record.get("existing_id")
        if existing_id:
            print(f"Skipping {type_label} (existing_id={existing_id[:8]}...) — already live")
            created_count += 1
            continue

        payload = build_payload(record, ref_pair, doctor_ids)
        attachments = record.get("attachments") or []

        if dry_run:
            print(f"[DRY RUN] POST {endpoint} {payload}")
            for att in attachments:
                file_key = att["file"]
                filename = files_map.get(file_key, file_key)
                pages = att.get("pages")
                pages_desc = pages if pages else "whole file"
                skip_note = " [SKIPPED - --skip-attachments]" if skip_attachments else ""
                print(f"[DRY RUN]   then attach {filename} {pages_desc} to created {type_label}{skip_note}")
            created_count += 1
            attached_count += len(attachments)
            continue

        created = api_post(session, base_url, csrf, endpoint, payload)
        record_id = created["id"]
        print(f"Created {type_label} -> {record_id}")
        created_count += 1

        if attachments and not skip_attachments:
            attached_count += process_attachments(
                session, base_url, csrf, prefix, type_label, record_id, attachments, files_map, source_dir
            )
        elif attachments and skip_attachments:
            print(f"  Skipping {len(attachments)} attachment(s) for {type_label} {record_id} (--skip-attachments)")

    return created_count, attached_count


def attach_profile_documents(session, base_url, csrf, profile_id: str, attachments: list[dict], files_map: dict[str, str], source_dir: Path) -> int:
    count = 0
    for att in attachments:
        file_key = att["file"]
        filename = files_map[file_key]
        source_path = source_dir / filename
        doc = attach_document(session, base_url, csrf, "profile", profile_id, source_path, filename)
        print(f"Attached '{doc.get('filename', filename)}' to profile {profile_id}")
        count += 1
    return count


def update_profile_allergies(profile: dict, allergies_append: str) -> str:
    existing = (profile.get("allergies") or "").strip()
    if existing:
        return f"{existing}\n{allergies_append}"
    return allergies_append


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--data", required=True, type=Path)
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--skip-sections",
        default="",
        help="Comma-separated YAML section keys to skip (e.g. doctors,vaccinations,dental_history)",
    )
    parser.add_argument(
        "--skip-attachments",
        action="store_true",
        help="Skip all document attachment uploads (useful when proxy upload limit is not yet raised)",
    )
    args = parser.parse_args()

    email = os.environ.get("HT_EMAIL")
    password = os.environ.get("HT_PASSWORD")
    if not email or not password:
        print("Set HT_EMAIL and HT_PASSWORD environment variables before running", file=sys.stderr)
        return 2

    skip_sections = {s.strip() for s in args.skip_sections.split(",") if s.strip()}
    skip_attachments = args.skip_attachments

    data = yaml.safe_load(args.data.read_text())

    session = requests.Session()
    csrf = login(session, args.base_url, email, password)
    print(f"Logged in as {email}; csrf token acquired")

    if "doctors" in skip_sections:
        print("Skipping doctor creation (--skip-sections includes 'doctors'); resolving existing IDs from YAML")
        doctor_ids = {d["key"]: d["existing_doctor_id"] for d in data.get("doctors", []) if "existing_doctor_id" in d}
    else:
        doctor_ids = create_doctors(session, args.base_url, csrf, data.get("doctors", []), args.dry_run)
    print(f"Doctor key->id map ({len(doctor_ids)} entries): {doctor_ids}")

    files_map: dict[str, str] = data.get("source_files", {}).get("files", {})
    source_dir: Path = args.source_dir

    total_records = 0
    total_attached = 0

    for yaml_key, endpoint, prefix, ref_pair, type_label in RECORD_SECTIONS:
        if yaml_key in skip_sections:
            print(f"Skipping section '{yaml_key}' (--skip-sections)")
            continue
        items = data.get(yaml_key, [])
        if not items:
            continue
        created, attached = create_record_section(
            session, args.base_url, csrf, items, endpoint, ref_pair, type_label,
            prefix, doctor_ids, files_map, source_dir, args.dry_run,
            skip_attachments=skip_attachments,
        )
        total_records += created
        total_attached += attached

    # ---- Profile: document attachments + allergy update ----
    profile_resp = session.get(f"{args.base_url}/api/profile", headers={"X-CSRF-Token": csrf})
    profile_resp.raise_for_status()
    profile = profile_resp.json()
    profile_id = profile["id"]

    profile_attachments = data.get("profile_document_attachments", [])
    if profile_attachments:
        if args.dry_run:
            for att in profile_attachments:
                file_key = att["file"]
                filename = files_map.get(file_key, file_key)
                skip_note = " [SKIPPED - --skip-attachments]" if skip_attachments else ""
                print(f"[DRY RUN]   then attach {filename} whole file to profile {profile_id}{skip_note}")
            total_attached += len(profile_attachments)
        elif skip_attachments:
            print(f"Skipping {len(profile_attachments)} profile attachment(s) (--skip-attachments)")
        else:
            total_attached += attach_profile_documents(
                session, args.base_url, csrf, profile_id, profile_attachments, files_map, source_dir
            )

    profile_update = data.get("profile_update") or {}
    allergies_append = profile_update.get("allergies_append")
    profile_updated = False
    if allergies_append:
        new_allergies = update_profile_allergies(profile, allergies_append)
        if args.dry_run:
            print(f"[DRY RUN] Would append to profile allergies. Resulting text:\n{new_allergies}")
        else:
            put_payload = {
                "full_name": profile["full_name"],
                "date_of_birth": profile.get("date_of_birth"),
                "blood_type": profile.get("blood_type"),
                "allergies": new_allergies,
                "emergency_contacts": profile.get("emergency_contacts"),
                "primary_language": profile.get("primary_language"),
                "height": profile.get("height"),
                "weight": profile.get("weight"),
                "phone": profile.get("phone"),
                "notes": profile.get("notes"),
            }
            put_resp = session.put(
                f"{args.base_url}/api/profile", json=put_payload, headers={"X-CSRF-Token": csrf}
            )
            put_resp.raise_for_status()
            print("Updated profile allergies")
            profile_updated = True

    if args.dry_run:
        print(f"[DRY RUN] Would create {total_records} records and attach {total_attached} documents.")
        return 0

    summary = f"Done. Created {len(doctor_ids)} doctors and {total_records} clinical records, attached {total_attached} documents"
    summary += ", updated profile allergies." if profile_updated else "."
    print(summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
