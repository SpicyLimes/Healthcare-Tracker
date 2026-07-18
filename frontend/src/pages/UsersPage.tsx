import { useEffect, useState, type FormEvent } from "react";
import { createUser, deleteUser, listUsers, resetUserPassword, updateUser, type ManagedUser } from "../api/users";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";
import { formatDate } from "@/lib/format";

const EXPIRY_OPTIONS = [
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 180, label: "3 hours" },
  { value: 360, label: "6 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "24 hours" },
] as const;

function tempBadge(u: ManagedUser) {
  if (!u.must_change_password || !u.temp_password_expires_at) return null;
  const expires = new Date(u.temp_password_expires_at);
  if (expires < new Date()) {
    return <span className="ml-2 text-xs font-medium text-destructive">Temp password expired</span>;
  }
  const when = expires.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return <span className="ml-2 text-xs font-medium text-amber-600 dark:text-amber-400">Temp password — expires {when}</span>;
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [notice, setNotice] = useState("");

  // Add modal state
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "contributor" | "viewer">("viewer");
  const [sendOnboarding, setSendOnboarding] = useState(true);
  const [newExpiry, setNewExpiry] = useState(720);
  const [newNotes, setNewNotes] = useState("");

  // Edit modal state
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "contributor" | "viewer">("viewer");
  const [editActive, setEditActive] = useState(true);

  // Reset-password modal state
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [resetExpiry, setResetExpiry] = useState(720);
  const [resetNotes, setResetNotes] = useState("");

  async function reload() {
    setUsers(await listUsers());
  }

  useEffect(() => {
    setLoading(true);
    reload().catch(() => setError("Failed to load users")).finally(() => setLoading(false));
  }, []);

  function openAdd() {
    setNewEmail("");
    setNewPassword("");
    setNewName("");
    setNewRole("viewer");
    setSendOnboarding(true);
    setNewExpiry(720);
    setNewNotes("");
    setModalError("");
    setAddOpen(true);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setModalError("");
    setNotice("");
    try {
      const created = await createUser(
        sendOnboarding
          ? {
              email: newEmail,
              role: newRole,
              full_name: newName.trim() || null,
              send_onboarding_email: true,
              expires_minutes: newExpiry,
              notes: newNotes.trim() || null,
            }
          : {
              email: newEmail,
              role: newRole,
              full_name: newName.trim() || null,
              password: newPassword,
            },
      );
      setAddOpen(false);
      if (created.email_sent === false) {
        setNotice(`User created, but the email failed — use Reset Password to retry.`);
      } else if (created.email_sent === true) {
        setNotice(`Onboarding email sent to ${created.email}.`);
      }
      await reload();
    } catch {
      setModalError("Could not create user");
    }
  }

  function openEdit(u: ManagedUser) {
    setEditingUser(u);
    setEditName(u.full_name ?? "");
    setEditRole(u.role);
    setEditActive(u.is_active);
    setModalError("");
  }

  function closeEdit() {
    setEditingUser(null);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setModalError("");
    try {
      await updateUser(editingUser.id, {
        full_name: editName.trim() || null,
        role: editRole,
        is_active: editActive,
      });
      closeEdit();
      await reload();
    } catch {
      setModalError("Could not update user");
    }
  }

  async function onSendReset(e: FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setModalError("");
    try {
      await resetUserPassword(resetTarget.id, resetExpiry, resetNotes.trim() || null);
      const email = resetTarget.email;
      setResetTarget(null);
      closeEdit();
      setNotice(`Temporary password emailed to ${email}.`);
      await reload();
    } catch {
      setModalError("Could not send the reset email — nothing was changed");
    }
  }

  async function onDelete(u: ManagedUser) {
    setError("");
    try {
      await deleteUser(u.id);
      await reload();
    } catch {
      setError("Could not delete user");
    }
  }

  return (
    <AppShell>
      <PageLayout
        title="Manage Users"
        description="Admin user accounts and roles."
        action={<Button onClick={openAdd}>+ Add</Button>}
      >
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>
        )}
        {notice && (
          <p role="status" className="mb-4 text-sm text-primary">{notice}</p>
        )}

        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={users}
              loading={loading}
              isAdmin={true}
              getRowId={(r) => r.id}
              defaultSortKey="full_name"
              defaultSortDir="asc"
              primaryColumns={[
                {
                  header: "Name",
                  sortKey: "full_name",
                  render: (r) => (
                    <span className="font-medium text-foreground">{r.full_name ?? "—"}</span>
                  ),
                },
                {
                  header: "Email",
                  sortKey: "email",
                  render: (r) => (
                    <span className="text-foreground">
                      {r.email}
                      {!r.is_active && (
                        <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
                      )}
                      {tempBadge(r)}
                    </span>
                  ),
                },
                {
                  header: "Role",
                  sortKey: "role",
                  render: (r) => (
                    <Badge variant={r.role === "admin" ? "default" : r.role === "contributor" ? "outline" : "secondary"}>
                      {r.role === "admin" ? "Admin" : r.role === "contributor" ? "Contributor" : "Viewer"}
                    </Badge>
                  ),
                },
              ]}
              detailTitle={(r) => r.full_name ?? r.email}
              detailFields={(r) => [
                { label: "Name", value: r.full_name ?? null },
                { label: "Email", value: r.email },
                { label: "Role", value: r.role === "admin" ? "Admin" : r.role === "contributor" ? "Contributor" : "Viewer" },
                { label: "Active", value: r.is_active ? "Yes" : "No" },
                { label: "Created", value: formatDate(r.created_at) },
                { label: "Temp password", value: r.must_change_password
                    ? (r.temp_password_expires_at && new Date(r.temp_password_expires_at) < new Date()
                        ? "Expired" : "Pending first login") : null },
              ]}
              getHeadline={(r) => r.email}
              getSubtitle={(r) => r.full_name ?? null}
              getBadge={(r) => ({
                label: r.role === "admin" ? "Admin" : r.role === "contributor" ? "Contributor" : "Viewer",
                variant: r.role === "admin" ? "default" : r.role === "contributor" ? "outline" : "secondary",
              })}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r)}
              emptyMessage="No users found."
            />
          </CardContent>
        </Card>

        {/* Add user modal */}
        {addOpen && (
          <RecordFormModal
            title="Add User"
            submitLabel="Add User"
            error={modalError || null}
            onClose={() => setAddOpen(false)}
            onSubmit={onCreate}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Email" htmlFor="new_user_email">
                <Input
                  id="new_user_email"
                  type="email"
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Name (optional)" htmlFor="new_user_name">
                <Input
                  id="new_user_name"
                  type="text"
                  placeholder="Full name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </FormField>
              <label className="sm:col-span-2 flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendOnboarding}
                  onChange={(e) => setSendOnboarding(e.target.checked)}
                  className="rounded border-border"
                  aria-label="Send onboarding email"
                />
                Send onboarding email with a temporary password
              </label>
              {!sendOnboarding && (
                <FormField label="Password" htmlFor="new_user_password">
                  <Input
                    id="new_user_password"
                    type="password"
                    placeholder="Min 12 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={12}
                  />
                </FormField>
              )}
              {sendOnboarding && (
                <>
                  <FormField label="Temporary password expires after" htmlFor="new_user_expiry">
                    <Select
                      id="new_user_expiry"
                      value={String(newExpiry)}
                      onChange={(e) => setNewExpiry(Number(e.target.value))}
                    >
                      {EXPIRY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Note to include in the email (optional)" htmlFor="new_user_notes">
                    <textarea
                      id="new_user_notes"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      rows={3}
                      maxLength={2000}
                      placeholder="e.g. You'll get a Cloudflare email code first — enter it, then sign in."
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                    />
                  </FormField>
                </>
              )}
              <FormField label="Role" htmlFor="new_user_role">
                <Select
                  id="new_user_role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "admin" | "contributor" | "viewer")}
                >
                  <option value="admin">Admin</option>
                  <option value="contributor">Contributor</option>
                  <option value="viewer">Viewer</option>
                </Select>
              </FormField>
            </div>
          </RecordFormModal>
        )}

        {/* Edit user modal */}
        {editingUser && !resetTarget && (
          <RecordFormModal
            title="Edit User"
            submitLabel="Save"
            error={modalError || null}
            onClose={closeEdit}
            onSubmit={onSaveEdit}
          >
            <div className="flex flex-col gap-4">
              <FormField label="Display name" htmlFor="edit_full_name">
                <Input
                  id="edit_full_name"
                  type="text"
                  placeholder="Name (optional)"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
              </FormField>
              <FormField label="Role" htmlFor="edit_role">
                <Select
                  id="edit_role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as "admin" | "contributor" | "viewer")}
                >
                  <option value="admin">Admin</option>
                  <option value="contributor">Contributor</option>
                  <option value="viewer">Viewer</option>
                </Select>
              </FormField>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded border-border"
                />
                Active
              </label>
              {editingUser.id !== me?.id && editingUser.is_active && (
                <>
                  <hr className="border-border" />
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setResetExpiry(720);
                      setResetNotes("");
                      setModalError("");
                      setResetTarget(editingUser);
                    }}
                  >
                    Reset Password…
                  </Button>
                </>
              )}
            </div>
          </RecordFormModal>
        )}

        {/* Reset password confirm modal */}
        {resetTarget && (
          <RecordFormModal
            title="Reset Password"
            submitLabel="Send email"
            error={modalError || null}
            onClose={() => setResetTarget(null)}
            onSubmit={onSendReset}
          >
            <div className="flex flex-col gap-4">
              <p className="text-sm text-foreground">
                Send <span className="font-medium">{resetTarget.email}</span> a new temporary password?
              </p>
              <p className="text-sm text-destructive">
                Their current password and signed-in sessions stop working immediately.
              </p>
              <FormField label="Temporary password expires after" htmlFor="reset_expiry">
                <Select
                  id="reset_expiry"
                  value={String(resetExpiry)}
                  onChange={(e) => setResetExpiry(Number(e.target.value))}
                >
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Note to include in the email (optional)" htmlFor="reset_notes">
                <textarea
                  id="reset_notes"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  rows={3}
                  maxLength={2000}
                  value={resetNotes}
                  onChange={(e) => setResetNotes(e.target.value)}
                />
              </FormField>
            </div>
          </RecordFormModal>
        )}
      </PageLayout>
    </AppShell>
  );
}
