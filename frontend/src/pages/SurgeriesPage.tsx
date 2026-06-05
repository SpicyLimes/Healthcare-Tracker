import { useEffect, useState, type FormEvent } from "react";
import { surgeriesApi, type Surgery, type SurgeryInput } from "../api/surgeries";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";

export default function SurgeriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Surgery[]>([]);
  const [form, setForm] = useState<SurgeryInput>({ procedure: "" });
  const [error, setError] = useState("");

  async function reload() { setRows(await surgeriesApi.list()); }
  useEffect(() => { reload().catch(() => setError("Failed to load surgeries")); }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await surgeriesApi.create(form);
      setForm({ procedure: "" });
      await reload();
    } catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await surgeriesApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  return (
    <section style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Surgery Records</h1>
      {error && <p role="alert">{error}</p>}
      {isAdmin && (
        <form onSubmit={onAdd} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Procedure<input required value={form.procedure} onChange={(e) => setForm((s) => ({ ...s, procedure: e.target.value }))} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Date<input type="date" value={form.surgery_date ?? ""} onChange={(e) => setForm((s) => ({ ...s, surgery_date: e.target.value || null }))} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Surgeon
            <DoctorPicker
              doctorId={form.surgeon_id ?? null}
              doctorOther={form.surgeon_other ?? null}
              onChange={(id, other) => setForm((s) => ({ ...s, surgeon_id: id, surgeon_other: other }))}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Hospital<input value={form.hospital ?? ""} onChange={(e) => setForm((s) => ({ ...s, hospital: e.target.value || null }))} />
          </label>
          <button type="submit" style={{ alignSelf: "flex-end" }}>Add</button>
        </form>
      )}
      <table>
        <thead><tr><th>Procedure</th><th>Date</th><th>Hospital</th>{isAdmin && <th />}<th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.procedure}</td>
              <td>{r.surgery_date ?? ""}</td>
              <td>{r.hospital ?? ""}</td>
              {isAdmin && <td><button onClick={() => onDelete(r.id)}>Delete</button></td>}
              <td><DocumentsPanel section="surgeries" recordId={r.id} isAdmin={isAdmin} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
