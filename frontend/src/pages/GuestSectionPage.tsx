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
      <h1 className="text-2xl font-semibold capitalize mb-4">{section.replace(/_/g, " ")}</h1>
      {error && <p role="alert" className="text-destructive mb-4">{error}</p>}
      {records.length === 0 ? (
        <p className="text-muted-foreground">No records found.</p>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {(records as Record<string, unknown>[]).map((row) => {
              const visibleEntries = Object.entries(row)
                .filter(([k]) => k !== "id" && !k.endsWith("_id"))
                .slice(0, 4)
              const headline = visibleEntries[0]
              const rest = visibleEntries.slice(1)
              return (
                <div key={String(row.id)} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      {headline && (
                        <p className="font-medium text-foreground truncate capitalize">
                          {headline[1] === null || headline[1] === undefined ? "—" : String(headline[1])}
                        </p>
                      )}
                    </div>
                    <Link
                      to={`/guest/sections/${section}/${row.id}`}
                      className="shrink-0 text-sm text-primary font-medium hover:underline underline-offset-4"
                    >
                      View
                    </Link>
                  </div>
                  {rest.length > 0 && (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {rest.map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</dt>
                          <dd className="text-sm text-foreground truncate">
                            {v === null || v === undefined ? "—" : String(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                  {Object.keys((records as Record<string, unknown>[])[0])
                    .filter((k) => k !== "id" && !k.endsWith("_id"))
                    .slice(0, 4)
                    .map((k) => (
                      <th key={k} className="px-4 py-3 text-left font-medium text-muted-foreground capitalize">
                        {k.replace(/_/g, " ")}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {(records as Record<string, unknown>[]).map((row) => (
                  <tr key={String(row.id)} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/guest/sections/${section}/${row.id}`}
                        className="text-primary font-medium hover:underline underline-offset-4"
                      >
                        View Record
                      </Link>
                    </td>
                    {Object.entries(row)
                      .filter(([k]) => k !== "id" && !k.endsWith("_id"))
                      .slice(0, 4)
                      .map(([k, v]) => (
                        <td key={k} className="px-4 py-3 text-foreground">
                          {v === null || v === undefined ? "" : String(v)}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </GuestLayout>
  );
}
