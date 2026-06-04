import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProfilePage from "./ProfilePage";
import * as profileApi from "../api/profile";
import * as useAuthModule from "../auth/useAuth";

afterEach(() => vi.restoreAllMocks());

function mockAuth(role: "admin" | "viewer") {
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    user: { id: "u1", email: "a@b.c", role },
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);
}

describe("ProfilePage", () => {
  it("loads and shows existing profile", async () => {
    mockAuth("viewer");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane Doe", date_of_birth: null, blood_type: "O+",
      allergies: null, emergency_contacts: null, primary_language: null, notes: null,
    });
    render(<ProfilePage />);
    await waitFor(() => expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Jane Doe"));
  });

  it("viewer has no Save button", async () => {
    mockAuth("viewer");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue(null);
    render(<ProfilePage />);
    await screen.findByLabelText("Full name");
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });

  it("admin can save the profile", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue(null);
    const save = vi.spyOn(profileApi, "saveProfile").mockResolvedValue({
      id: "1", full_name: "Jane Doe", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null, notes: null,
    });
    render(<ProfilePage />);
    fireEvent.change(await screen.findByLabelText("Full name"), { target: { value: "Jane Doe" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ full_name: "Jane Doe" })));
  });
});
