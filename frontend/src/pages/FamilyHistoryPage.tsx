import { useEffect, useState, type FormEvent } from "react";
import { familyHistoryApi, type FamilyHistory, type FamilyHistoryInput } from "../api/familyHistory";
import { useAuth } from "../auth/useAuth";
import { useToast } from "../components/toast";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";

const EMPTY: FamilyHistoryInput = {
  relative: "",
  condition: "",
  age_of_onset: null,
  notes: null,
};

export default function FamilyHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isContributor = user?.role === "contributor";
  const { showToast, showAck } = useToast();
  const canWrite = isAdmin || isContributor;
  const submitLabel = isContributor ? "Submit for Approval" : "Save";
  const contributorNotice = isContributor
    ? "As a Contributor, your changes will be submitted for Admin review before taking effect."
    : null;
  const [rows, setRows] = useState<FamilyHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<FamilyHistory | null>(null);
  const [form, setForm] = useState<FamilyHistoryInput>(EMPTY);
  const [modalError, setModalError] = useState("");

  async function reload() {
    setRows(await familyHistoryApi.list());
  }

  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load family history"); setRows([]); }).finally(() => setLoading(false));
  }, []);

  function openAdd() {
    setForm(EMPTY);
    setEditingRow(null);
    setModalError("");
    setModalMode("add");
  }

  function openEdit(r: FamilyHistory) {
    setEditingRow(r);
    setForm({
      relative: r.relative,
      condition: r.condition,
      age_of_onset: r.age_of_onset,
      notes: r.notes,
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
    try {
      if (modalMode === "edit" && editingRow) {
        await familyHistoryApi.update(editingRow.id, form);
      } else {
        await familyHistoryApi.create(form);
      }
      closeModal();
      await reload();
      isContributor
        ? showAck("Submitted for approval — an Admin will review it.")
        : showToast("Saved.");
    } catch {
      setModalError(modalMode === "edit" ? "Could not update record" : "Could not add family history record");
    }
  }

  async function onDelete(id: string) {
    const msg = isContributor
      ? "Submit a deletion request for this family history record? An Admin must approve before it is removed."
      : "Delete this family history record?";
    if (!window.confirm(msg)) return;
    setError("");
    try {
      await familyHistoryApi.remove(id);
      await reload();
      isContributor
        ? showAck("Deletion submitted for approval.")
        : showToast("Deleted.");
    } catch {
      setError("Could not delete family history record");
    }
  }

  return (
    <AppShell>
      <PageLayout
        title="Family Health History"
        description="Hereditary conditions and family medical history."
        action={canWrite ? <Button onClick={openAdd}>+ Add</Button> : undefined}
      >
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={canWrite}
              getRowId={(r) => r.id}
              defaultSortKey="relative"
              primaryColumns={[
                { header: "Relative", sortKey: "relative", render: (r) => r.relative, className: "px-4 py-3 font-medium text-foreground" },
                { header: "Condition", sortKey: "condition", render: (r) => r.condition },
                { header: "Age of Onset", sortKey: "age_of_onset", render: (r) => r.age_of_onset ?? "" },
              ]}
              detailTitle={(r) => `${r.relative} — ${r.condition}`}
              detailFields={(r) => [
                { label: "Relative", value: r.relative },
                { label: "Condition", value: r.condition },
                { label: "Age of Onset", value: r.age_of_onset },
                { label: "Notes", value: r.notes },
              ]}
              getHeadline={(r) => `${r.relative} — ${r.condition}`}
              getSubtitle={(r) => r.condition ?? null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No family history records yet."
            />
          </CardContent>
        </Card>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </PageLayout>
      {modalMode && (
        <RecordFormModal
          title={modalMode === "edit" ? "Edit Family History" : "Add Family History"}
          submitLabel={submitLabel}
          error={modalError || null}
          onClose={closeModal}
          onSubmit={onSubmit}
        >
          {contributorNotice && (
            <p className="text-sm text-muted-foreground">{contributorNotice}</p>
          )}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="Relative" htmlFor="relative">
              <Input
                id="relative"
                type="text"
                required
                value={form.relative}
                onChange={(e) => setForm((s) => ({ ...s, relative: e.target.value }))}
                placeholder="e.g. Father, Maternal grandmother"
              />
            </FormField>

            <FormField label="Condition" htmlFor="condition">
              <Input
                id="condition"
                type="text"
                required
                value={form.condition}
                onChange={(e) => setForm((s) => ({ ...s, condition: e.target.value }))}
                placeholder="e.g. Type 2 diabetes"
              />
            </FormField>

            <FormField label="Age of onset" htmlFor="age_of_onset">
              <Input
                id="age_of_onset"
                type="text"
                value={form.age_of_onset ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, age_of_onset: e.target.value || null }))}
                placeholder="e.g. 55"
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField label="Notes" htmlFor="notes">
                <Textarea
                  id="notes"
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
                  placeholder="Additional notes..."
                />
              </FormField>
            </div>
          </div>
        </RecordFormModal>
      )}
    </AppShell>
  );
}
