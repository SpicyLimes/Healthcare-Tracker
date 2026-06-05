// frontend/src/components/GuestLayout.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GuestLayout from "./GuestLayout";
import { GuestProvider } from "../auth/GuestContext";

function renderWithGuest(ui: React.ReactNode) {
  return render(
    <GuestProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </GuestProvider>
  );
}

describe("GuestLayout", () => {
  it("shows expired message when expired prop is true", () => {
    renderWithGuest(<GuestLayout expired>{null}</GuestLayout>);
    expect(screen.getByText(/link expired or revoked/i)).toBeInTheDocument();
  });

  it("shows read-only header when not expired", () => {
    renderWithGuest(<GuestLayout>{<p>content</p>}</GuestLayout>);
    expect(screen.getByText(/read only access/i)).toBeInTheDocument();
  });

  it("renders children when not expired", () => {
    renderWithGuest(<GuestLayout><p>Hello guest</p></GuestLayout>);
    expect(screen.getByText("Hello guest")).toBeInTheDocument();
  });
});
