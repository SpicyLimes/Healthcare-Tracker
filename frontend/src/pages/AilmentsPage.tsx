import { useEffect, useState, type FormEvent } from "react";
import { ailmentsApi, type Ailment, type AilmentInput, type AilmentStatus } from "../api/ailments";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField, Input, Select, Textarea } from "@/components/ui/form-field";

const EMPTY: AilmentInput = {
  condition: "",
  onset_date: null,
  status: "active",
  treating_doctor: null,
  notes: null,
};

export default function AilmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Ailment[]>([]);
  const [form, setForm] = useState<AilmentInput>(EMPTY);
  const [error, setError] = useState("");

  async function reload() {
    setRows(await ailmentsApi.list());
  }
  useEffect(() => {
    reload().catch(() => setError("Failed to load ailments"));
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await ailmentsApi.create(form);
      setForm(EMPTY);
      await reload();
    } catch {
      setError("Could not add record");
    }
  }

  async function onDelete(id: string) {
    try {
      await ailmentsApi.remove(id);
      await reload();
    } catch {
      setError("Could not delete record");
    }
  }

  return (
    <AppShell>
      <PageLayout
        title="Ailment History"
        description="Track diagnoses, conditions, and their current status."
      >
        {isAdmin && (
          <Card>
            <CardContent className="py-6">
              <form onSubmit={onAdd} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Condition" htmlFor="ail-condition">
                    <Input
                      id="ail-condition"
                      required
                      placeholder="e.g. Hypertension"
                      value={form.condition}
                      onChange={(e) => setForm((s) => ({ ...s, condition: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Status" htmlFor="ail-status">
                    <Select
                      id="ail-status"
                      value={form.status ?? "active"}
                      onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as AilmentStatus }))}
                    >
                      <option value="active">Active</option>
                      <option value="resolved">Resolved</option>
                    </Select>
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Onset Date" htmlFor="ail-onset">
                    <Input
                      id="ail-onset"
                      type="date"
                      value={form.onset_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, onset_date: e.target.value || null }))}
                    />
                  </FormField>
                  <FormField label="Treating Doctor" htmlFor="ail-doctor">
                    <Input
                      id="ail-doctor"
                      placeholder="Doctor name"
                      value={form.treating_doctor ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, treating_doctor: e.target.value || null }))}
                    />
                  </FormField>
                </div>
                <FormField label="Notes" htmlFor="ail-notes">
                  <Textarea
                    id="ail-notes"
                    placeholder="Additional notes…"
                    value={form.notes ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
                  />
                </FormField>
                <div className="flex justify-end">
                  <Button type="submit">Add Ailment</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Condition</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Onset Date</th>
                {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">{r.condition}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === "active" ? "default" : "secondary"}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.onset_date ?? ""}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>
                        Delete
                      </Button>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <DocumentsPanel section="ailments" recordId={r.id} isAdmin={isAdmin} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageLayout>
    </AppShell>
  );
}
