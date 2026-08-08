// frontend/src/components/GuestLayout.test.tsx
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GuestLayout from "./GuestLayout";
import { GuestProvider, useGuest } from "../auth/GuestContext";
import { ALL_SECTIONS } from "@/lib/section-labels";

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

  it("offers a Patient Summary button scoped to allowed sections", () => {
    render(
      <GuestProvider>
        <MemoryRouter>
          <SeedGuest sections={["doctors"]} />
          <GuestLayout><p>content</p></GuestLayout>
        </MemoryRouter>
      </GuestProvider>
    );
    expect(screen.getByRole("button", { name: /patient summary/i })).toBeInTheDocument();
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

  it("discloses that a scoped link is partial", () => {
    // Absence of a section button otherwise reads as absence of a condition:
    // a clinician scanning for allergies sees no Profile tab and concludes
    // there are none, when they exist and simply weren't shared.
    render(
      <GuestProvider>
        <MemoryRouter>
          <SeedGuest sections={["medications", "vitals"]} />
          <GuestLayout><p>content</p></GuestLayout>
        </MemoryRouter>
      </GuestProvider>
    );
    expect(screen.getByText(/partial record/i)).toBeInTheDocument();
    expect(screen.getByText(/2 of 16 sections/i)).toBeInTheDocument();
  });

  it("does not claim partial when every section was shared", () => {
    render(
      <GuestProvider>
        <MemoryRouter>
          <SeedGuest sections={ALL_SECTIONS} />
          <GuestLayout><p>content</p></GuestLayout>
        </MemoryRouter>
      </GuestProvider>
    );
    expect(screen.queryByText(/partial record/i)).not.toBeInTheDocument();
  });

  it("orders section buttons by clinical value, not share order", () => {
    render(
      <GuestProvider>
        <MemoryRouter>
          <SeedGuest sections={["nutrition_plan", "medications", "profile"]} />
          <GuestLayout><p>content</p></GuestLayout>
        </MemoryRouter>
      </GuestProvider>
    );
    const links = screen.getAllByRole("link").map((a) => a.textContent);
    const idx = (t: string) => links.findIndex((l) => l === t);
    expect(idx("Profile")).toBeLessThan(idx("Medications"));
    expect(idx("Medications")).toBeLessThan(idx("Nutrition Plan"));
  });
});
