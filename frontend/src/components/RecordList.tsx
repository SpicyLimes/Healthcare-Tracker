import { useEffect, useState, type FormEvent } from "react";

export interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

export interface Field {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
}

interface RecordApi<T, TInput = Record<string, string>> {
  list: () => Promise<T[]>;
  create: (input: TInput) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

interface RecordListProps<T extends { id: string }, TInput = Record<string, string>> {
  title: string;
  api: RecordApi<T, TInput>;
  columns: Column<T>[];
  fields: Field[];
  isAdmin: boolean;
}

export default function RecordList<T extends { id: string }, TInput = Record<string, string>>({
  title,
  api,
  columns,
  fields,
  isAdmin,
}: RecordListProps<T, TInput>) {
  const [rows, setRows] = useState<T[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function reload() {
    setRows(await api.list());
  }

  useEffect(() => {
    reload().catch(() => setError(`Failed to load ${title.toLowerCase()}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== ""),
      ) as Record<string, string>;
      await api.create(payload as TInput);
      setForm({});
      await reload();
    } catch {
      setError("Could not add record");
    }
  }

  async function onDelete(id: string) {
    setError("");
    try {
      await api.remove(id);
      await reload();
    } catch {
      setError("Could not delete record");
    }
  }

  return (
    <section style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>{title}</h1>
      {error && <p role="alert">{error}</p>}
      {isAdmin && (
        <form onSubmit={onAdd} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          {fields.map((f) => (
            <label key={f.name} style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
              {f.label}
              <input
                type={f.type ?? "text"}
                required={f.required}
                value={form[f.name] ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
              />
            </label>
          ))}
          <button type="submit" style={{ alignSelf: "flex-end" }}>Add</button>
        </form>
      )}
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header} style={{ textAlign: "left", paddingRight: "1rem" }}>{c.header}</th>
            ))}
            {isAdmin && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.header} style={{ paddingRight: "1rem" }}>{c.render(row)}</td>
              ))}
              {isAdmin && (
                <td>
                  <button onClick={() => onDelete(row.id)}>Delete</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
