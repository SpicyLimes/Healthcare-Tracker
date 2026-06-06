import { useEffect, useState, type FormEvent } from "react";
import { createUser, deleteUser, listUsers, type ManagedUser } from "../api/users";
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
  const [role, setRole] = useState<"admin" | "viewer">("viewer");
  const [error, setError] = useState("");

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
      await createUser(email, password, role);
      setEmail("");
      setPassword("");
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
          {/* Create user form (admin only) */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-heading text-sm font-medium text-foreground mb-4">
                Add user
              </h2>
              <form onSubmit={onCreate}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                      <option value="viewer">viewer</option>
                      <option value="admin">admin</option>
                    </Select>
                  </FormField>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button type="submit">Add user</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Users table */}
          <Card>
            <CardContent className="pt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="py-3 text-foreground">
                        {u.email}
                        {!u.is_active && (
                          <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
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
                      <td colSpan={3} className="py-6 text-center text-muted-foreground">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    </AppShell>
  );
}
