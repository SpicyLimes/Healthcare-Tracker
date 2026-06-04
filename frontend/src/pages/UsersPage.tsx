import { useEffect, useState, type FormEvent } from "react";
import { createUser, deleteUser, listUsers, type ManagedUser } from "../api/users";

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "viewer">("viewer");
  const [error, setError] = useState("");

  async function reload() {
    setUsers(await listUsers());
  }

  useEffect(() => {
    reload().catch(() => setError("Failed to load users"));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await createUser(email, password, role);
      setEmail("");
      setPassword("");
      await reload();
    } catch {
      setError("Could not create user");
    }
  }

  async function onDelete(id: string) {
    setError("");
    try {
      await deleteUser(id);
      await reload();
    } catch {
      setError("Could not delete user");
    }
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Manage users</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={onCreate} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="initial password" value={password}
               onChange={(e) => setPassword(e.target.value)} required minLength={12} />
        <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "viewer")}>
          <option value="viewer">viewer</option>
          <option value="admin">admin</option>
        </select>
        <button type="submit">Add user</button>
      </form>
      <ul>
        {users.map((u) => (
          <li key={u.id}>
            {u.email} — {u.role} {u.is_active ? "" : "(inactive)"}
            <button onClick={() => onDelete(u.id)} style={{ marginLeft: "0.5rem" }}>Delete</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
