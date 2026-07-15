// frontend/src/pages/ShareLinksPage.tsx
import { useEffect, useState } from "react";
import {
  listShareLinks, createShareLink, revokeShareLink, deleteShareLink, emailShareLink, getEmailStatus,
  type ShareLink, type ShareLinkCreated,
} from "../api/shareLinks";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField, Input } from "@/components/ui/form-field";
import { formatDate } from "@/lib/format";
import { dateToLocalInputValue, formatInTimezone } from "@/lib/datetime";
import { useAuth } from "../auth/useAuth";
import { RecordTable } from "@/components/RecordTable";

const ALL_SECTIONS = [
  "surgeries", "hospitalizations", "vision_history", "dental_history",
  "visit_logs", "vitals", "appointments", "medications", "vaccinations",
  "insurances", "ailments", "doctors", "pharmacies", "family_history", "profile",
  "nutrition_plan",
];

function formatSection(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dateToLocalInputValue(d);
}

function linkStatus(link: ShareLink): string {
  if (link.revoked) return "Revoked";
  if (new Date(link.expires_at) < new Date()) return "Expired";
  return "Active";
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

export default function ShareLinksPage() {
  const { user } = useAuth();
  const tz = user?.timezone ?? "America/Chicago";
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
  const [emailFor, setEmailFor] = useState<ShareLink | null>(null);
  const [recipient, setRecipient] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSent, setEmailSent] = useState("");
  // Hidden until the backend confirms a real email backend is configured.
  const [emailConfigured, setEmailConfigured] = useState(false);

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
    getEmailStatus().then(setEmailConfigured).catch(() => setEmailConfigured(false));
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

  async function handleRevoke(link: ShareLink) {
    try {
      await revokeShareLink(link.id);
      await reload();
    } catch {
      setError("Failed to revoke link");
    }
  }

  async function handleDelete(link: ShareLink) {
    if (!window.confirm("Permanently delete this share link? This cannot be undone.")) return;
    try {
      await deleteShareLink(link.id);
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

  function openEmail(link: ShareLink) {
    setEmailFor(link);
    setRecipient("");
    setEmailMessage("");
    setEmailError("");
    setEmailSent("");
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailFor) return;
    setEmailSending(true);
    setEmailError("");
    try {
      await emailShareLink(emailFor.id, { recipient, message: emailMessage });
      setEmailSent(`Email sent to ${recipient}`);
      setEmailFor(null);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Couldn't send the email.");
    } finally {
      setEmailSending(false);
    }
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
        {emailSent && <p role="status" className="text-sm text-emerald-600">{emailSent}</p>}

        {emailFor && (
          <div
            role="dialog"
            aria-label="Email share link"
            className="mb-4 rounded-xl border border-border bg-card p-4"
          >
            <p className="font-medium text-foreground">
              Email “{emailFor.label}” — expires {formatInTimezone(emailFor.expires_at, tz)}
            </p>
            <form onSubmit={handleSendEmail} className="mt-3 flex flex-col gap-3">
              <FormField label="Recipient" htmlFor="email-recipient">
                <Input
                  id="email-recipient"
                  type="email"
                  required
                  placeholder="doctor@example.com"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </FormField>
              <FormField label="Message (optional)" htmlFor="email-message">
                <textarea
                  id="email-message"
                  className="min-h-[72px] w-full rounded-md border border-border bg-background p-2 text-sm"
                  placeholder="Add a short note for the recipient"
                  maxLength={500}
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                />
              </FormField>
              {emailError && <p role="alert" className="text-sm text-destructive">{emailError}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={emailSending}>
                  {emailSending ? "Sending…" : "Send"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setEmailFor(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

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

        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={links}
              loading={loading}
              isAdmin={true}
              getRowId={(r) => r.id}
              defaultSortKey="expires_at"
              defaultSortDir="asc"
              primaryColumns={[
                {
                  header: "Label",
                  sortKey: "label",
                  render: (r) => <span className="font-medium text-foreground">{r.label}</span>,
                },
                {
                  header: "Sections",
                  render: (r) =>
                    r.allowed_sections.length === 0
                      ? "All"
                      : r.allowed_sections.map(formatSection).join(", "),
                },
                {
                  header: "Expires",
                  sortKey: "expires_at",
                  render: (r) => formatInTimezone(r.expires_at, tz),
                },
                {
                  header: "Status",
                  sortKey: "revoked",
                  render: (r) => {
                    const status = linkStatus(r);
                    return (
                      <Badge variant={status === "Active" ? "default" : "secondary"}>
                        {status}
                      </Badge>
                    );
                  },
                },
              ]}
              detailTitle={(r) => r.label}
              detailFields={(r) => [
                { label: "Label", value: r.label },
                { label: "Expires", value: formatInTimezone(r.expires_at, tz) },
                { label: "Created", value: formatDate(r.created_at) },
                { label: "Status", value: linkStatus(r) },
                {
                  label: "Sections",
                  value: r.allowed_sections.length === 0
                    ? "All sections"
                    : r.allowed_sections.map(formatSection).join(", "),
                },
              ]}
              renderDetailExtra={(r) => (
                <div className="flex flex-wrap gap-2 pt-2">
                  {linkStatus(r) === "Active" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRevoke(r)}
                    >
                      Revoke
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(r)}
                  >
                    Delete
                  </Button>
                </div>
              )}
              renderRowActions={(r) => (
                <>
                  {emailConfigured && linkStatus(r) === "Active" && (
                    <Button variant="outline" size="sm" onClick={() => openEmail(r)}>
                      Email
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyRow(r.token_url, r.id)}
                  >
                    {copiedId === r.id ? "Copied!" : "Copy Link"}
                  </Button>
                </>
              )}
              getHeadline={(r) => r.label}
              getSubtitle={(r) => `Expires: ${formatInTimezone(r.expires_at, tz)}`}
              getBadge={(r) => {
                const status = linkStatus(r);
                return { label: status, variant: status === "Active" ? "default" : "secondary" };
              }}
              emptyMessage="No share links yet."
            />
          </CardContent>
        </Card>
      </PageLayout>
    </AppShell>
  );
}
