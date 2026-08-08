// frontend/src/components/DoctorRelatedPanel.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRelatedRecords, type RelatedGroup } from "../api/doctors";
import { sectionLabel, sectionRoute } from "@/lib/section-labels";
import { formatDate } from "@/lib/format";

/**
 * Every record linked to a doctor, grouped by the clinical role they played.
 *
 * A doctor used to be contact details and nothing else, so "what has this
 * doctor prescribed, treated, and operated on?" meant opening eight pages and
 * scanning each for the name — even though the role-typed FKs already knew.
 *
 * The role headings carry the meaning: "Surgeon (1)" and "Prescriber (4)" say
 * something that one merged list of five records would destroy.
 */
export default function DoctorRelatedPanel({ doctorId }: { doctorId: string }) {
  const [groups, setGroups] = useState<RelatedGroup[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setGroups(null);
    setError("");
    getRelatedRecords(doctorId)
      .then((g) => { if (!cancelled) setGroups(g); })
      .catch(() => { if (!cancelled) setError("Could not load related records"); });
    return () => { cancelled = true; };
  }, [doctorId]);

  if (error) {
    return <p role="alert" className="text-sm text-destructive">{error}</p>;
  }
  if (groups === null) {
    return <p className="text-sm text-muted-foreground">Loading related records…</p>;
  }

  const total = groups.reduce((n, g) => n + g.count, 0);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Related Records</h3>
        <p className="text-xs text-muted-foreground">
          {total === 0
            ? "Nothing is linked to this doctor yet."
            : `${total} linked record${total === 1 ? "" : "s"}, by role.`}
        </p>
      </div>

      {groups.length > 0 && (
        <div className="flex flex-col gap-3">
          {groups.map((g) => {
            const route = sectionRoute(g.section);
            return (
              <div key={`${g.role}-${g.section}`} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {g.role}{" "}
                    <span className="text-muted-foreground">
                      {/* Section labels are plural ("Procedures", "Visit & Call
                          Logs"), so pairing one with a count of 1 reads wrong.
                          The bare count is correct at any number. */}
                      ({g.count})
                    </span>
                  </p>
                  {route && (
                    <Link
                      to={route}
                      className="shrink-0 text-xs text-primary underline-offset-2 hover:underline"
                    >
                      Open {sectionLabel(g.section)}
                    </Link>
                  )}
                </div>
                {g.items.length > 0 && (
                  <ul className="mt-1 list-none flex flex-col gap-0.5">
                    {g.items.map((it) => (
                      <li key={it.id} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-foreground truncate">{it.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {it.date ? formatDate(it.date) : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
