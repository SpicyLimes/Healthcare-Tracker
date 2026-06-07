// frontend/src/pages/ChangePasswordPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChangePasswordPage from "./ChangePasswordPage";
import * as authApi from "../api/auth";
import * as useAuthModule from "../auth/useAuth";

afterEach(() => vi.restoreAllMocks());

function mockAuth(fullName: string | null = null) {
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    user: { id: "u1", email: "a@b.c", role: "admin", full_name: fullName },
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
      id: "u1", email: "a@b.c", role: "admin", full_name: "New Name",
    });
    render(<ChangePasswordPage />);
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: /save name/i }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith("New Name"));
  });

  it("calls updateName with null when saving empty string", async () => {
    mockAuth("Devin Rauch");
    const mockUpdate = vi.spyOn(authApi, "updateName").mockResolvedValue({
      id: "u1", email: "a@b.c", role: "admin", full_name: null,
    });
    render(<ChangePasswordPage />);
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save name/i }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(null));
  });
});
