// frontend/src/pages/AuditLogPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AuditLogPage from "./AuditLogPage";
import * as api from "../api/auditLog";

afterEach(() => vi.restoreAllMocks());

const ENTRY: api.AuditLogEntry = {
  id: 1,
  timestamp: "2026-06-04T10:00:00Z",
  action: "create",
  actor_type: "user",
  actor_label: "admin@example.com",
  section: "vaccinations",
  record_id: "r1",
  detail: "Created record in vaccinations",
};

describe("AuditLogPage", () => {
  const AI_ENTRY: api.AuditLogEntry = {
    id: 2,
    timestamp: "2026-06-04T11:00:00Z",
    action: "ai_query",
    actor_type: "user",
    actor_label: "admin@example.com",
    section: "ai_chat",
    record_id: null,
    detail: "Q: what meds am I on | tools: get_section_records",
  };

  it("renders audit entries", async () => {
    vi.spyOn(api, "listAuditLog").mockResolvedValue([ENTRY]);
    render(<AuditLogPage />);
    expect(await screen.findByText("admin@example.com")).toBeInTheDocument();
    // "Create" appears in both the filter <option> and the table row — confirm at least one cell
    expect(screen.getAllByText("Create").length).toBeGreaterThanOrEqual(1);
  });

  it("capitalizes AI in the action filter, the action badge and the section", async () => {
    vi.spyOn(api, "listAuditLog").mockResolvedValue([AI_ENTRY]);
    render(<AuditLogPage />);
    // Filter <option> + the row badge both read "AI Query", never "Ai Query"
    await waitFor(() => expect(screen.getAllByText("AI Query").length).toBeGreaterThanOrEqual(2));
    expect(screen.queryByText(/Ai Query/)).not.toBeInTheDocument();
    expect(screen.getByText("AI Chat")).toBeInTheDocument();
  });

  it("formats the action, actor type, section and tool list in the detail modal", async () => {
    vi.spyOn(api, "listAuditLog").mockResolvedValue([AI_ENTRY]);
    render(<AuditLogPage />);
    fireEvent.click(await screen.findByRole("button", { name: /more details/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("AI Query — admin@example.com");
    expect(dialog).toHaveTextContent("User");
    expect(dialog).toHaveTextContent("AI Chat");
    expect(dialog).toHaveTextContent("Tools: Get Section Records");
    expect(dialog).not.toHaveTextContent("tools: get_section_records");
  });

  it("action filter calls API with action param", async () => {
    const spy = vi.spyOn(api, "listAuditLog").mockResolvedValue([]);
    render(<AuditLogPage />);
    await screen.findByText("Audit Log");
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "delete" } });
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ action: "delete" })));
  });

  it("shows empty state when no entries", async () => {
    vi.spyOn(api, "listAuditLog").mockResolvedValue([]);
    render(<AuditLogPage />);
    expect(await screen.findByText(/no audit log entries/i)).toBeInTheDocument();
  });
});
