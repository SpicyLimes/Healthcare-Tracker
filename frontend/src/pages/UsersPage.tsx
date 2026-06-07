import { useEffect, useState, type FormEvent } from "react";
import { createUser, deleteUser, listUsers, updateUser, type ManagedUser } from "../api/users";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField, Input, Select } from "@/components/ui/form-field";

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "viewer">("viewer");
  const [error, setError] = useState("");

  // Edit modal state
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "viewer">("viewer");
  const [editActive, setEditActive] = useState(true);
  const [editError, setEditError] = useState("");

  async function reload() {
    setUsers(await listUsers());
  }

  useEffect(() => {
    reload().catch(() => setError("Failed to load users"));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await createUser(email, password, role, name.trim() || null);
      setEmail("");
      setPassword("");
      setName("");
      await reload();
    } catch {
      setError("Could not create user");
    }
  }

  async function onDelete(id: string) {
    setError("");
    try {
      await deleteUser(id);
      await reload();
    } catch {
      setError("Could not delete user");
    }
  }

  function openEdit(u: ManagedUser) {
    setEditingUser(u);
    setEditName(u.full_name ?? "");
    setEditRole(u.role);
    setEditActive(u.is_active);
    setEditError("");
  }

  function closeEdit() {
    setEditingUser(null);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditError("");
    try {
      await updateUser(editingUser.id, {
        full_name: editName.trim() || null,
        role: editRole,
        is_active: editActive,
      });
      closeEdit();
      await reload();
    } catch {
      setEditError("Could not update user");
    }
  }

  return (
    <AppShell>
      <PageLayout
        title="Manage Users"
        description="Admin user accounts and roles."
      >
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-6">
          {/* Users table */}
          <Card>
            <CardContent className="pt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="py-3 text-foreground">
                        {u.full_name ?? "—"}
                      </td>
                      <td className="py-3 text-foreground">
                        {u.email}
                        {!u.is_active && (
                          <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                          {u.role === "admin" ? "Admin" : "Viewer"}
                        </Badge>
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(u)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onDelete(u.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Create user form (admin only) */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-heading text-sm font-medium text-foreground mb-4">
                Add user
              </h2>
              <form onSubmit={onCreate}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Email" htmlFor="new_user_email">
                    <Input
                      id="new_user_email"
                      type="email"
                      placeholder="user@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </FormField>

                  <FormField label="Name (optional)" htmlFor="new_user_name">
                    <Input
                      id="new_user_name"
                      type="text"
                      placeholder="Full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </FormField>

                  <FormField label="Password" htmlFor="new_user_password">
                    <Input
                      id="new_user_password"
                      type="password"
                      placeholder="Min 12 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={12}
                    />
                  </FormField>

                  <FormField label="Role" htmlFor="new_user_role">
                    <Select
                      id="new_user_role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as "admin" | "viewer")}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </Select>
                  </FormField>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button type="submit">Add user</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Edit modal */}
        {editingUser && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-heading"
            onKeyDown={(e) => e.key === "Escape" && closeEdit()}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={closeEdit}
          >
            <div
              className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="edit-user-heading" className="font-heading text-base font-semibold text-foreground mb-4">
                Edit user
              </h2>
              {editError && (
                <p role="alert" className="mb-4 text-sm text-destructive">
                  {editError}
                </p>
              )}
              <form onSubmit={onSaveEdit}>
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

                <div className="mt-6 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeEdit}>
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </PageLayout>
    </AppShell>
  );
}
