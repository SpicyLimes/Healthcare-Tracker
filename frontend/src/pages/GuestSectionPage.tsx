import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { listGuestRecords } from "../api/guest";
import { useGuest } from "../auth/GuestContext";
import GuestLayout from "../components/GuestLayout";

export default function GuestSectionPage() {
  const { section = "" } = useParams<{ section: string }>();
  const [searchParams] = useSearchParams();
  const { token } = useGuest();
  const rawToken = token || searchParams.get("token") || "";
  const [records, setRecords] = useState<unknown[]>([]);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!rawToken) { setExpired(true); return; }
    listGuestRecords(section, rawToken)
      .then(setRecords)
      .catch((err: Error) => {
        if (err.message.includes("401") || err.message.includes("403")) setExpired(true);
        else setError("Failed to load records");
      });
  }, [section, rawToken]);

  if (expired) return <GuestLayout expired>{null}</GuestLayout>;

  return (
    <GuestLayout>
      <h1 style={{ textTransform: "capitalize" }}>{section.replace(/_/g, " ")}</h1>
      {error && <p role="alert">{error}</p>}
      {records.length === 0 ? (
        <p>No records found.</p>
      ) : (
        <table>
          <tbody>
            {(records as Record<string, unknown>[]).map((row) => (
              <tr key={String(row.id)}>
                <td style={{ paddingRight: "1rem" }}>
                  <Link to={`/guest/sections/${section}/${row.id}`}>
                    View record
                  </Link>
                </td>
                {Object.entries(row)
                  .filter(([k]) => k !== "id")
                  .slice(0, 4)
                  .map(([k, v]) => (
                    <td key={k} style={{ paddingRight: "1rem" }}>
                      {v === null || v === undefined ? "" : String(v)}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </GuestLayout>
  );
}
