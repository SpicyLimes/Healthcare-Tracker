import { useState, type FormEvent } from "react";
import { changePassword, updateName } from "../api/auth";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/form-field";

export default function ChangePasswordPage() {
  const { user, setUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.full_name ?? "");
  const [nameMessage, setNameMessage] = useState("");
  const [nameError, setNameError] = useState("");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSaveName(e: FormEvent) {
    e.preventDefault();
    setNameMessage("");
    setNameError("");
    try {
      const updated = await updateName(displayName.trim() || null);
      setUser(updated);
      setNameMessage("Display name saved.");
    } catch {
      setNameError("Could not save display name.");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    try {
      await changePassword(current, next);
      setMessage("Password changed.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setError("Could not change password.");
    }
  }

  return (
    <AppShell>
      <PageLayout
        title="Settings"
        description="Manage your display name and password."
      >
        <Card>
          <CardContent className="pt-6 flex flex-col gap-0">
            {/* Display Name */}
            <form onSubmit={onSaveName}>
              <h2 className="font-heading text-sm font-medium text-foreground mb-4">
                Display Name
              </h2>
              {nameError && (
                <p role="alert" className="mb-4 text-sm text-destructive">{nameError}</p>
              )}
              {nameMessage && (
                <p role="status" className="mb-4 text-sm text-primary">{nameMessage}</p>
              )}
              <div className="flex flex-col gap-4 max-w-sm">
                <FormField label="Display name" htmlFor="display_name">
                  <Input
                    id="display_name"
                    type="text"
                    placeholder="Your name (optional)"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </FormField>
              </div>
              <div className="mt-4 flex justify-end max-w-sm">
                <Button type="submit">Save name</Button>
              </div>
            </form>

            <hr className="my-6 border-border" />

            {/* Change Password */}
            <form onSubmit={onSubmit}>
              <h2 className="font-heading text-sm font-medium text-foreground mb-4">
                Change Password
              </h2>
              {error && (
                <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>
              )}
              {message && (
                <p role="status" className="mb-4 text-sm text-primary">{message}</p>
              )}
              <div className="flex flex-col gap-4 max-w-sm">
                <FormField label="Current password" htmlFor="current_password">
                  <Input
                    id="current_password"
                    type="password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    required
                  />
                </FormField>
                <FormField label="New password (min 12 chars)" htmlFor="new_password">
                  <Input
                    id="new_password"
                    type="password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    required
                    minLength={12}
                  />
                </FormField>
                <FormField label="Confirm new password" htmlFor="confirm_password">
                  <Input
                    id="confirm_password"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={12}
                  />
                </FormField>
              </div>
              <div className="mt-4 flex justify-end max-w-sm">
                <Button type="submit">Update password</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </PageLayout>
    </AppShell>
  );
}
