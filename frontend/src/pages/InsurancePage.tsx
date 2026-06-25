import { useEffect, useState, type FormEvent } from "react";
import { insurancesApi, type Insurance, type InsuranceInput } from "../api/insurances";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";

const EMPTY: InsuranceInput = {
  insurer_name: "",
  policy_number: null,
  group_number: null,
  contact_phone: null,
  notes: null,
};

export default function InsurancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isContributor = user?.role === "contributor";
  const canWrite = isAdmin || isContributor;
  const submitLabel = isContributor ? "Submit for Approval" : "Save";
  const contributorNotice = isContributor
    ? "As a Contributor, your changes will be submitted for Admin review before taking effect."
    : null;
  const [rows, setRows] = useState<Insurance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<Insurance | null>(null);
  const [form, setForm] = useState<InsuranceInput>(EMPTY);
  const [modalError, setModalError] = useState("");

  async function reload() {
    setRows(await insurancesApi.list());
  }

  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load insurance records"); setRows([]); }).finally(() => setLoading(false));
  }, []);

  function openAdd() {
    setForm(EMPTY);
    setEditingRow(null);
    setModalError("");
    setModalMode("add");
  }

  function openEdit(r: Insurance) {
    setEditingRow(r);
    setForm({
      insurer_name: r.insurer_name,
      policy_number: r.policy_number ?? null,
      group_number: r.group_number ?? null,
      contact_phone: r.contact_phone ?? null,
      notes: r.notes ?? null,
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
        await insurancesApi.update(editingRow.id, form);
      } else {
        await insurancesApi.create(form);
      }
      closeModal();
      await reload();
    } catch {
      setModalError(modalMode === "edit" ? "Could not update record" : "Could not add insurance record");
    }
  }

  async function onDelete(id: string) {
    const msg = isContributor
      ? "Submit a deletion request for this insurance record? An Admin must approve before it is removed."
      : "Delete this insurance record?";
    if (!window.confirm(msg)) return;
    setError("");
    try {
      await insurancesApi.remove(id);
      await reload();
    } catch {
      setError("Could not delete insurance record");
    }
  }

  return (
    <AppShell>
      <PageLayout
        title="Insurance"
        description="Health insurance policies and contact information."
        action={canWrite ? <Button onClick={openAdd}>+ Add</Button> : undefined}
      >
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={canWrite}
              getRowId={(r) => r.id}
              defaultSortKey="insurer_name"
              primaryColumns={[
                { header: "Insurer", sortKey: "insurer_name", render: (r) => r.insurer_name, className: "px-4 py-3 font-medium text-foreground" },
                { header: "Policy #", sortKey: "policy_number", render: (r) => r.policy_number ?? "" },
                { header: "Phone", sortKey: "contact_phone", render: (r) => r.contact_phone ?? "" },
              ]}
              detailTitle={(r) => r.insurer_name}
              detailFields={(r) => [
                { label: "Policy #", value: r.policy_number },
                { label: "Group #", value: r.group_number },
                { label: "Phone", value: r.contact_phone },
                { label: "Address", value: r.contact_address },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="insurances" recordId={r.id} isAdmin={isAdmin} />}
              getHeadline={(r) => r.insurer_name}
              getSubtitle={(r) => r.policy_number ?? null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No insurance records yet."
            />
          </CardContent>
        </Card>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </PageLayout>
      {modalMode && (
        <RecordFormModal
          title={modalMode === "edit" ? "Edit Insurance" : "Add Insurance"}
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
              <FormField label="Insurer name" htmlFor="ins-insurer-name">
                <Input
                  id="ins-insurer-name"
                  type="text"
                  required
                  value={form.insurer_name}
                  onChange={(e) => setForm((s) => ({ ...s, insurer_name: e.target.value }))}
                  placeholder="e.g. Blue Cross Blue Shield"
                />
              </FormField>
            </div>
            <FormField label="Policy #" htmlFor="ins-policy-number">
              <Input
                id="ins-policy-number"
                type="text"
                value={form.policy_number ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, policy_number: e.target.value || null }))}
                placeholder="e.g. XYZ123456"
              />
            </FormField>
            <FormField label="Group #" htmlFor="ins-group-number">
              <Input
                id="ins-group-number"
                type="text"
                value={form.group_number ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, group_number: e.target.value || null }))}
                placeholder="e.g. GRP987654"
              />
            </FormField>
            <FormField label="Contact phone" htmlFor="ins-contact-phone">
              <Input
                id="ins-contact-phone"
                type="tel"
                value={form.contact_phone ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, contact_phone: e.target.value || null }))}
                placeholder="e.g. +1 800-555-0100"
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Notes" htmlFor="ins-notes">
                <Textarea
                  id="ins-notes"
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
