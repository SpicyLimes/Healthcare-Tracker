import { useEffect, useState, type FormEvent } from "react";
import { familyHistoryApi, type FamilyHistory } from "../api/familyHistory";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";

export default function FamilyHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<FamilyHistory[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    relative: "",
    condition: "",
    age_of_onset: "",
    notes: "",
  });

  async function reload() {
    setRows(await familyHistoryApi.list());
  }

  useEffect(() => {
    reload().catch(() => setError("Failed to load family history"));
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
      await familyHistoryApi.create(payload);
      setForm({ relative: "", condition: "", age_of_onset: "", notes: "" });
      await reload();
    } catch {
      setError("Could not add family history record");
    }
  }

  async function onDelete(id: string) {
    setError("");
    try {
      await familyHistoryApi.remove(id);
      await reload();
    } catch {
      setError("Could not delete family history record");
    }
  }

  return (
    <AppShell>
      <PageLayout title="Family Health History" description="Hereditary conditions and family medical history.">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Relative</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Condition</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Age of Onset</th>
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{r.relative}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.condition}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.age_of_onset ?? ""}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => onDelete(r.id)}>
                        Delete
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No family history records yet.
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
                  <FormField label="Relative" htmlFor="relative">
                    <Input
                      id="relative"
                      type="text"
                      required
                      value={form.relative}
                      onChange={(e) => set("relative", e.target.value)}
                      placeholder="e.g. Father, Maternal grandmother"
                    />
                  </FormField>

                  <FormField label="Condition" htmlFor="condition">
                    <Input
                      id="condition"
                      type="text"
                      required
                      value={form.condition}
                      onChange={(e) => set("condition", e.target.value)}
                      placeholder="e.g. Type 2 diabetes"
                    />
                  </FormField>

                  <FormField label="Age of onset" htmlFor="age_of_onset">
                    <Input
                      id="age_of_onset"
                      type="text"
                      value={form.age_of_onset}
                      onChange={(e) => set("age_of_onset", e.target.value)}
                      placeholder="e.g. 55"
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
                  <Button type="submit">Add record</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

      </PageLayout>
    </AppShell>
  );
}
