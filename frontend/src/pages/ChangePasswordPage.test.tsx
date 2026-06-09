// frontend/src/pages/ChangePasswordPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChangePasswordPage from "./ChangePasswordPage";
import * as authApi from "../api/auth";
import * as useAuthModule from "../auth/useAuth";

afterEach(() => vi.restoreAllMocks());

function mockAuth(fullName: string | null = null) {
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    user: { id: "u1", email: "a@b.c", role: "admin", full_name: fullName, timezone: "America/Chicago" },
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
      id: "u1", email: "a@b.c", role: "admin", full_name: "New Name", timezone: "America/Chicago",
    });
    render(<ChangePasswordPage />);
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: /save name/i }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith("New Name"));
  });

  it("calls updateName with null when saving empty string", async () => {
    mockAuth("Devin Rauch");
    const mockUpdate = vi.spyOn(authApi, "updateName").mockResolvedValue({
      id: "u1", email: "a@b.c", role: "admin", full_name: null, timezone: "America/Chicago",
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
      user: { id: "u1", email: "a@b.c", role: "viewer", full_name: null, timezone: "America/Los_Angeles" },
      login: vi.fn(), logout: vi.fn(), loading: false, setUser: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);
    render(<ChangePasswordPage />);
    const select = screen.getByLabelText(/your timezone/i) as HTMLSelectElement;
    expect(select.value).toBe("America/Los_Angeles");
  });

  it("calls updateTimezone with selected value on save", async () => {
    const setUser = vi.fn();
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      user: { id: "u1", email: "a@b.c", role: "admin", full_name: null, timezone: "America/Chicago" },
      login: vi.fn(), logout: vi.fn(), loading: false, setUser,
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);
    const mockUpdate = vi.spyOn(authApi, "updateTimezone").mockResolvedValue({
      id: "u1", email: "a@b.c", role: "admin", full_name: null, timezone: "America/New_York",
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
      user: { id: "u1", email: "a@b.c", role: "admin", full_name: null, timezone: "America/Chicago" },
      login: vi.fn(), logout: vi.fn(), loading: false, setUser: vi.fn(),
    } as unknown as ReturnType<typeof useAuthModule.useAuth>);
    vi.spyOn(authApi, "updateTimezone").mockResolvedValue({
      id: "u1", email: "a@b.c", role: "admin", full_name: null, timezone: "America/Chicago",
    });
    render(<ChangePasswordPage />);
    fireEvent.click(screen.getByRole("button", { name: /save timezone/i }));
    await waitFor(() => expect(screen.getByRole("status", { name: /timezone saved/i })).toBeInTheDocument());
  });
});
