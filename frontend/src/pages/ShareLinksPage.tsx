// frontend/src/pages/ShareLinksPage.tsx
import { useEffect, useState } from "react";
import {
  listShareLinks, createShareLink, revokeShareLink,
  type ShareLink, type ShareLinkCreated,
} from "../api/shareLinks";

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

export default function ShareLinksPage() {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState(addDays(7));
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [created, setCreated] = useState<ShareLinkCreated | null>(null);
  const [copied, setCopied] = useState(false);

  async function reload() {
    try {
      setLinks(await listShareLinks());
    } catch {
      setError("Failed to load share links");
    }
  }

  useEffect(() => { reload(); }, []);

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

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(window.location.origin + url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Share Links</h1>
      {error && <p role="alert" style={{ color: "red" }}>{error}</p>}

      {created && (
        <div role="dialog" aria-label="Share link created" style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "1rem", background: "#f9f9f9" }}>
          <p><strong>Share link created.</strong> Save this link now — it cannot be retrieved again.</p>
          <code style={{ wordBreak: "break-all" }}>{window.location.origin}{created.token_url}</code>
          <br />
          <button onClick={() => handleCopy(created.token_url)} style={{ marginTop: "0.5rem" }}>
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button onClick={() => setCreated(null)} style={{ marginLeft: "1rem" }}>Dismiss</button>
        </div>
      )}

      <button onClick={() => setShowForm((v) => !v)} style={{ marginBottom: "1rem" }}>
        {showForm ? "Cancel" : "Create Link"}
      </button>

      {showForm && (
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "30rem", marginBottom: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column" }}>
            Label
            <input required value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label style={{ display: "flex", flexDirection: "column" }}>
            Expiry
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {[7, 30, 90].map((d) => (
                <button key={d} type="button" onClick={() => setExpiresAt(addDays(d))}>
                  {d} days
                </button>
              ))}
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </label>
          <fieldset>
            <legend>Sections (none = all)</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {ALL_SECTIONS.map((s) => (
                <label key={s} style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedSections.includes(s)}
                    onChange={() => toggleSection(s)}
                  />
                  {s.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit">Create</button>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th style={{ textAlign: "left", paddingRight: "1rem" }}>Label</th>
            <th style={{ textAlign: "left", paddingRight: "1rem" }}>Sections</th>
            <th style={{ textAlign: "left", paddingRight: "1rem" }}>Expires</th>
            <th style={{ textAlign: "left", paddingRight: "1rem" }}>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {links.map((link) => (
            <tr key={link.id}>
              <td style={{ paddingRight: "1rem" }}>{link.label}</td>
              <td style={{ paddingRight: "1rem" }}>
                {link.allowed_sections.length === 0 ? "All" : link.allowed_sections.join(", ")}
              </td>
              <td style={{ paddingRight: "1rem" }}>{new Date(link.expires_at).toLocaleDateString()}</td>
              <td style={{ paddingRight: "1rem" }}>{linkStatus(link)}</td>
              <td>
                {linkStatus(link) === "Active" && (
                  <button onClick={() => handleRevoke(link.id)}>Revoke</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
