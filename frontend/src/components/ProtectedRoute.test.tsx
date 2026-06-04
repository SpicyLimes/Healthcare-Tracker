import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthContext } from "../auth/AuthContext";
import ProtectedRoute from "./ProtectedRoute";

function renderWithAuth(user: { id: string; email: string; role: "admin" | "viewer" } | null) {
  return render(
    <AuthContext.Provider value={{ user, loading: false, login: async () => {}, logout: async () => {} }}>
      <MemoryRouter initialEntries={["/secret"]}>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/secret" element={<ProtectedRoute><p>secret content</p></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

test("renders children when authenticated", () => {
  renderWithAuth({ id: "1", email: "a@b.com", role: "admin" });
  expect(screen.getByText("secret content")).toBeInTheDocument();
});

test("redirects to login when unauthenticated", () => {
  renderWithAuth(null);
  expect(screen.getByText("login page")).toBeInTheDocument();
});
