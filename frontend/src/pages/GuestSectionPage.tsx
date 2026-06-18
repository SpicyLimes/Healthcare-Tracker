import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { listGuestRecords } from "../api/guest";
import { useGuest } from "../auth/GuestContext";
import GuestLayout from "../components/GuestLayout";
import { formatInTimezone } from "@/lib/datetime";

type FoodRow = { id: string; type: "Acceptable" | "Unacceptable"; food_name: string };

function NutritionPlanGuest({ acceptable, unacceptable, error, loading }: {
  acceptable: FoodRow[];
  unacceptable: FoodRow[];
  error: string;
  loading: boolean;
}) {
  const [acceptableOpen, setAcceptableOpen] = useState(false);
  const [unacceptableOpen, setUnacceptableOpen] = useState(false);

  return (
    <GuestLayout>
      <h1 className="text-2xl font-semibold mb-4">Nutrition Plan</h1>
      {error && <p role="alert" className="text-destructive mb-4">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Acceptable Foods */}
          <div className="rounded-xl border border-border bg-card">
            <button
              className="flex w-full items-center justify-between px-4 py-4 text-left"
              onClick={() => setAcceptableOpen((o) => !o)}
              aria-expanded={acceptableOpen}
            >
              <span className="text-base font-semibold text-foreground">Acceptable Foods</span>
              {acceptableOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {acceptableOpen && (
              <div className="px-4 pb-4">
                {/* Mobile list */}
                <div className="md:hidden space-y-2">
                  {acceptable.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No acceptable foods added yet.</p>
                  ) : (
                    acceptable.map((f) => (
                      <div key={f.id} className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-foreground">
                        {f.food_name}
                      </div>
                    ))
                  )}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Food</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acceptable.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-xs text-muted-foreground">No acceptable foods added yet.</td>
                        </tr>
                      ) : (
                        acceptable.map((f) => (
                          <tr key={f.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 text-foreground">{f.food_name}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Unacceptable Foods */}
          <div className="rounded-xl border border-border bg-card">
            <button
              className="flex w-full items-center justify-between px-4 py-4 text-left"
              onClick={() => setUnacceptableOpen((o) => !o)}
              aria-expanded={unacceptableOpen}
            >
              <span className="text-base font-semibold text-foreground">Unacceptable Foods</span>
              {unacceptableOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {unacceptableOpen && (
              <div className="px-4 pb-4">
                {unacceptable.length === 0 ? (
                  <p className="text-xs text-muted-foreground col-span-2">No unacceptable foods added yet.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {unacceptable.map((f) => (
                      <div key={f.id} className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-foreground">
                        {f.food_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </GuestLayout>
  );
}

export default function GuestSectionPage() {
  const { section = "" } = useParams<{ section: string }>();
  const [searchParams] = useSearchParams();
  const { token } = useGuest();
  const rawToken = token || searchParams.get("token") || "";
  const [records, setRecords] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";

  // Timestamp fields that should be formatted with timezone
  const TIMESTAMP_KEYS = new Set([
    "measured_at", "appointment_datetime", "created_at", "updated_at",
  ]);

  // Date-like sort keys per section (used for default desc sort)
  const SECTION_DATE_KEY: Record<string, string> = {
    vitals: "measured_at",
    appointments: "appointment_datetime",
    visit_logs: "visit_date",
    vaccinations: "vaccination_date",
    hospitalizations: "admission_date",
    surgeries: "surgery_date",
    medications: "start_date",
    insurances: "start_date",
  };

  // Appointment type label map (mirrors AppointmentsPage)
  const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
    annual_checkup: "Annual Checkup",
    follow_up: "Follow-up",
    specialist: "Specialist",
    lab: "Lab/Blood Work",
    imaging: "Imaging",
    dental: "Dental",
    vision: "Vision",
    other: "Other",
  };

  // Medication kind label map (mirrors MedicationsPage)
  const MEDICATION_KIND_LABELS: Record<string, string> = {
    medication: "Medication",
    vitamin: "Vitamin",
    supplement: "Supplement",
  };

  function formatCellValue(key: string, value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (key === "appointment_type" && typeof value === "string") {
      return APPOINTMENT_TYPE_LABELS[value] ?? value;
    }
    if (key === "kind" && typeof value === "string") {
      return MEDICATION_KIND_LABELS[value] ?? value;
    }
    if (TIMESTAMP_KEYS.has(key) && typeof value === "string") {
      return formatInTimezone(value, tz);
    }
    return String(value);
  }

  useEffect(() => {
    if (!rawToken) { setExpired(true); return; }
    setLoading(true);
    listGuestRecords(section, rawToken)
      .then((rows) => {
        setRecords(rows);
        // Default sort: section's date key desc, fallback to created_at desc
        const defaultKey = SECTION_DATE_KEY[section] ?? "created_at";
        const firstRow = rows[0] as Record<string, unknown> | undefined;
        if (firstRow && defaultKey in firstRow) {
          setSortKey(defaultKey);
          setSortDir("desc");
        }
      })
      .catch((err: Error) => {
        if (err.message.includes("401") || err.message.includes("403")) setExpired(true);
        else setError("Failed to load records");
      })
      .finally(() => setLoading(false));
  }, [section, rawToken]);

  function handleSort(key: string) {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("asc");
      return key;
    });
  }

  const sortedRecords = sortKey
    ? [...(records as Record<string, unknown>[])].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : (records as Record<string, unknown>[]);

  // Sections whose list rows are not individually viewable (no detail endpoint)
  const NO_DETAIL_SECTIONS = new Set(["nutrition_plan"]);
  const hasDetail = !NO_DETAIL_SECTIONS.has(section);

  if (expired) return <GuestLayout expired>{null}</GuestLayout>;

  // Nutrition plan: custom two-column collapsible layout
  if (section === "nutrition_plan") {
    const foods = records as FoodRow[];
    const acceptable = foods.filter((f) => f.type === "Acceptable");
    const unacceptable = foods.filter((f) => f.type === "Unacceptable");
    return (
      <NutritionPlanGuest
        acceptable={acceptable}
        unacceptable={unacceptable}
        error={error}
        loading={loading}
      />
    );
  }

  const visibleKeys = sortedRecords.length > 0
    ? Object.keys(sortedRecords[0] as Record<string, unknown>)
        .filter((k) => k !== "id" && !k.endsWith("_id"))
        .slice(0, 4)
    : [];

  return (
    <GuestLayout>
      <h1 className="text-2xl font-semibold mb-4">
        {section.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
      </h1>
      {error && <p role="alert" className="text-destructive mb-4">{error}</p>}
      {sortedRecords.length === 0 ? (
        <p className="text-muted-foreground">No records found.</p>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {sortedRecords.map((row) => {
              const visibleEntries = Object.entries(row)
                .filter(([k]) => k !== "id" && !k.endsWith("_id"))
                .slice(0, 4);
              const headline = visibleEntries[0];
              const rest = visibleEntries.slice(1);
              return (
                <div key={String(row.id)} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      {headline && (
                        <p className="font-medium text-foreground truncate capitalize">
                          {formatCellValue(headline[0], headline[1])}
                        </p>
                      )}
                    </div>
                    {hasDetail && (
                      <Link
                        to={`/guest/sections/${section}/${row.id}`}
                        className="shrink-0 text-sm text-primary font-medium hover:underline underline-offset-4"
                      >
                        View
                      </Link>
                    )}
                  </div>
                  {rest.length > 0 && (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {rest.map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</dt>
                          <dd className="text-sm text-foreground truncate">
                            {formatCellValue(k, v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {hasDetail && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>}
                  {visibleKeys.map((k) => (
                    <th
                      key={k}
                      className="px-4 py-3 text-left font-medium text-muted-foreground capitalize cursor-pointer select-none hover:text-foreground"
                      onClick={() => handleSort(k)}
                    >
                      {k.replace(/_/g, " ")}
                      {sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((row) => (
                  <tr key={String(row.id)} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    {hasDetail && (
                      <td className="px-4 py-3">
                        <Link
                          to={`/guest/sections/${section}/${row.id}`}
                          className="text-primary font-medium hover:underline underline-offset-4"
                        >
                          View Record
                        </Link>
                      </td>
                    )}
                    {visibleKeys.map((k) => (
                      <td key={k} className="px-4 py-3 text-foreground">
                        {formatCellValue(k, row[k])}
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
