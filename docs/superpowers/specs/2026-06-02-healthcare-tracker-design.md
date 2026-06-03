# Healthcare Tracker — Design Spec

**Date:** 2026-06-02
**Status:** Approved design, pending implementation plan

## Purpose

A private, self-hosted web application for managing an aging parent's medical
records as a primary caregiver. The owner (admin) enters and maintains all
records; immediate family members (e.g., aunts) get read-only access to stay
informed; doctors and specialists get scoped, time-limited access to relevant
records, with the option to be upgraded to a permanent read-only account.

This replaces ad-hoc paper/file organization with a single secure system. A
physical medical journal remains the offline fallback, so offline/local access
is **not** a requirement for this app.

## Users & Roles

| Role | Who | Capabilities |
|---|---|---|
| **Admin** | The caregiver (owner) | Full read/write/delete on all records; manage users; generate and revoke share links; view audit log |
| **Viewer** | Immediate family; doctors with permanent accounts | Read-only across all sections; no editing, no deleting |
| **Guest** | Doctors accessing via share link | Time-limited, read-only, optionally scoped to specific sections; no login/account required |

### Access flow for doctors

1. Admin generates a **time-limited shareable link** from the admin panel.
2. Admin sets the expiry (e.g., 7 days, 30 days, or a custom date) and optionally
   restricts which sections the link exposes (e.g., a cardiologist sees only
   Medications + Visit Logs).
3. The link carries a cryptographically signed token with a hard expiry; no
   account creation needed.
4. If a doctor later requests ongoing access, the admin promotes them to a
   permanent **Viewer** account (same access level as immediate family).

## Architecture

A Docker Compose stack of four containers, managed via the owner's existing
Portainer setup, following the same pattern as their current OpenWebUI stack.

| Container | Role |
|---|---|
| `frontend` | React single-page app served via Nginx |
| `backend` | FastAPI (Python) REST API |
| `db` | PostgreSQL |
| `cloudflared` | Cloudflare Tunnel connector |

### Stack rationale

- **React** — modern, responsive UI that works well in mobile browsers (useful at
  appointments).
- **FastAPI (Python)** — fast to build, excellent file handling, clean REST API,
  and leaves the door open to later AI-assisted features (e.g., visit-note
  summarization) given Python's AI ecosystem.
- **PostgreSQL** — solid for structured health data and document metadata.
- **Nginx** — reverse proxy/routing between frontend and backend within the stack.
- **Docker Compose** — single stack, drops directly into Portainer.

This mirrors the proven stack of MediKeep (React + FastAPI + PostgreSQL + Docker)
but is built from scratch to this exact spec, after the existing self-hosted
options (Fasten OnPrem, Mere Medical, MediKeep, HolyFHIR, LibreHealth EHR) were
evaluated and each fell short on multi-user roles, document upload, the specific
section set, or Docker support.

### Network & exposure

- Exposed at a dedicated subdomain (e.g., `healthcare.spicylimeslabs.com`) **only**
  through the existing Cloudflare Tunnel. No inbound ports are opened on the host.
  (The current `ai.spicylimeslabs.com` tunnel can be repurposed/reconfigured for
  this subdomain.)

## Sections & Data Model

Top-level sections (each is a record type with create/edit/delete for admin and
read for viewers/scoped guests):

| Section | Key Fields |
|---|---|
| **Profile Snapshot** | Name, DOB, blood type, allergies, emergency contacts, primary language |
| **Insurance & Pharmacy** | Insurer name, policy/group #, contact, pharmacy name, address, phone, Rx #s |
| **Doctors & Specialists** | Name, specialty, practice, phone, fax, address, patient portal URL, notes |
| **Family Health History** | Relative, condition, age of onset, notes |
| **Surgery Records** | Procedure, date, surgeon, hospital, outcome, documents |
| **Hospitalization / ER Records** | Date, facility, reason, attending physician, outcome, documents |
| **Vision History** | Date, provider, Rx (OD/OS), notes, documents |
| **Dental History** | Date, provider, procedure, notes, documents |
| **Vaccination Records** | Vaccine, date, lot #, administrator, next due date |
| **Medications, Vitamins & Supplements** | Name, dose, frequency, prescribing doctor, start/end date, active status |
| **Ailment History** | Condition, onset date, status (active/resolved), treating doctor, notes |
| **Doctor's Office Visit Logs** | Date, doctor, reason, summary, follow-up actions, documents |
| **Appointments** | Date/time, doctor, location, reason, status (upcoming/completed/cancelled) |
| **Documents** | Any uploaded file (PDF, Word, Excel, plain text, image), tagged to a section/record |

**Appointments** is included to support tracking upcoming visits, a core need from
the caregiving context.

## Document Handling

- **Storage:** Files saved to a Docker volume (`/app/uploads`); the database stores
  only metadata (filename, type, size, upload date, owning section/record). Keeps
  the DB lean and backups simple.
- **Attachment model:** Each document links to a section and optionally a specific
  record (e.g., a lab PDF on a specific Visit Log). The global **Documents**
  section provides a single view of everything uploaded.
- **Access:** Documents inherit their section's permissions. A guest link scoped to
  Visit Logs only can open documents attached to visit logs and nothing else.
- **Preview:** PDFs and images preview in-browser; Office files offer a download
  link.

## Security

Defense in depth, appropriate for protected health information (PHI):

1. **Cloudflare Tunnel** — no open inbound ports; the only path in is via
   Cloudflare's edge. Reuses the owner's existing tunnel.
2. **Cloudflare Access (mandatory)** — email OTP gate in front of the app's own
   login. **Already enabled** on the existing tunnel; will be reused/reconfigured
   for this subdomain rather than set up from scratch.
3. **App authentication** — JWT-based sessions, bcrypt-hashed passwords, enforced
   strong passwords.
4. **Signed expiring tokens** — guest share links use cryptographically signed
   tokens with hard expiry dates and optional section scoping.
5. **Encryption at rest** — PostgreSQL and uploads volumes live on the owner's
   server; app-level field encryption for the most sensitive fields is available
   as an option (decision deferred to implementation).
6. **Audit log** — every record view/edit and every share-link access is logged
   (who, what, when), including which doctor accessed what via a share link.

## Testing

- **Backend:** `pytest` covering API endpoints, authentication, role/permission
  enforcement, and token expiry.
- **Frontend:** Vitest + React Testing Library for key user flows.
- Built incrementally with tests alongside features.

## Backups

- A scheduled nightly job dumps PostgreSQL and archives the uploads volume to a
  destination the owner chooses (local path, or pushed to their NextCloud/another
  server).
- Restore is a documented, single-command process.

## Out of Scope (YAGNI)

- Offline/PWA support — physical journal is the offline fallback.
- Direct EHR/provider auto-sync (FHIR/Smart-on-FHIR pull) — all data is entered or
  uploaded manually by the admin.
- Billing, clinical workflows, SOAP notes — this is a caregiver tracker, not a
  clinical EHR.

## Infrastructure Notes (owner-provided)

- Owner runs Cloudflare with an existing tunnel and Cloudflare Access already
  configured (`ai.spicylimeslabs.com` currently fronts an OpenWebUI Docker stack
  with a `cloudflared` container, managed in Portainer on a LAN server). This
  tunnel/subdomain can be repurposed to `healthcare.spicylimeslabs.com` for this
  app.
- Access to this app is handled entirely by the Cloudflare Tunnel plus Cloudflare
  Access; Tailscale is **not** part of this project's access model.
- Owner also has JaguarPC reseller hosting and an existing NextCloud instance, but
  the Docker + Cloudflare Tunnel path on the LAN server was chosen over those.
