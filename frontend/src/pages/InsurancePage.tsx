import React, { useEffect, useState, type FormEvent } from "react";
import { insurancesApi, type Insurance } from "../api/insurances";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { ChevronRight, ChevronDown } from "lucide-react";

export default function InsurancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Insurance[]>([]);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    insurer_name: "",
    policy_number: "",
    group_number: "",
    contact_phone: "",
    notes: "",
  });

  async function reload() {
    setRows(await insurancesApi.list());
  }

  useEffect(() => {
    reload().catch(() => setError("Failed to load insurance records"));
  }, []);

  function set(key: keyof typeof form, value: string) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== ""),
      ) as typeof form;
      await insurancesApi.create(payload);
      setForm({ insurer_name: "", policy_number: "", group_number: "", contact_phone: "", notes: "" });
      await reload();
    } catch {
      setError("Could not add insurance record");
    }
  }

  async function onDelete(id: string) {
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
      <PageLayout title="Insurance" description="Health insurance policies and contact information.">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Insurer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Policy #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Group #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</th>
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{r.insurer_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.policy_number ?? ""}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.group_number ?? ""}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.contact_phone ?? ""}</td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => onDelete(r.id)}>
                          Delete
                        </Button>
                      </td>
                    )}
                    {r.notes && (
                      <td className="px-2 py-3">
                        <button
                          onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={expandedId === r.id ? "Collapse notes" : "Expand notes"}
                        >
                          {expandedId === r.id
                            ? <ChevronDown className="size-4" />
                            : <ChevronRight className="size-4" />}
                        </button>
                      </td>
                    )}
                    {!r.notes && <td />}
                  </tr>
                  {expandedId === r.id && r.notes && (
                    <tr className="bg-muted/20">
                      <td colSpan={isAdmin ? 6 : 5} className="px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap">
                        <span className="font-medium text-foreground mr-2">Notes:</span>{r.notes}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No insurance records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
            </div>
          </CardContent>
        </Card>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {isAdmin && (
          <Card>
            <CardContent className="py-6">
              <form onSubmit={onAdd} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <FormField label="Insurer name" htmlFor="insurer_name">
                      <Input
                        id="insurer_name"
                        type="text"
                        required
                        value={form.insurer_name}
                        onChange={(e) => set("insurer_name", e.target.value)}
                        placeholder="e.g. Blue Cross Blue Shield"
                      />
                    </FormField>
                  </div>

                  <FormField label="Policy #" htmlFor="policy_number">
                    <Input
                      id="policy_number"
                      type="text"
                      value={form.policy_number}
                      onChange={(e) => set("policy_number", e.target.value)}
                      placeholder="e.g. XYZ123456"
                    />
                  </FormField>

                  <FormField label="Group #" htmlFor="group_number">
                    <Input
                      id="group_number"
                      type="text"
                      value={form.group_number}
                      onChange={(e) => set("group_number", e.target.value)}
                      placeholder="e.g. GRP987654"
                    />
                  </FormField>

                  <FormField label="Contact phone" htmlFor="contact_phone">
                    <Input
                      id="contact_phone"
                      type="tel"
                      value={form.contact_phone}
                      onChange={(e) => set("contact_phone", e.target.value)}
                      placeholder="e.g. +1 800-555-0100"
                    />
                  </FormField>

                  <div className="sm:col-span-2">
                    <FormField label="Notes" htmlFor="notes">
                      <Textarea
                        id="notes"
                        value={form.notes}
                        onChange={(e) => set("notes", e.target.value)}
                        placeholder="Additional notes..."
                      />
                    </FormField>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Add insurance</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {rows.map((r) => (
          <div key={r.id} className="mt-4">
            <DocumentsPanel section="insurances" recordId={r.id} isAdmin={isAdmin} />
          </div>
        ))}
      </PageLayout>
    </AppShell>
  );
}
