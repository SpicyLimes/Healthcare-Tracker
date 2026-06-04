import { useEffect, useState, type FormEvent } from "react";
import { visionHistoryApi, type VisionHistory, type VisionHistoryInput } from "../api/visionHistory";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";

export default function VisionHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<VisionHistory[]>([]);
  const [form, setForm] = useState<VisionHistoryInput>({});
  const [error, setError] = useState("");

  async function reload() { setRows(await visionHistoryApi.list()); }
  useEffect(() => { reload().catch(() => setError("Failed to load vision history")); }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await visionHistoryApi.create(form); setForm({}); await reload(); }
    catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await visionHistoryApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  return (
    <section style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Vision History</h1>
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
            OD (right)<input value={form.rx_od ?? ""} onChange={(e) => setForm((s) => ({ ...s, rx_od: e.target.value || null }))} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            OS (left)<input value={form.rx_os ?? ""} onChange={(e) => setForm((s) => ({ ...s, rx_os: e.target.value || null }))} />
          </label>
          <button type="submit" style={{ alignSelf: "flex-end" }}>Add</button>
        </form>
      )}
      <table>
        <thead><tr><th>Date</th><th>OD</th><th>OS</th>{isAdmin && <th />}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.visit_date ?? ""}</td><td>{r.rx_od ?? ""}</td><td>{r.rx_os ?? ""}</td>
              {isAdmin && <td><button onClick={() => onDelete(r.id)}>Delete</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
