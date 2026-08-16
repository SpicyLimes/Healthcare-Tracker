// frontend/src/pages/BackupsPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Page (and AppShell's sidebar) call useAuth, which throws outside AuthProvider.
const logoutMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "admin@example.com", role: "admin", timezone: "America/Chicago" },
    loading: false,
    login: vi.fn(),
    logout: logoutMock,
    setUser: vi.fn(),
  }),
}));

import BackupsPage from "./BackupsPage";
import * as api from "../api/backups";

afterEach(() => vi.restoreAllMocks());

const NIGHTLY: api.Backup = {
  id: "2026-07-12",
  type: "nightly",
  created_at: new Date().toISOString(),
  size_bytes: 1024 * 1024 * 3,
  complete: true,
};

describe("BackupsPage", () => {
  it("renders the backup table with type and size", async () => {
    vi.spyOn(api, "listBackups").mockResolvedValue([NIGHTLY]);
    render(<BackupsPage />);
    expect((await screen.findAllByText("2026-07-12"))[0]).toBeInTheDocument();
    expect(screen.getAllByText("Nightly")[0]).toBeInTheDocument();
    expect(screen.getAllByText("3.0 MB")[0]).toBeInTheDocument();
  });

  it("Backup Now calls createBackup and reloads", async () => {
    const list = vi.spyOn(api, "listBackups").mockResolvedValue([]);
    const create = vi.spyOn(api, "createBackup").mockResolvedValue({ ...NIGHTLY, id: "manual-x", type: "manual" });
    render(<BackupsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /backup now/i }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("restore is gated behind typing the backup name", async () => {
    vi.spyOn(api, "listBackups").mockResolvedValue([NIGHTLY]);
    const restore = vi.spyOn(api, "restoreBackup").mockResolvedValue({ safety_backup_id: "safety-x" });
    render(<BackupsPage />);
    await screen.findAllByText("2026-07-12");
    fireEvent.click(screen.getByRole("button", { name: /more details for 2026-07-12/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^restore$/i }));
    const confirmBtn = await screen.findByRole("button", { name: /restore backup/i });
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("2026-07-12"), { target: { value: "2026-07-12" } });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(restore).toHaveBeenCalledWith("2026-07-12", "2026-07-12"));
  });

  it("puts Cancel before Restore Backup in the confirm dialog", async () => {
    // Canon app-wide is Cancel -> primary action. Reversed, the destructive
    // button (it replaces the whole database) sits where muscle memory
    // expects Cancel.
    vi.spyOn(api, "listBackups").mockResolvedValue([NIGHTLY]);
    render(<BackupsPage />);
    await screen.findAllByText("2026-07-12");
    fireEvent.click(screen.getByRole("button", { name: /more details for 2026-07-12/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^restore$/i }));

    const dialog = await screen.findByRole("dialog", { name: /confirm restore/i });
    const labels = Array.from(dialog.querySelectorAll("button")).map((b) => b.textContent?.trim());
    expect(labels).toEqual(["Cancel", "Restore Backup"]);
  });

  it("delete asks for confirmation", async () => {
    vi.spyOn(api, "listBackups").mockResolvedValue([NIGHTLY]);
    const del = vi.spyOn(api, "deleteBackup").mockResolvedValue();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<BackupsPage />);
    await screen.findAllByText("2026-07-12");
    fireEvent.click(screen.getByRole("button", { name: /more details for 2026-07-12/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("2026-07-12"));
  });
});
