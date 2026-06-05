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
      <nav style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link to="/profile">Profile</Link>
        <Link to="/medications">Medications</Link>
        <Link to="/doctors">Doctors</Link>
        <Link to="/ailments">Ailment history</Link>
        <Link to="/insurance">Insurance</Link>
        <Link to="/pharmacies">Pharmacies</Link>
        <Link to="/family-history">Family history</Link>
        <Link to="/surgeries">Surgeries</Link>
        <Link to="/hospitalizations">Hospitalizations</Link>
        <Link to="/vision-history">Vision history</Link>
        <Link to="/dental-history">Dental history</Link>
        <Link to="/vaccinations">Vaccinations</Link>
        <Link to="/visit-logs">Visit logs</Link>
        <Link to="/appointments">Appointments</Link>
        <Link to="/documents">Documents</Link>
        <Link to="/change-password">Change password</Link>
        {user?.role === "admin" && <Link to="/share-links">Share Links</Link>}
        {user?.role === "admin" && <Link to="/audit-log">Audit Log</Link>}
        {user?.role === "admin" && <Link to="/users">Manage users</Link>}
        <button onClick={logout}>Log out</button>
      </nav>
    </main>
  );
}
