import { useEffect, useState, type FormEvent } from "react";
import { hospitalizationsApi, type Hospitalization, type HospitalizationInput } from "../api/hospitalizations";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";

export default function HospitalizationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Hospitalization[]>([]);
  const [form, setForm] = useState<HospitalizationInput>({ facility: "" });
  const [error, setError] = useState("");

  async function reload() { setRows(await hospitalizationsApi.list()); }
  useEffect(() => { reload().catch(() => setError("Failed to load hospitalizations")); }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await hospitalizationsApi.create(form); setForm({ facility: "" }); await reload(); }
    catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await hospitalizationsApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  return (
    <section style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Hospitalizations</h1>
      {error && <p role="alert">{error}</p>}
      {isAdmin && (
        <form onSubmit={onAdd} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Facility<input required value={form.facility} onChange={(e) => setForm((s) => ({ ...s, facility: e.target.value }))} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Admission<input type="date" value={form.admission_date ?? ""} onChange={(e) => setForm((s) => ({ ...s, admission_date: e.target.value || null }))} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Discharge<input type="date" value={form.discharge_date ?? ""} onChange={(e) => setForm((s) => ({ ...s, discharge_date: e.target.value || null }))} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            Attending physician
            <DoctorPicker
              doctorId={form.attending_physician_id ?? null}
              doctorOther={form.attending_physician_other ?? null}
              onChange={(id, other) => setForm((s) => ({ ...s, attending_physician_id: id, attending_physician_other: other }))}
            />
          </label>
          <button type="submit" style={{ alignSelf: "flex-end" }}>Add</button>
        </form>
      )}
      <table>
        <thead><tr><th>Facility</th><th>Admission</th><th>Discharge</th>{isAdmin && <th />}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.facility}</td><td>{r.admission_date ?? ""}</td><td>{r.discharge_date ?? ""}</td>
              {isAdmin && <td><button onClick={() => onDelete(r.id)}>Delete</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
