import { useState, type FormEvent } from "react";
import { changePassword } from "../api/auth";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/form-field";

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
        title="Change Password"
        description="Update your account password."
      >
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mb-4 text-sm text-primary">
            {message}
          </p>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <Card>
            <CardContent className="pt-6">
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
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit">Update password</Button>
          </div>
        </form>
      </PageLayout>
    </AppShell>
  );
}
