import { useEffect, useState } from "react";
import { getAiSettings, updateAiSettings, testAiConnection } from "../api/settings";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";

export default function SettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    getAiSettings()
      .then((s) => {
        setEnabled(s.enabled);
        setBaseUrl(s.base_url ?? "");
        setModel(s.model ?? "");
      })
      .catch(() => setSaveStatus("Failed to load AI settings."));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveStatus("");
    try {
      await updateAiSettings({ enabled, base_url: baseUrl || null, model: model || null });
      setSaveStatus("Saved.");
    } catch {
      setSaveStatus("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestStatus("");
    try {
      const result = await testAiConnection();
      setTestStatus(result.detail);
    } catch {
      setTestStatus("Connection test failed.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <AppShell>
      <PageLayout
        title="AI Settings"
        description="Configure the provider for the AI chat feature. The endpoint must be a self-hosted, OpenAI-compatible server on your local network. Patient records never leave the local network."
      >
        <Card>
          <CardContent className="py-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">AI Assistant</h2>

            <div className="flex flex-col gap-4">
              <FormField label="Base URL" htmlFor="ai-base-url">
                <Input
                  id="ai-base-url"
                  type="text"
                  placeholder="http://localhost:1234/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </FormField>

              <FormField label="Model" htmlFor="ai-model">
                <Input
                  id="ai-model"
                  type="text"
                  placeholder="e.g. llama-3-8b-instruct"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </FormField>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="ai-enabled"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <label htmlFor="ai-enabled" className="text-sm text-foreground cursor-pointer">
                  Enable chat feature
                </label>
              </div>

              <p className="text-xs text-muted-foreground">
                Connects to an OpenAI-compatible server running on your local network (e.g., LM Studio).
                All queries and responses stay on your local network — patient records are never sent to
                external services.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? "Testing…" : "Test connection"}
                </Button>
                {saveStatus && (
                  <span className="text-sm text-muted-foreground">{saveStatus}</span>
                )}
              </div>

              {testStatus && (
                <p className="text-sm text-muted-foreground">{testStatus}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </PageLayout>
    </AppShell>
  );
}
