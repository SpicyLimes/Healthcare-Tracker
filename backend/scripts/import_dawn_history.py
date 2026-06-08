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
from pathlib import Path

import requests
import yaml

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
    """Create each doctor; return a map of YAML `key` -> created doctor UUID string."""
    key_to_id: dict[str, str] = {}
    for doc in doctors:
        payload = {k: v for k, v in doc.items() if k != "key"}
        if dry_run:
            print(f"[DRY RUN] POST /api/doctors {payload}")
            key_to_id[doc["key"]] = f"dry-run-{doc['key']}"
            continue
        created = api_post(session, base_url, csrf, "/api/doctors", payload)
        key_to_id[doc["key"]] = created["id"]
        print(f"Created doctor '{created['name']}' -> {created['id']}")
    return key_to_id


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--data", required=True, type=Path)
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    email = os.environ.get("HT_EMAIL")
    password = os.environ.get("HT_PASSWORD")
    if not email or not password:
        print("Set HT_EMAIL and HT_PASSWORD environment variables before running", file=sys.stderr)
        return 2

    data = yaml.safe_load(args.data.read_text())

    session = requests.Session()
    csrf = login(session, args.base_url, email, password)
    print(f"Logged in as {email}; csrf token acquired")

    doctor_ids = create_doctors(session, args.base_url, csrf, data.get("doctors", []), args.dry_run)
    print(f"Doctor key->id map ({len(doctor_ids)} entries): {doctor_ids}")

    if args.dry_run:
        print(f"[DRY RUN] Would import {len(data.get('records', []))} records")
        return 0

    print("Record import not yet implemented")
    return 1


if __name__ == "__main__":
    sys.exit(main())
