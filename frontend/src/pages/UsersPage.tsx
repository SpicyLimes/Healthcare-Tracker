import { useEffect, useState, type FormEvent } from "react";
import { createUser, deleteUser, listUsers, updateUser, type ManagedUser } from "../api/users";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";
import { formatDate } from "@/lib/format";

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");

  // Add modal state
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");

  // Edit modal state
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "viewer">("viewer");
  const [editActive, setEditActive] = useState(true);

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
    setModalError("");
    setAddOpen(true);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setModalError("");
    try {
      await createUser(newEmail, newPassword, newRole, newName.trim() || null);
      setAddOpen(false);
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
                    </span>
                  ),
                },
                {
                  header: "Role",
                  sortKey: "role",
                  render: (r) => (
                    <Badge variant={r.role === "admin" ? "default" : "secondary"}>
                      {r.role === "admin" ? "Admin" : "Viewer"}
                    </Badge>
                  ),
                },
              ]}
              detailTitle={(r) => r.full_name ?? r.email}
              detailFields={(r) => [
                { label: "Name", value: r.full_name ?? null },
                { label: "Email", value: r.email },
                { label: "Role", value: r.role === "admin" ? "Admin" : "Viewer" },
                { label: "Active", value: r.is_active ? "Yes" : "No" },
                { label: "Created", value: formatDate(r.created_at) },
              ]}
              getHeadline={(r) => r.email}
              getSubtitle={(r) => r.full_name ?? null}
              getBadge={(r) => ({
                label: r.role === "admin" ? "Admin" : "Viewer",
                variant: r.role === "admin" ? "default" : "secondary",
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
              <FormField label="Role" htmlFor="new_user_role">
                <Select
                  id="new_user_role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "admin" | "viewer")}
                >
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </Select>
              </FormField>
            </div>
          </RecordFormModal>
        )}

        {/* Edit user modal */}
        {editingUser && (
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
                  onChange={(e) => setEditRole(e.target.value as "admin" | "viewer")}
                >
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
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
            </div>
          </RecordFormModal>
        )}
      </PageLayout>
    </AppShell>
  );
}
