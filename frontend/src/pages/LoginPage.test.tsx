import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import LoginPage from "./LoginPage";

afterEach(() => vi.restoreAllMocks());

test("shows an error on failed login", async () => {
  vi.spyOn(global, "fetch").mockImplementation((url) => {
    if (String(url).endsWith("/api/auth/me")) return Promise.resolve(new Response(null, { status: 401 }));
    return Promise.resolve(new Response(null, { status: 401 }));
  });
  render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
  await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
  await userEvent.type(screen.getByLabelText(/password/i), "whatever-pass");
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/invalid/i));
});

test("shows the server's expired-temp-password message", async () => {
  vi.spyOn(global, "fetch").mockImplementation((url) => {
    if (String(url).endsWith("/api/auth/me")) return Promise.resolve(new Response(null, { status: 401 }));
    return Promise.resolve(
      new Response(
        JSON.stringify({ detail: "Temporary password expired — ask your administrator to send a new one." }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
  });
  render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
  await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
  await userEvent.type(screen.getByLabelText(/password/i), "whatever-pass");
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(/Temporary password expired/),
  );
});
