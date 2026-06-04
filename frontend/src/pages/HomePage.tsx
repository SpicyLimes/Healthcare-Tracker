import { useEffect, useState } from "react";
import { fetchHealth, type HealthStatus } from "../api/health";
import { useAuth } from "../auth/useAuth";
import { Link } from "react-router-dom";

export default function HomePage() {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Healthcare Tracker</h1>
      <p>Signed in as {user?.email} ({user?.role})</p>
      {health && <p>Backend: {health.status} — Database: {health.database}</p>}
      <nav style={{ display: "flex", gap: "1rem" }}>
        <Link to="/profile">Profile</Link>
        <Link to="/medications">Medications</Link>
        <Link to="/doctors">Doctors</Link>
        <Link to="/ailments">Ailment history</Link>
        <Link to="/change-password">Change password</Link>
        {user?.role === "admin" && <Link to="/users">Manage users</Link>}
        <button onClick={logout}>Log out</button>
      </nav>
    </main>
  );
}
