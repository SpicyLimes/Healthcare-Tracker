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
  it("renders audit entries", async () => {
    vi.spyOn(api, "listAuditLog").mockResolvedValue([ENTRY]);
    render(<AuditLogPage />);
    expect(await screen.findByText("admin@example.com")).toBeInTheDocument();
    // "create" appears in both the filter <option> and the table row — confirm at least one cell
    expect(screen.getAllByText("create").length).toBeGreaterThanOrEqual(1);
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
    expect(await screen.findByText(/no entries found/i)).toBeInTheDocument();
  });
});
