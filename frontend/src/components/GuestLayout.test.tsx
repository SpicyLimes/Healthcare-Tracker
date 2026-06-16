// frontend/src/components/GuestLayout.test.tsx
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GuestLayout from "./GuestLayout";
import { GuestProvider, useGuest } from "../auth/GuestContext";

vi.mock("../api/summary", () => ({
  generateSummary: vi.fn(),
  generateGuestSummary: vi.fn(),
  openSummaryInNewTab: vi.fn(),
}));

vi.mock("../api/guest", () => ({
  getGuestPatientName: vi.fn().mockResolvedValue("Test Patient"),
}));

function SeedGuest({ sections }: { sections: string[] }) {
  const { setGuest } = useGuest();
  useEffect(() => {
    setGuest("test-token", sections, "2099-01-01T00:00:00Z");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

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
    expect(screen.getByText(/read-only access/i)).toBeInTheDocument();
  });

  it("renders children when not expired", () => {
    renderWithGuest(<GuestLayout><p>Hello guest</p></GuestLayout>);
    expect(screen.getByText("Hello guest")).toBeInTheDocument();
  });

  it("offers a Patient Summary Report button scoped to allowed sections", () => {
    render(
      <GuestProvider>
        <MemoryRouter>
          <SeedGuest sections={["doctors"]} />
          <GuestLayout><p>content</p></GuestLayout>
        </MemoryRouter>
      </GuestProvider>
    );
    expect(screen.getByRole("button", { name: /patient summary report/i })).toBeInTheDocument();
  });

  it("shows re-enter-URL guidance on the expired page", () => {
    renderWithGuest(<GuestLayout expired>{null}</GuestLayout>);
    expect(screen.getByText(/already have your link/i)).toBeInTheDocument();
    expect(screen.getByText(/re-enter the original link/i)).toBeInTheDocument();
  });

  it("shows the privacy footer on an active guest page", () => {
    renderWithGuest(<GuestLayout><p>content</p></GuestLayout>);
    expect(screen.getByText(/this link isn't saved in your browser/i)).toBeInTheDocument();
  });
});
