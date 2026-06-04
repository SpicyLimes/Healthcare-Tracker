import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./useAuth";

afterEach(() => vi.restoreAllMocks());

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <p>loading</p>;
  return <p>{user ? `user:${user.email}` : "anon"}</p>;
}

test("loads current user on mount", async () => {
  vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ id: "1", email: "a@b.com", role: "admin" })),
  );
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByText("user:a@b.com")).toBeInTheDocument());
});

test("shows anon when not authenticated (401)", async () => {
  vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByText("anon")).toBeInTheDocument());
});
