import { useEffect, useState, type FormEvent } from "react";
import { dentalHistoryApi, type DentalHistory, type DentalHistoryInput } from "../api/dentalHistory";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";

export default function DentalHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<DentalHistory[]>([]);
  const [form, setForm] = useState<DentalHistoryInput>({});
  const [error, setError] = useState("");

  async function reload() { setRows(await dentalHistoryApi.list()); }
  useEffect(() => { reload().catch(() => setError("Failed to load dental history")); }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await dentalHistoryApi.create(form); setForm({}); await reload(); }
    catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await dentalHistoryApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  return (
    <section style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Dental History</h1>
      {error && <p role="alert">{error}</p>}
      {isAdmin && (
        <form onSubmit={onAdd} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Date<input type="date" value={form.visit_date ?? ""} onChange={(e) => setForm((s) => ({ ...s, visit_date: e.target.value || null }))} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Provider
            <DoctorPicker
              doctorId={form.provider_id ?? null}
              doctorOther={form.provider_other ?? null}
              onChange={(id, other) => setForm((s) => ({ ...s, provider_id: id, provider_other: other }))}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Procedure<input value={form.procedure ?? ""} onChange={(e) => setForm((s) => ({ ...s, procedure: e.target.value || null }))} />
          </label>
          <button type="submit" style={{ alignSelf: "flex-end" }}>Add</button>
        </form>
      )}
      <table>
        <thead><tr><th>Date</th><th>Procedure</th>{isAdmin && <th />}<th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.visit_date ?? ""}</td><td>{r.procedure ?? ""}</td>
              {isAdmin && <td><button onClick={() => onDelete(r.id)}>Delete</button></td>}
              <td><DocumentsPanel section="dental_history" recordId={r.id} isAdmin={isAdmin} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
