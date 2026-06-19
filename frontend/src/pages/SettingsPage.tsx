import { useEffect, useState } from "react";
import { getAiSettings, updateAiSettings, testAiConnection, listAiModels } from "../api/settings";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";

export default function SettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(() => {
    getAiSettings()
      .then((s) => {
        setEnabled(s.enabled);
        setBaseUrl(s.base_url ?? "");
        setModel(s.model ?? "");
        if (s.base_url) {
          listAiModels().then(setAvailableModels).catch(() => {});
        }
      })
      .catch(() => setSaveStatus("Failed to load AI settings."));
  }, []);

  async function handleRefreshModels() {
    setModelsLoading(true);
    try {
      const models = await listAiModels();
      setAvailableModels(models);
      if (models.length === 0) setSaveStatus("No models returned — check Base URL.");
      else setSaveStatus("");
    } catch {
      setSaveStatus("Could not fetch models.");
    } finally {
      setModelsLoading(false);
    }
  }

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
        <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="py-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">AI Assistant</h2>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                {availableModels.length > 0 ? (
                  <div className="flex gap-2">
                    <Select
                      id="ai-model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="flex-1"
                    >
                      {!availableModels.includes(model) && model && (
                        <option value={model}>{model}</option>
                      )}
                      {availableModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshModels}
                      disabled={modelsLoading}
                      title="Refresh model list from provider"
                    >
                      {modelsLoading ? "…" : "↻"}
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="ai-model"
                      type="text"
                      placeholder="e.g. llama-3-8b-instruct"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="flex-1"
                    />
                    {baseUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshModels}
                        disabled={modelsLoading}
                        title="Fetch available models from provider"
                      >
                        {modelsLoading ? "…" : "Fetch models"}
                      </Button>
                    )}
                  </div>
                )}
              </FormField>
              </div>

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

        {/* Provider Setup Guide */}
        <Card>
          <CardContent className="py-6">
            <h2 className="mb-1 text-base font-semibold text-foreground">Provider Setup Guide</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              The AI assistant works with any OpenAI-compatible endpoint. Choose whichever option fits your setup.
            </p>

            <div className="flex flex-col gap-5 text-sm">

              {/* Provider table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Provider</th>
                      <th className="pb-2 pr-4 font-medium">Best for</th>
                      <th className="pb-2 font-medium">Example Base URL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    <tr>
                      <td className="py-2 pr-4 font-medium">LM Studio</td>
                      <td className="py-2 pr-4 text-muted-foreground">Local, GUI-based model management</td>
                      <td className="py-2 font-mono text-[0.7rem]">http://host.docker.internal:1234/v1</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">Ollama (same stack)</td>
                      <td className="py-2 pr-4 text-muted-foreground">Bundled with this app's Compose stack</td>
                      <td className="py-2 font-mono text-[0.7rem]">http://ollama:11434/v1</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">Ollama (separate container)</td>
                      <td className="py-2 pr-4 text-muted-foreground">Ollama running on the same host, separate stack</td>
                      <td className="py-2 font-mono text-[0.7rem]">http://host.docker.internal:11434/v1</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">OpenRouter</td>
                      <td className="py-2 pr-4 text-muted-foreground">Cloud, no local hardware needed</td>
                      <td className="py-2 font-mono text-[0.7rem]">https://openrouter.ai/api/v1</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">OpenAI</td>
                      <td className="py-2 pr-4 text-muted-foreground">Cloud (records leave your network)</td>
                      <td className="py-2 font-mono text-[0.7rem]">https://api.openai.com/v1</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Linux note */}
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                <strong>Linux hosts:</strong> <code className="font-mono">host.docker.internal</code> does not resolve by default on Linux Docker.
                Add <code className="font-mono">extra_hosts: ["host.docker.internal:host-gateway"]</code> to the <code className="font-mono">backend</code> service
                in your Compose file, or use your host's LAN IP directly.
              </p>

              {/* Ollama same-stack snippet */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-foreground">
                  Adding Ollama to this app's Compose stack
                </p>
                <p className="mb-2 text-xs text-muted-foreground">
                  Append the following to your <code className="font-mono text-[0.7rem]">docker-compose.yml</code> (or Portainer stack YAML), then set Base URL above to{" "}
                  <code className="font-mono text-[0.7rem]">http://ollama:11434/v1</code>.
                  Verify image names and options against the{" "}
                  <a
                    href="https://hub.docker.com/r/ollama/ollama"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Ollama Docker documentation
                  </a>.
                </p>
                <pre className="overflow-x-auto rounded-md bg-muted px-4 py-3 text-[0.7rem] leading-relaxed text-foreground">{`  ollama:
    image: ollama/ollama
    restart: unless-stopped
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_KEEP_ALIVE=10m   # unload model after 10 min idle
    # GPU (NVIDIA) — remove this block for CPU-only:
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

volumes:
  ollama_data:`}</pre>
                <p className="mt-2 text-xs text-muted-foreground">
                  After starting the stack, pull a model once:{" "}
                  <code className="font-mono text-[0.7rem]">docker exec -it &lt;ollama-container&gt; ollama pull llama3.2:3b</code>
                </p>
              </div>

              {/* Ollama separate-container snippet */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-foreground">
                  Running Ollama in a separate container on the same host
                </p>
                <p className="mb-2 text-xs text-muted-foreground">
                  Run Ollama independently, then point Base URL at your host's LAN IP or use{" "}
                  <code className="font-mono text-[0.7rem]">host.docker.internal</code> (Linux: requires the extra_hosts note above).
                </p>
                <pre className="overflow-x-auto rounded-md bg-muted px-4 py-3 text-[0.7rem] leading-relaxed text-foreground">{`docker run -d \\
  --name ollama \\
  -p 11434:11434 \\
  -v ollama_data:/root/.ollama \\
  ollama/ollama

# Then pull a model:
docker exec ollama ollama pull llama3.2:3b`}</pre>
                <p className="mt-2 text-xs text-muted-foreground">
                  Set Base URL to <code className="font-mono text-[0.7rem]">http://&lt;your-host-ip&gt;:11434/v1</code> or{" "}
                  <code className="font-mono text-[0.7rem]">http://host.docker.internal:11434/v1</code>.
                </p>
              </div>

              {/* Model requirements note */}
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Model requirements:</strong> Any model works for Q&amp;A. Record creation, editing, and deletion require a model with <strong>tool/function calling</strong> support. Document parsing (future) will additionally require <strong>vision</strong> support.
                Good small options: <code className="font-mono text-[0.7rem]">llama3.2:3b</code>, <code className="font-mono text-[0.7rem]">qwen2.5:3b</code>, <code className="font-mono text-[0.7rem]">phi3:mini</code>.
              </p>

            </div>
          </CardContent>
        </Card>

        </div>
      </PageLayout>
    </AppShell>
  );
}
