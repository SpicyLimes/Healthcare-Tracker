import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { pharmaciesApi, type Pharmacy, type PharmacyInput } from "../api/pharmacies";
import { amendMySubmission, getMySubmission } from "../api/submissions";
import { useAuth } from "../auth/useAuth";
import { useToast } from "../components/toast";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";

const EMPTY: PharmacyInput = {
  name: "",
  address: null,
  phone: null,
  fax: null,
  notes: null,
};

export default function PharmaciesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isContributor = user?.role === "contributor";
  const { showToast, showAck } = useToast();
  const canWrite = isAdmin || isContributor;
  const submitLabel = isContributor ? "Submit for Approval" : "Save";
  const contributorNotice = isContributor
    ? "As a Contributor, your changes will be submitted for Admin review before taking effect."
    : null;
  const [rows, setRows] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<Pharmacy | null>(null);
  const [form, setForm] = useState<PharmacyInput>(EMPTY);
  const [modalError, setModalError] = useState("");
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  async function reload() {
    setRows(await pharmaciesApi.list());
  }

  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load pharmacies"); setRows([]); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isContributor) return;
    const sid = searchParams.get("editSubmission");
    if (!sid) return;
    getMySubmission(sid).then((sub) => {
      setForm({ ...EMPTY, ...(sub.payload as Partial<PharmacyInput>) });
      setEditingRow(null);
      // Amend only while it is still pending. A rejected submission is
      // reopened as a FRESH proposal — the backend 409s any edit to it.
      setEditingSubmissionId(sub.status === "pending" ? sid : null);
      setModalError("");
      setModalMode(sub.action === "create" ? "add" : "edit");
      setSearchParams({}, { replace: true });
    }).catch(() => {});
  }, [isContributor, searchParams]);

  function openAdd() {
    setForm(EMPTY);
    setEditingRow(null);
    setModalError("");
    setModalMode("add");
  }

  function openEdit(r: Pharmacy) {
    setEditingRow(r);
    setForm({
      name: r.name,
      address: r.address,
      phone: r.phone,
      fax: r.fax,
      notes: r.notes,
    });
    setModalError("");
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingRow(null);
    setEditingSubmissionId(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setModalError("");
    try {
      if (editingSubmissionId) {
        await amendMySubmission(editingSubmissionId, form as unknown as Record<string, unknown>);
        closeModal();
        showAck("Your submission has been updated and is awaiting approval.");
        navigate("/my-submissions");
        return;
      }
      if (modalMode === "edit" && editingRow) {
        await pharmaciesApi.update(editingRow.id, form);
      } else {
        await pharmaciesApi.create(form);
      }
      closeModal();
      await reload();
      isContributor
        ? showAck("Submitted for approval — an Admin will review it.")
        : showToast("Saved.");
    } catch {
      setModalError(modalMode === "edit" ? "Could not update record" : "Could not add pharmacy");
    }
  }

  async function onDelete(id: string, label?: string) {
    const msg = isContributor
      ? `Submit a deletion request for ${label ?? "this pharmacy"}? An Admin must approve before it is removed.`
      : `Delete ${label ?? "this pharmacy"}?`;
    if (!window.confirm(msg)) return;
    setError("");
    try {
      await pharmaciesApi.remove(id);
      await reload();
      isContributor
        ? showAck("Deletion submitted for approval.")
        : showToast("Deleted.");
    } catch {
      setError("Could not delete pharmacy");
    }
  }

  return (
    <AppShell>
      <PageLayout
        title="Pharmacies"
        description="Preferred pharmacies and contact information."
        action={canWrite ? <Button onClick={openAdd}>+ Add</Button> : undefined}
      >
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={canWrite}
              getRowId={(r) => r.id}
              defaultSortKey="name"
              primaryColumns={[
                { header: "Name", sortKey: "name", render: (r) => r.name, className: "px-4 py-3 font-medium text-foreground" },
                { header: "Phone", sortKey: "phone", render: (r) => r.phone ?? "" },
                { header: "Address", sortKey: "address", render: (r) => r.address ?? "" },
              ]}
              detailTitle={(r) => r.name}
              detailFields={(r) => [
                { label: "Phone", value: r.phone },
                { label: "Address", value: r.address },
                { label: "Fax", value: r.fax },
                { label: "Notes", value: r.notes },
              ]}
              getHeadline={(r) => r.name}
              getSubtitle={(r) => r.phone ?? null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id, r.name)}
              emptyMessage="No pharmacy records yet."
            />
          </CardContent>
        </Card>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </PageLayout>
      {modalMode && (
        <RecordFormModal
          title={modalMode === "edit" ? "Edit Pharmacy" : "Add Pharmacy"}
          submitLabel={submitLabel}
          error={modalError || null}
          onClose={closeModal}
          onSubmit={onSubmit}
        >
          {contributorNotice && (
            <p className="text-sm text-muted-foreground">{contributorNotice}</p>
          )}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Name" htmlFor="name">
                <Input
                  id="name"
                  type="text"
                  required
                  value={form.name ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="e.g. CVS Pharmacy"
                />
              </FormField>
            </div>

            <FormField label="Phone" htmlFor="phone">
              <Input
                id="phone"
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value || null }))}
                placeholder="e.g. +1 555-555-0100"
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField label="Address" htmlFor="address">
                <Textarea
                  id="address"
                  value={form.address ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, address: e.target.value || null }))}
                  placeholder="Street address..."
                />
              </FormField>
            </div>

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
