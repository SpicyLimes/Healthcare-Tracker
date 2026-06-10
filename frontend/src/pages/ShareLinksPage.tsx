// frontend/src/pages/ShareLinksPage.tsx
import { useEffect, useState } from "react";
import {
  listShareLinks, createShareLink, revokeShareLink, deleteShareLink,
  type ShareLink, type ShareLinkCreated,
} from "../api/shareLinks";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField, Input } from "@/components/ui/form-field";
import { formatDate } from "@/lib/format";
import { MobileRecordList } from "@/components/MobileRecordList";

const ALL_SECTIONS = [
  "surgeries", "hospitalizations", "vision_history", "dental_history",
  "visit_logs", "appointments", "medications", "vaccinations",
  "insurances", "ailments", "doctors", "pharmacies", "family_history", "profile",
  "nutrition_plan",
];

function formatSection(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 16);
}

function linkStatus(link: ShareLink): string {
  if (link.revoked) return "Revoked";
  if (new Date(link.expires_at) < new Date()) return "Expired";
  return "Active";
}

export default function ShareLinksPage() {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState(addDays(7));
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [created, setCreated] = useState<ShareLinkCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function reload() {
    try {
      setLinks(await listShareLinks());
    } catch {
      setError("Failed to load share links");
    }
  }

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const result = await createShareLink({
        label,
        expires_at: new Date(expiresAt).toISOString(),
        allowed_sections: selectedSections,
      });
      setCreated(result);
      setShowForm(false);
      setLabel("");
      setExpiresAt(addDays(7));
      setSelectedSections([]);
      await reload();
    } catch {
      setError("Failed to create share link");
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeShareLink(id);
      await reload();
    } catch {
      setError("Failed to revoke link");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Permanently delete this share link? This cannot be undone.")) return;
    try {
      await deleteShareLink(id);
      await reload();
    } catch {
      setError("Failed to delete link");
    }
  }

  function toggleSection(s: string) {
    setSelectedSections((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function copyToClipboard(text: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  }

  async function handleCopyBanner(url: string) {
    await copyToClipboard(window.location.origin + url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyRow(url: string, id: string) {
    await copyToClipboard(window.location.origin + url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <AppShell>
      <PageLayout
        title="Share Links"
        description="Generate time-limited links for doctor access."
        action={
          <Button variant={showForm ? "outline" : "default"} onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Create Link"}
          </Button>
        }
      >
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {created && (
          <div
            role="dialog"
            aria-label="Share link created"
            className="mb-4 rounded-xl border border-border bg-card p-4"
          >
            <p className="font-medium text-foreground">
              Share link created. Save this link now — it can also be copied from the table below.
            </p>
            <code className="mt-2 block break-all text-sm text-muted-foreground">
              {window.location.origin}{created.token_url}
            </code>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => handleCopyBanner(created.token_url)}>
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCreated(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {showForm && (
          <Card className="mb-6">
            <CardContent className="py-6">
              <form onSubmit={handleCreate} className="flex flex-col gap-5">
                <FormField label="Label" htmlFor="sl-label">
                  <Input
                    id="sl-label"
                    required
                    placeholder="e.g. Dr. Smith visit"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </FormField>

                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">Expiry</p>
                  <div className="flex flex-wrap gap-2">
                    {[7, 30, 90].map((d) => (
                      <Button
                        key={d}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setExpiresAt(addDays(d))}
                      >
                        {d} days
                      </Button>
                    ))}
                    <Input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-auto"
                    />
                  </div>
                </div>

                <fieldset className="border-0 p-0">
                  <legend className="mb-2 text-sm font-medium text-foreground">
                    Sections <span className="text-muted-foreground">(None = All Sections Listed)</span>
                  </legend>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {ALL_SECTIONS.map((s) => (
                      <label key={s} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          checked={selectedSections.includes(s)}
                          onChange={() => toggleSection(s)}
                        />
                        {formatSection(s)}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="flex justify-end">
                  <Button type="submit">Create</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="md:hidden">
          <MobileRecordList
            records={links}
            getHeadline={(link) => link.label}
            getSubtitle={(link) => `Expires: ${formatDate(link.expires_at)}`}
            getBadge={(link) => {
              const status = linkStatus(link)
              return {
                label: status,
                variant: status === "Active" ? "default" : "secondary",
              }
            }}
            getFields={(link) => [
              { key: "Sections", value: link.allowed_sections.length === 0 ? "All sections" : link.allowed_sections.map(formatSection).join(", ") },
              { key: "Expires", value: formatDate(link.expires_at) },
              { key: "Created", value: formatDate(link.created_at) },
            ]}
            isAdmin={true}
            onDelete={(link) => handleDelete(link.id)}
            emptyMessage="No share links yet."
          />
        </div>

        <div className="hidden md:block">
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Label</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sections</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Expires</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-muted-foreground">Loading…</td>
                </tr>
              )}
              {!loading && links.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-muted-foreground">No share links yet.</td>
                </tr>
              )}
              {!loading && links.map((link) => {
                const status = linkStatus(link);
                return (
                  <tr key={link.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-foreground">{link.label}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {link.allowed_sections.length === 0
                        ? "All"
                        : link.allowed_sections.map(formatSection).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(link.expires_at)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={status === "Active" ? "default" : "secondary"}>
                        {status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyRow(link.token_url, link.id)}
                        >
                          {copiedId === link.id ? "Copied!" : "Copy Link"}
                        </Button>
                        {status === "Active" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRevoke(link.id)}
                          >
                            Revoke
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(link.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      </PageLayout>
    </AppShell>
  );
}
