import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "./HomePage";
import * as useAuthModule from "../auth/useAuth";
import * as healthApi from "../api/health";

afterEach(() => vi.restoreAllMocks());

function mockAuth(role: "admin" | "viewer") {
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    user: { id: "u1", email: "a@b.c", role },
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);
}

describe("HomePage navigation", () => {
  it("shows record section links for all users", async () => {
    mockAuth("viewer");
    vi.spyOn(healthApi, "fetchHealth").mockRejectedValue(new Error("no"));
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getAllByRole("link", { name: /profile/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /medications/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /doctors/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /ailment/i })[0]).toBeInTheDocument();
  });
});
