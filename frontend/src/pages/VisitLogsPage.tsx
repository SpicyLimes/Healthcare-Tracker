import { useEffect, useState, type FormEvent } from "react";
import { visitLogsApi, type VisitLog, type VisitLogInput } from "../api/visitLogs";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";

export default function VisitLogsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<VisitLog[]>([]);
  const [form, setForm] = useState<VisitLogInput>({});
  const [error, setError] = useState("");

  async function reload() { setRows(await visitLogsApi.list()); }
  useEffect(() => { reload().catch(() => setError("Failed to load visit logs")); }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await visitLogsApi.create(form); setForm({}); await reload(); }
    catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await visitLogsApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  return (
    <section style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Visit Logs</h1>
      {error && <p role="alert">{error}</p>}
      {isAdmin && (
        <form onSubmit={onAdd} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Date<input type="date" value={form.visit_date ?? ""} onChange={(e) => setForm((s) => ({ ...s, visit_date: e.target.value || null }))} />
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
          <button type="submit" style={{ alignSelf: "flex-end" }}>Add</button>
        </form>
      )}
      <table>
        <thead><tr><th>Date</th><th>Reason</th><th>Summary</th>{isAdmin && <th />}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.visit_date ?? ""}</td><td>{r.reason ?? ""}</td><td>{r.summary ?? ""}</td>
              {isAdmin && <td><button onClick={() => onDelete(r.id)}>Delete</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
