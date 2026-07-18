// frontend/src/pages/ChangePasswordPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChangePasswordPage from "./ChangePasswordPage";
import * as authApi from "../api/auth";
import * as useAuthModule from "../auth/useAuth";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

afterEach(() => vi.restoreAllMocks());

const baseMe = { id: "u1", email: "a@b.c", role: "admin" as const, full_name: null, timezone: "America/Chicago", must_change_password: false };

function mockAuth(fullName: string | null = null, extra: Partial<typeof baseMe> = {}) {
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    user: { ...baseMe, full_name: fullName, ...extra },
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
    setUser: vi.fn(),
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);
}

describe("ChangePasswordPage — Display Name", () => {
  it("shows display name input pre-populated from user.full_name", () => {
    mockAuth("Devin Rauch");
    render(<ChangePasswordPage />);
    const input = screen.getByLabelText(/display name/i) as HTMLInputElement;
    expect(input.value).toBe("Devin Rauch");
  });

  it("shows empty input when full_name is null", () => {
    mockAuth(null);
    render(<ChangePasswordPage />);
    const input = screen.getByLabelText(/display name/i) as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("calls updateName with the entered value on save", async () => {
    mockAuth(null);
    const mockUpdate = vi.spyOn(authApi, "updateName").mockResolvedValue({
      id: "u1", email: "a@b.c", role: "admin", full_name: "New Name", timezone: "America/Chicago", must_change_password: false,
    });
    render(<ChangePasswordPage />);
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: /save name/i }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith("New Name"));
  });

  it("calls updateName with null when saving empty string", async () => {
    mockAuth("Devin Rauch");
    const mockUpdate = vi.spyOn(authApi, "updateName").mockResolvedValue({
      id: "u1", email: "a@b.c", role: "admin", full_name: null, timezone: "America/Chicago", must_change_password: false,
    });
    render(<ChangePasswordPage />);
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save name/i }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(null));
  });
});

describe("ChangePasswordPage — Timezone", () => {
  it("shows timezone select pre-populated from user.timezone", () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      user: { id: "u1", email: "a@b.c", role: "viewer", full_name: null, timezone: "America/Los_Angeles", must_change_password: false },
      login: vi.fn(), logout: vi.fn(), loading: false, setUser: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);
    render(<ChangePasswordPage />);
    const select = screen.getByLabelText(/your timezone/i) as HTMLSelectElement;
    expect(select.value).toBe("America/Los_Angeles");
  });

  it("calls updateTimezone with selected value on save", async () => {
    const setUser = vi.fn();
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      user: { id: "u1", email: "a@b.c", role: "admin", full_name: null, timezone: "America/Chicago", must_change_password: false },
      login: vi.fn(), logout: vi.fn(), loading: false, setUser,
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);
    const mockUpdate = vi.spyOn(authApi, "updateTimezone").mockResolvedValue({
      id: "u1", email: "a@b.c", role: "admin", full_name: null, timezone: "America/New_York", must_change_password: false,
    });
    render(<ChangePasswordPage />);
    fireEvent.change(screen.getByLabelText(/your timezone/i), {
      target: { value: "America/New_York" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save timezone/i }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith("America/New_York"));
    await waitFor(() => expect(setUser).toHaveBeenCalled());
  });

  it("shows success message after saving timezone", async () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      user: { id: "u1", email: "a@b.c", role: "admin", full_name: null, timezone: "America/Chicago", must_change_password: false },
      login: vi.fn(), logout: vi.fn(), loading: false, setUser: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);
    vi.spyOn(authApi, "updateTimezone").mockResolvedValue({
      id: "u1", email: "a@b.c", role: "admin", full_name: null, timezone: "America/Chicago", must_change_password: false,
    });
    render(<ChangePasswordPage />);
    fireEvent.click(screen.getByRole("button", { name: /save timezone/i }));
    await waitFor(() => expect(screen.getByRole("status", { name: /timezone saved/i })).toBeInTheDocument());
  });
});

describe("ChangePasswordPage — forced mode", () => {
  it("forced mode shows banner, hides name/timezone, relabels the field", () => {
    mockAuth(null, { must_change_password: true });
    render(<ChangePasswordPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/temporary password/i);
    expect(screen.queryByText(/Display Name/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Timezone/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Temporary Password/i)).toBeInTheDocument();
  });

  it("normal mode keeps all three sections", () => {
    mockAuth(null, { must_change_password: false });
    render(<ChangePasswordPage />);
    expect(screen.getByRole("heading", { name: "Display Name" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Current Password/i)).toBeInTheDocument();
  });

  it("forced mode refreshes the user and navigates home after a change", async () => {
    mockAuth(null, { must_change_password: true });
    vi.spyOn(authApi, "changePassword").mockResolvedValueOnce(undefined);
    vi.spyOn(authApi, "getMe").mockResolvedValueOnce({ ...baseMe, must_change_password: false });
    render(<ChangePasswordPage />);
    fireEvent.change(screen.getByLabelText(/temporary password/i), { target: { value: "old-temp-pass" } });
    fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: "a-new-strong-pass" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "a-new-strong-pass" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true }));
  });
});
