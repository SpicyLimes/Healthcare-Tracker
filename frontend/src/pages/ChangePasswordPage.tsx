import { useState, type FormEvent } from "react";
import { changePassword } from "../api/auth";

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      await changePassword(current, next);
      setMessage("Password changed.");
      setCurrent("");
      setNext("");
    } catch {
      setMessage("Could not change password.");
    }
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 360 }}>
      <h1>Change password</h1>
      <form onSubmit={onSubmit}>
        <label>
          Current password
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </label>
        <label>
          New password (min 12 chars)
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={12} />
        </label>
        {message && <p role="status">{message}</p>}
        <button type="submit">Update</button>
      </form>
    </main>
  );
}
