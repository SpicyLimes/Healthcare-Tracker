import { useEffect, useState, type FormEvent } from "react";
import { pharmaciesApi, type Pharmacy } from "../api/pharmacies";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";

export default function PharmaciesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Pharmacy[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    notes: "",
  });

  async function reload() {
    setRows(await pharmaciesApi.list());
  }

  useEffect(() => {
    reload().catch(() => setError("Failed to load pharmacies"));
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
      await pharmaciesApi.create(payload);
      setForm({ name: "", address: "", phone: "", notes: "" });
      await reload();
    } catch {
      setError("Could not add pharmacy");
    }
  }

  async function onDelete(id: string) {
    setError("");
    try {
      await pharmaciesApi.remove(id);
      await reload();
    } catch {
      setError("Could not delete pharmacy");
    }
  }

  return (
    <AppShell>
      <PageLayout title="Pharmacies" description="Preferred pharmacies and contact information.">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</th>
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.phone ?? ""}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.address ?? ""}</td>
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
                    No pharmacies yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {isAdmin && (
          <Card>
            <CardContent className="py-6">
              <form onSubmit={onAdd} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <FormField label="Name" htmlFor="name">
                      <Input
                        id="name"
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="e.g. CVS Pharmacy"
                      />
                    </FormField>
                  </div>

                  <FormField label="Phone" htmlFor="phone">
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="e.g. +1 555-555-0100"
                    />
                  </FormField>

                  <div className="sm:col-span-2">
                    <FormField label="Address" htmlFor="address">
                      <Textarea
                        id="address"
                        value={form.address}
                        onChange={(e) => set("address", e.target.value)}
                        placeholder="Street address..."
                      />
                    </FormField>
                  </div>

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
                  <Button type="submit">Add pharmacy</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

      </PageLayout>
    </AppShell>
  );
}
