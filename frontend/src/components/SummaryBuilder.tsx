import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  generateSummary, generateGuestSummary, openSummaryInNewTab, type SummaryRequest,
} from "../api/summary";

const SECTION_LABELS: Record<string, string> = {
  doctors: "Doctors", medications: "Medications", ailments: "Ailment History",
  surgeries: "Procedures", hospitalizations: "Hospitalizations", vision_history: "Vision History",
  dental_history: "Dental History", visit_logs: "Visit & Call Logs", vitals: "Vitals", appointments: "Appointments",
  vaccinations: "Vaccinations", insurances: "Insurance", pharmacies: "Pharmacies",
  family_history: "Family History", nutrition_plan: "Nutrition Plan", profile: "Profile",
};

interface Props {
  mode: "admin" | "guest";
  availableSections: string[];
  token?: string;
  description?: string;
  triggerClassName?: string;
}

export default function SummaryBuilder({ mode, availableSections, token, description, triggerClassName }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [preparedFor, setPreparedFor] = useState("");
  const [includeHeader, setIncludeHeader] = useState(true);
  const [allTime, setAllTime] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setError("");
  }

  function toggle(section: string) {
    setSelected((cur) =>
      cur.includes(section) ? cur.filter((s) => s !== section) : [...cur, section],
    );
  }

  async function handleGenerate() {
    setBusy(true);
    setError("");
    const req: SummaryRequest = {
      sections: selected,
      include_patient_header: includeHeader,
      prepared_for: preparedFor || null,
      date_from: allTime ? null : dateFrom || null,
      date_to: allTime ? null : dateTo || null,
    };
    try {
      const html =
        mode === "guest"
          ? await generateGuestSummary(req, token ?? "")
          : await generateSummary(req);
      openSummaryInNewTab(html);
    } catch {
      setError("Could not generate the summary. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="flex flex-col items-end gap-1">
        <DialogTrigger asChild>
          <Button variant={triggerClassName ? undefined : "outline"} size="sm" className={triggerClassName}>Patient Summary</Button>
        </DialogTrigger>
        {description && (
          <p className="max-w-xs text-right text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <DialogContent>
        <DialogTitle>Build a Summary</DialogTitle>
        <DialogDescription>
          Select the sections to include, then generate a printable page.
        </DialogDescription>

        <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Checkbox
              checked={selected.length === availableSections.length}
              onChange={() =>
                setSelected(
                  selected.length === availableSections.length ? [] : [...availableSections],
                )
              }
            />
            All Records
          </label>
          <div className="border-t border-border pt-1 space-y-2">
            {availableSections.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={selected.includes(s)}
                  onChange={() => toggle(s)}
                />
                {SECTION_LABELS[s] ?? s}
              </label>
            ))}
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
          <Checkbox checked={includeHeader} onChange={() => setIncludeHeader((v) => !v)} />
          Show name &amp; DOB in header
        </label>

        <input
          className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          aria-label="Prepared for"
          placeholder="Prepared for (optional)"
          value={preparedFor}
          onChange={(e) => setPreparedFor(e.target.value)}
        />

        <fieldset className="mt-3">
          <legend className="text-xs text-muted-foreground mb-1">
            Date range — filters records by when they were added
          </legend>
          <label className="flex items-center gap-2 text-sm text-foreground mb-2">
            <Checkbox
              checked={allTime}
              onChange={() => {
                setAllTime((v) => {
                  if (!v) { setDateFrom(""); setDateTo(""); }
                  return !v;
                });
              }}
            />
            All time
          </label>
          {!allTime && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                aria-label="From date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">to</span>
              <input
                type="date"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                aria-label="To date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          )}
        </fieldset>

        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}

        <div className="mt-5 flex justify-end">
          <Button onClick={handleGenerate} disabled={busy || selected.length === 0}>
            {busy ? "Generating…" : "Generate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
