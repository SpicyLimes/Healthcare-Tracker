// frontend/src/pages/UsersPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UsersPage from "./UsersPage";
import * as usersApi from "../api/users";
import * as useAuthModule from "../auth/useAuth";

afterEach(() => vi.restoreAllMocks());

function mockAuth() {
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    user: { id: "u1", email: "admin@example.com", role: "admin", full_name: null },
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
    setUser: vi.fn(),
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);
}

const MOCK_USERS = [
  { id: "u1", email: "admin@example.com", role: "admin" as const, full_name: "Admin User", is_active: true, created_at: "2026-01-01T00:00:00Z" },
  { id: "u2", email: "carol@example.com", role: "viewer" as const, full_name: null, is_active: true, created_at: "2026-01-02T00:00:00Z" },
];

describe("UsersPage", () => {
  it("renders Name column header", async () => {
    mockAuth();
    vi.spyOn(usersApi, "listUsers").mockResolvedValue(MOCK_USERS);
    render(<UsersPage />);
    expect(await screen.findByText("Name")).toBeInTheDocument();
  });

  it("shows full_name in Name column", async () => {
    mockAuth();
    vi.spyOn(usersApi, "listUsers").mockResolvedValue(MOCK_USERS);
    render(<UsersPage />);
    expect(await screen.findByText("Admin User")).toBeInTheDocument();
  });

  it("shows em dash for users without a name", async () => {
    mockAuth();
    vi.spyOn(usersApi, "listUsers").mockResolvedValue(MOCK_USERS);
    render(<UsersPage />);
    await screen.findByText("Admin User");
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("opens edit modal with pre-populated fields when Edit is clicked", async () => {
    mockAuth();
    vi.spyOn(usersApi, "listUsers").mockResolvedValue(MOCK_USERS);
    render(<UsersPage />);
    const editButtons = await screen.findAllByRole("button", { name: /edit/i });
    fireEvent.click(editButtons[0]);
    expect(screen.getByLabelText(/display name/i)).toHaveValue("Admin User");
  });

  it("calls updateUser with correct payload on modal submit", async () => {
    mockAuth();
    vi.spyOn(usersApi, "listUsers").mockResolvedValue(MOCK_USERS);
    const mockUpdate = vi.spyOn(usersApi, "updateUser").mockResolvedValue(MOCK_USERS[0]);
    render(<UsersPage />);
    const editButtons = await screen.findAllByRole("button", { name: /edit/i });
    fireEvent.click(editButtons[0]);
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith("u1", expect.objectContaining({ full_name: "New Name" }))
    );
  });

  it("closes the modal when Cancel is clicked", async () => {
    mockAuth();
    vi.spyOn(usersApi, "listUsers").mockResolvedValue(MOCK_USERS);
    render(<UsersPage />);
    const editButtons = await screen.findAllByRole("button", { name: /edit/i });
    fireEvent.click(editButtons[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
