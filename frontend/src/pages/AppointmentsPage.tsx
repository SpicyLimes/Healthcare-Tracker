import { useEffect, useState, type FormEvent } from "react";
import { appointmentsApi, type Appointment, type AppointmentInput, type AppointmentStatus } from "../api/appointments";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";

const STATUSES: AppointmentStatus[] = ["upcoming", "completed", "cancelled", "rescheduled"];

export default function AppointmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Appointment[]>([]);
  const [form, setForm] = useState<AppointmentInput>({ appointment_datetime: "", status: "upcoming" });
  const [error, setError] = useState("");

  async function reload() { setRows(await appointmentsApi.list()); }
  useEffect(() => { reload().catch(() => setError("Failed to load appointments")); }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await appointmentsApi.create(form); setForm({ appointment_datetime: "", status: "upcoming" }); await reload(); }
    catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await appointmentsApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  return (
    <section style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Appointments</h1>
      {error && <p role="alert">{error}</p>}
      {isAdmin && (
        <form onSubmit={onAdd} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Date/time<input required type="datetime-local" value={form.appointment_datetime} onChange={(e) => setForm((s) => ({ ...s, appointment_datetime: e.target.value }))} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Doctor
            <DoctorPicker
              doctorId={form.doctor_id ?? null}
              doctorOther={form.doctor_other ?? null}
              onChange={(id, other) => setForm((s) => ({ ...s, doctor_id: id, doctor_other: other }))}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Reason<input value={form.reason ?? ""} onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value || null }))} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Status
            <select value={form.status ?? "upcoming"} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as AppointmentStatus }))}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <button type="submit" style={{ alignSelf: "flex-end" }}>Add</button>
        </form>
      )}
      <table>
        <thead><tr><th>Date/time</th><th>Reason</th><th>Status</th>{isAdmin && <th />}<th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.appointment_datetime}</td><td>{r.reason ?? ""}</td><td>{r.status}</td>
              {isAdmin && <td><button onClick={() => onDelete(r.id)}>Delete</button></td>}
              <td><DocumentsPanel section="appointments" recordId={r.id} isAdmin={isAdmin} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
