import { useEffect, useState, type FormEvent } from "react";
import { vitalsApi, type Vitals, type VitalsInput } from "../api/vitals";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";
import { localToUtcIso, formatInTimezone } from "@/lib/datetime";
import { feetInchesToIn, inToFeetInches, formatHeight } from "@/lib/format";

// ─── helpers ────────────────────────────────────────────────────────────────

function num(v: string): number | null {
  return v === "" ? null : Number(v);
}

function computeBmi(h: number | null, w: number | null): number | null {
  if (h && w && h > 0) return Math.round((703 * w) / (h * h) * 10) / 10;
  return null;
}

/** UTC ISO datetime → datetime-local input value (YYYY-MM-DDTHH:MM) in the user's timezone */
function toLocalInputValue(isoUtc: string | null | undefined, timezone: string): string {
  if (!isoUtc) return "";
  try {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return formatter.format(new Date(isoUtc)).replace(" ", "T").slice(0, 16);
  } catch {
    return isoUtc.slice(0, 16);
  }
}

/** Current time as a datetime-local input value in the user's timezone */
function nowLocal(timezone: string): string {
  return toLocalInputValue(new Date().toISOString(), timezone);
}

// ─── form state shape ────────────────────────────────────────────────────────

interface VitalsFormState {
  measured_at: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse_bpm: number | null;
  height_in: number | null;
  weight_lb: number | null;
  temperature_f: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  blood_glucose: number | null;
  notes: string | null;
  visit_log_id: string | null;
}

const EMPTY: VitalsFormState = {
  measured_at: "",
  bp_systolic: null,
  bp_diastolic: null,
  pulse_bpm: null,
  height_in: null,
  weight_lb: null,
  temperature_f: null,
  respiratory_rate: null,
  spo2: null,
  blood_glucose: null,
  notes: null,
  visit_log_id: null,
};

// ─── component ───────────────────────────────────────────────────────────────

export default function VitalsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const tz = user?.timezone ?? "America/Chicago";

  const [rows, setRows] = useState<Vitals[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<Vitals | null>(null);
  const [form, setForm] = useState<VitalsFormState>(EMPTY);
  const [modalError, setModalError] = useState("");
  const [heightFt, setHeightFt] = useState<number | null>(null);
  const [heightIn, setHeightIn] = useState<number | null>(null);

  async function reload() {
    setRows(await vitalsApi.list());
  }

  useEffect(() => {
    setLoading(true);
    reload()
      .catch(() => { setError("Failed to load vitals"); setRows([]); })
      .finally(() => setLoading(false));
  }, []);

  function openAdd() {
    setForm({ ...EMPTY, measured_at: nowLocal(tz) });
    setHeightFt(null);
    setHeightIn(null);
    setEditingRow(null);
    setModalError("");
    setModalMode("add");
  }

  function openEdit(r: Vitals) {
    setEditingRow(r);
    const { ft, inches } = inToFeetInches(r.height_in);
    setHeightFt(ft);
    setHeightIn(inches);
    setForm({
      measured_at: toLocalInputValue(r.measured_at, tz),
      bp_systolic: r.bp_systolic,
      bp_diastolic: r.bp_diastolic,
      pulse_bpm: r.pulse_bpm,
      height_in: r.height_in,
      weight_lb: r.weight_lb,
      temperature_f: r.temperature_f,
      respiratory_rate: r.respiratory_rate,
      spo2: r.spo2,
      blood_glucose: r.blood_glucose,
      notes: r.notes,
      visit_log_id: r.visit_log_id,
    });
    setModalError("");
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingRow(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setModalError("");
    const payload: VitalsInput = {
      ...form,
      measured_at: form.measured_at ? localToUtcIso(form.measured_at, tz) : undefined,
    };
    try {
      if (modalMode === "edit" && editingRow) {
        await vitalsApi.update(editingRow.id, payload);
      } else {
        await vitalsApi.create(payload);
      }
      closeModal();
      await reload();
    } catch {
      setModalError(modalMode === "edit" ? "Could not update record" : "Could not add record");
    }
  }

  async function onDelete(id: string) {
    try { await vitalsApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  // BMI live preview inside modal
  const bmiPreview = computeBmi(form.height_in, form.weight_lb);

  return (
    <AppShell>
      <PageLayout
        title="Vitals"
        description="Track blood pressure, weight, height, and other health measurements."
        action={isAdmin ? <Button onClick={openAdd}>+ Add</Button> : undefined}
      >
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={isAdmin}
              getRowId={(r) => r.id}
              defaultSortKey="measured_at"
              defaultSortDir="desc"
              primaryColumns={[
                {
                  header: "Date & Time",
                  sortKey: "measured_at",
                  render: (r) => formatInTimezone(r.measured_at, tz),
                  className: "px-4 py-3 font-medium text-foreground",
                },
                {
                  header: "BP",
                  render: (r) =>
                    r.bp_systolic != null && r.bp_diastolic != null
                      ? `${r.bp_systolic}/${r.bp_diastolic}`
                      : "—",
                },
                {
                  header: "Pulse",
                  sortKey: "pulse_bpm",
                  render: (r) => r.pulse_bpm != null ? String(r.pulse_bpm) : "—",
                },
                {
                  header: "Weight (lb)",
                  sortKey: "weight_lb",
                  render: (r) => r.weight_lb != null ? String(r.weight_lb) : "—",
                },
                {
                  header: "Source",
                  render: (r) => r.visit_log_id ? "From Visit Log" : "Manual",
                },
              ]}
              detailTitle={(r) => formatInTimezone(r.measured_at, tz)}
              detailFields={(r) => [
                { label: "Date & Time", value: formatInTimezone(r.measured_at, tz) },
                {
                  label: "Blood Pressure",
                  value: r.bp_systolic != null && r.bp_diastolic != null
                    ? `${r.bp_systolic}/${r.bp_diastolic} mmHg`
                    : null,
                },
                { label: "Pulse", value: r.pulse_bpm != null ? `${r.pulse_bpm} bpm` : null },
                { label: "Height", value: r.height_in != null ? formatHeight(r.height_in) : null },
                { label: "Weight", value: r.weight_lb != null ? `${r.weight_lb} lb` : null },
                { label: "BMI", value: r.bmi != null ? String(r.bmi) : null },
                { label: "Temperature", value: r.temperature_f != null ? `${r.temperature_f} °F` : null },
                { label: "Respiratory Rate", value: r.respiratory_rate != null ? `${r.respiratory_rate} /min` : null },
                { label: "SpO2", value: r.spo2 != null ? `${r.spo2}%` : null },
                { label: "Blood Glucose", value: r.blood_glucose != null ? `${r.blood_glucose} mg/dL` : null },
                { label: "Source", value: r.visit_log_id ? "From Visit Log" : "Manual" },
                { label: "Notes", value: r.notes },
              ]}
              getHeadline={(r) => formatInTimezone(r.measured_at, tz)}
              getSubtitle={(r) =>
                r.bp_systolic != null && r.bp_diastolic != null
                  ? `BP ${r.bp_systolic}/${r.bp_diastolic}`
                  : null
              }
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No vitals records yet."
            />
          </CardContent>
        </Card>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </PageLayout>

      {modalMode && (
        <RecordFormModal
          title={modalMode === "edit" ? "Edit Vitals" : "Add Vitals"}
          submitLabel={modalMode === "edit" ? "Save" : "Add Vitals"}
          error={modalError || null}
          onClose={closeModal}
          onSubmit={onSubmit}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Date & Time — full width */}
            <div className="sm:col-span-2">
              <FormField label="Date & Time Taken" htmlFor="vt-measured-at">
                <Input
                  id="vt-measured-at"
                  type="datetime-local"
                  required
                  value={form.measured_at}
                  onChange={(e) => setForm((s) => ({ ...s, measured_at: e.target.value }))}
                />
              </FormField>
            </div>

            {/* Blood Pressure */}
            <FormField label="Systolic (mmHg)" htmlFor="vt-systolic">
              <Input
                id="vt-systolic"
                type="number"
                value={form.bp_systolic ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, bp_systolic: num(e.target.value) }))}
                placeholder="e.g. 120"
              />
            </FormField>
            <FormField label="Diastolic (mmHg)" htmlFor="vt-diastolic">
              <Input
                id="vt-diastolic"
                type="number"
                value={form.bp_diastolic ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, bp_diastolic: num(e.target.value) }))}
                placeholder="e.g. 80"
              />
            </FormField>

            {/* Pulse */}
            <FormField label="Pulse (bpm)" htmlFor="vt-pulse">
              <Input
                id="vt-pulse"
                type="number"
                value={form.pulse_bpm ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, pulse_bpm: num(e.target.value) }))}
                placeholder="e.g. 72"
              />
            </FormField>

            {/* Height — ft/in two-field input */}
            <FormField label="Height" htmlFor="vt-height-ft">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Input
                    id="vt-height-ft"
                    type="number"
                    min={0}
                    max={8}
                    className="w-16"
                    placeholder="ft"
                    value={heightFt ?? ""}
                    onChange={(e) => {
                      const ft = e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value)));
                      setHeightFt(ft);
                      setForm((s) => ({ ...s, height_in: feetInchesToIn(ft, heightIn) }));
                    }}
                  />
                  <span className="text-sm text-muted-foreground">ft</span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    id="vt-height-in"
                    type="number"
                    min={0}
                    max={11}
                    className="w-16"
                    placeholder="in"
                    value={heightIn ?? ""}
                    onChange={(e) => {
                      const inches = e.target.value === "" ? null : Math.min(11, Math.max(0, Math.floor(Number(e.target.value))));
                      setHeightIn(inches);
                      setForm((s) => ({ ...s, height_in: feetInchesToIn(heightFt, inches) }));
                    }}
                  />
                  <span className="text-sm text-muted-foreground">in</span>
                </div>
              </div>
            </FormField>

            {/* Weight */}
            <FormField label="Weight (lb)" htmlFor="vt-weight">
              <Input
                id="vt-weight"
                type="number"
                step="0.1"
                value={form.weight_lb ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, weight_lb: num(e.target.value) }))}
                placeholder="e.g. 150"
              />
            </FormField>

            {/* BMI preview */}
            <div className="flex items-end pb-1">
              <p className="text-sm text-muted-foreground">
                BMI: <span className="font-medium text-foreground">{bmiPreview ?? "—"}</span>
              </p>
            </div>

            {/* Temperature */}
            <FormField label="Temperature (°F)" htmlFor="vt-temp">
              <Input
                id="vt-temp"
                type="number"
                step="0.1"
                value={form.temperature_f ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, temperature_f: num(e.target.value) }))}
                placeholder="e.g. 98.6"
              />
            </FormField>

            {/* Respiratory Rate */}
            <FormField label="Respiratory Rate (/min)" htmlFor="vt-resp">
              <Input
                id="vt-resp"
                type="number"
                value={form.respiratory_rate ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, respiratory_rate: num(e.target.value) }))}
                placeholder="e.g. 16"
              />
            </FormField>

            {/* SpO2 */}
            <FormField label="SpO2 (%)" htmlFor="vt-spo2">
              <Input
                id="vt-spo2"
                type="number"
                value={form.spo2 ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, spo2: num(e.target.value) }))}
                placeholder="e.g. 98"
              />
            </FormField>

            {/* Blood Glucose */}
            <FormField label="Blood Glucose (mg/dL)" htmlFor="vt-glucose">
              <Input
                id="vt-glucose"
                type="number"
                value={form.blood_glucose ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, blood_glucose: num(e.target.value) }))}
                placeholder="e.g. 95"
              />
            </FormField>

            {/* Notes — full width */}
            <div className="sm:col-span-2">
              <FormField label="Notes" htmlFor="vt-notes">
                <Textarea
                  id="vt-notes"
                  placeholder="Additional notes…"
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
                />
              </FormField>
            </div>
          </div>
        </RecordFormModal>
      )}
    </AppShell>
  );
}
