import { useEffect, useState } from "react";
import { fetchHealth, type HealthStatus } from "./api/health";

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setErrored(true));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Healthcare Tracker</h1>
      {errored ? (
        <p>Backend: unreachable</p>
      ) : health ? (
        <p>
          Backend: {health.status} — Database: {health.database}
        </p>
      ) : (
        <p>Checking backend…</p>
      )}
    </main>
  );
}
