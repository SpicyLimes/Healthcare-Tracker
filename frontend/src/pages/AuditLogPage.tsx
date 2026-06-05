// frontend/src/pages/AuditLogPage.tsx
import { useEffect, useState } from "react";
import { listAuditLog, type AuditLogEntry, type AuditLogFilters } from "../api/auditLog";

const ACTIONS = ["create", "update", "delete", "share_link_access"];

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1 });

  useEffect(() => {
    listAuditLog(filters)
      .then(setEntries)
      .catch(() => setError("Failed to load audit log"));
  }, [filters]);

  function set(key: keyof AuditLogFilters, value: string) {
    setFilters((f) => ({ ...f, [key]: value || undefined, page: 1 }));
  }

  return (
    <section style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Audit Log</h1>
      {error && <p role="alert" style={{ color: "red" }}>{error}</p>}

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
          Action
          <select onChange={(e) => set("action", e.target.value)}>
            <option value="">All</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
          Actor type
          <select onChange={(e) => set("actor_type", e.target.value)}>
            <option value="">All</option>
            <option value="user">Users</option>
            <option value="guest">Guests</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
          From
          <input type="date" onChange={(e) => set("date_from", e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
          To
          <input type="date" onChange={(e) => set("date_to", e.target.value)} />
        </label>
      </div>

      {entries.length === 0 ? (
        <p>No entries found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left", paddingRight: "1rem" }}>Timestamp</th>
              <th style={{ textAlign: "left", paddingRight: "1rem" }}>Actor</th>
              <th style={{ textAlign: "left", paddingRight: "1rem" }}>Action</th>
              <th style={{ textAlign: "left", paddingRight: "1rem" }}>Section</th>
              <th style={{ textAlign: "left", paddingRight: "1rem" }}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td style={{ paddingRight: "1rem" }}>{new Date(e.timestamp).toLocaleString()}</td>
                <td style={{ paddingRight: "1rem" }}>{e.actor_label}</td>
                <td style={{ paddingRight: "1rem" }}>{e.action}</td>
                <td style={{ paddingRight: "1rem" }}>{e.section ?? ""}</td>
                <td style={{ paddingRight: "1rem" }}>{e.detail ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        <button
          disabled={(filters.page ?? 1) <= 1}
          onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
        >
          Previous
        </button>
        <span>Page {filters.page ?? 1}</span>
        <button
          disabled={entries.length < 50}
          onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
        >
          Next
        </button>
      </div>
    </section>
  );
}
