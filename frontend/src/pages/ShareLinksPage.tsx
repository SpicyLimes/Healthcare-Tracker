// frontend/src/pages/ShareLinksPage.tsx
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  listShareLinks, createShareLink, revokeShareLink,
  type ShareLink, type ShareLinkCreated,
} from "../api/shareLinks";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField, Input } from "@/components/ui/form-field";
import { formatDate } from "@/lib/format";

const ALL_SECTIONS = [
  "surgeries", "hospitalizations", "vision_history", "dental_history",
  "visit_logs", "appointments", "medications", "vaccinations",
  "insurances", "ailments", "doctors", "profile",
];

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

interface ShareLinkActionsProps {
  status: string;
  copied: boolean;
  onCopy: () => void;
  onRevoke: () => void;
}

function ShareLinkActions({ status, copied, onCopy, onRevoke }: ShareLinkActionsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setOpen((v) => !v)}
        aria-label="Row actions"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-border bg-card shadow-md">
          <button
            className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted/50"
            onClick={() => { onCopy(); setOpen(false); }}
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
          {status === "Active" && (
            <button
              className="block w-full px-4 py-2 text-left text-sm text-destructive hover:bg-muted/50"
              onClick={() => { onRevoke(); setOpen(false); }}
            >
              Revoke
            </button>
          )}
        </div>
      )}
    </div>
  );
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

  function toggleSection(s: string) {
    setSelectedSections((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleCopyBanner(url: string) {
    await navigator.clipboard.writeText(window.location.origin + url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyRow(url: string, id: string) {
    await navigator.clipboard.writeText(window.location.origin + url);
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
                    Sections <span className="text-muted-foreground">(none = all)</span>
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
                        {s.replace(/_/g, " ")}
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
                        : link.allowed_sections.map((s) => s.replace(/_/g, " ")).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(link.expires_at)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={status === "Active" ? "default" : "secondary"}>
                        {status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <ShareLinkActions
                        status={status}
                        copied={copiedId === link.id}
                        onCopy={() => handleCopyRow(link.token_url, link.id)}
                        onRevoke={() => handleRevoke(link.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageLayout>
    </AppShell>
  );
}
