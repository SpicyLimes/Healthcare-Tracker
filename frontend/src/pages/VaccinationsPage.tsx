import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { vaccinationsApi, type Vaccination, type VaccinationInput } from "../api/vaccinations";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { formatDate } from "@/lib/format";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";

const EMPTY: VaccinationInput = {
  vaccine: "",
  manufacturer: null,
  administered_date: null,
  administrator: null,
  next_due_date: null,
  notes: null,
};

export default function VaccinationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isContributor = user?.role === "contributor";
  const canWrite = isAdmin || isContributor;
  const submitLabel = isContributor ? "Submit for Approval" : "Save";
  const contributorNotice = isContributor
    ? "As a Contributor, your changes will be submitted for Admin review before taking effect."
    : null;
  const [rows, setRows] = useState<Vaccination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<Vaccination | null>(null);
  const [form, setForm] = useState<VaccinationInput>(EMPTY);
  const [modalError, setModalError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  async function reload() { setRows(await vaccinationsApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load vaccinations"); setRows([]); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!canWrite) return;
    const openId = searchParams.get("open");
    if (!openId || rows.length === 0) return;
    const record = rows.find((r) => r.id === openId);
    if (record) {
      openEdit(record);
      setSearchParams({}, { replace: true });
    }
  }, [rows, searchParams]);

  function openAdd() {
    setForm(EMPTY);
    setEditingRow(null);
    setModalError("");
    setModalMode("add");
  }

  function openEdit(r: Vaccination) {
    setEditingRow(r);
    setForm({ vaccine: r.vaccine, manufacturer: r.manufacturer, administered_date: r.administered_date, administrator: r.administrator, next_due_date: r.next_due_date, notes: r.notes });
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
    try {
      if (modalMode === "edit" && editingRow) {
        await vaccinationsApi.update(editingRow.id, form);
      } else {
        await vaccinationsApi.create(form);
      }
      closeModal();
      await reload();
    } catch {
      setModalError(modalMode === "edit" ? "Could not update record" : "Could not add record");
    }
  }

  async function onDelete(id: string) {
    const msg = isContributor
      ? "Submit a deletion request for this vaccination record? An Admin must approve before it is removed."
      : "Delete this vaccination record?";
    if (!window.confirm(msg)) return;
    try { await vaccinationsApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  return (
    <AppShell>
      <PageLayout
        title="Vaccinations"
        description="Track immunization history, lot numbers, and upcoming booster dates."
        action={canWrite ? <Button onClick={openAdd}>+ Add</Button> : undefined}
      >
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={canWrite}
              getRowId={(r) => r.id}
              defaultSortKey="administered_date"
              defaultSortDir="desc"
              primaryColumns={[
                { header: "Date Administered", sortKey: "administered_date", render: (r) => r.administered_date ? formatDate(r.administered_date) : "", className: "px-4 py-3 font-medium text-foreground" },
                { header: "Vaccine", sortKey: "vaccine", render: (r) => r.vaccine },
                { header: "Next Due", sortKey: "next_due_date", render: (r) => r.next_due_date ? formatDate(r.next_due_date) : "" },
              ]}
              detailTitle={(r) => r.vaccine}
              detailFields={(r) => [
                { label: "Date Administered", value: r.administered_date ? formatDate(r.administered_date) : null },
                { label: "Next Due", value: r.next_due_date ? formatDate(r.next_due_date) : null },
                { label: "Manufacturer", value: r.manufacturer },
                { label: "Administrator", value: r.administrator },
                { label: "Lot Number", value: r.lot_number },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="vaccinations" recordId={r.id} isAdmin={canWrite} />}
              getHeadline={(r) => r.vaccine}
              getSubtitle={(r) => r.administered_date ? formatDate(r.administered_date) : null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No vaccination records yet."
            />
          </CardContent>
        </Card>
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}
      </PageLayout>
      {modalMode && (
        <RecordFormModal
          title={modalMode === "edit" ? "Edit Vaccination" : "Add Vaccination"}
          submitLabel={submitLabel}
          error={modalError || null}
          onClose={closeModal}
          onSubmit={onSubmit}
        >
          {contributorNotice && (
            <p className="text-sm text-muted-foreground">{contributorNotice}</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Vaccine" htmlFor="vac-vaccine">
                <Input
                  id="vac-vaccine"
                  required
                  placeholder="e.g. Influenza, COVID-19"
                  value={form.vaccine}
                  onChange={(e) => setForm((s) => ({ ...s, vaccine: e.target.value }))}
                />
              </FormField>
            </div>
            <FormField label="Manufacturer" htmlFor="vac-manufacturer">
              <Input
                id="vac-manufacturer"
                placeholder="e.g. Pfizer, Moderna"
                value={form.manufacturer ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, manufacturer: e.target.value || null }))}
              />
            </FormField>
            <FormField label="Administrator" htmlFor="vac-administrator">
              <Input
                id="vac-administrator"
                placeholder="Provider or clinic"
                value={form.administrator ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, administrator: e.target.value || null }))}
              />
            </FormField>
            <FormField label="Administered Date" htmlFor="vac-administered-date">
              <Input
                id="vac-administered-date"
                type="date"
                value={form.administered_date ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, administered_date: e.target.value || null }))}
              />
            </FormField>
            <FormField label="Next Due Date" htmlFor="vac-next-due-date">
              <Input
                id="vac-next-due-date"
                type="date"
                value={form.next_due_date ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, next_due_date: e.target.value || null }))}
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Notes" htmlFor="vac-notes">
                <Textarea
                  id="vac-notes"
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
