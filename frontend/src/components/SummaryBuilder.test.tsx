import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SummaryBuilder from "./SummaryBuilder";
import { AppShell } from "./app-shell";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "@/auth/AuthContext";

vi.mock("../api/summary", () => ({
  generateSummary: vi.fn().mockResolvedValue("<html>ok</html>"),
  generateGuestSummary: vi.fn().mockResolvedValue("<html>ok</html>"),
  openSummaryInNewTab: vi.fn(),
}));

describe("SummaryBuilder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a trigger button and opens the modal", () => {
    render(<SummaryBuilder mode="admin" availableSections={["doctors", "medications"]} />);
    fireEvent.click(screen.getByRole("button", { name: /patient summary/i }));
    expect(screen.getByText(/build a summary/i)).toBeInTheDocument();
  });

  it("only offers the sections it was given (guest scoping)", () => {
    render(<SummaryBuilder mode="guest" token="t" availableSections={["doctors"]} />);
    fireEvent.click(screen.getByRole("button", { name: /patient summary/i }));
    expect(screen.getByLabelText(/doctors/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/medications/i)).not.toBeInTheDocument();
  });

  it("calls the guest API with the token when in guest mode", async () => {
    const { generateGuestSummary } = await import("../api/summary");
    render(<SummaryBuilder mode="guest" token="tok123" availableSections={["doctors"]} />);
    fireEvent.click(screen.getByRole("button", { name: /patient summary/i }));
    fireEvent.click(screen.getByLabelText(/doctors/i));
    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
    expect(generateGuestSummary).toHaveBeenCalledWith(
      expect.objectContaining({ sections: ["doctors"] }),
      "tok123",
    );
  });

  it("passes the selected date range through to the API", async () => {
    const { generateSummary } = await import("../api/summary");
    render(<SummaryBuilder mode="admin" availableSections={["doctors"]} />);
    fireEvent.click(screen.getByRole("button", { name: /patient summary/i }));
    fireEvent.click(screen.getByLabelText(/doctors/i));
    fireEvent.change(screen.getByLabelText(/from date/i), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText(/to date/i), { target: { value: "2026-06-30" } });
    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
    expect(generateSummary).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: "2026-01-01", date_to: "2026-06-30" }),
    );
  });

  it("sends null dates when the range is left empty", async () => {
    const { generateSummary } = await import("../api/summary");
    render(<SummaryBuilder mode="admin" availableSections={["doctors"]} />);
    fireEvent.click(screen.getByRole("button", { name: /patient summary/i }));
    fireEvent.click(screen.getByLabelText(/doctors/i));
    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
    expect(generateSummary).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: null, date_to: null }),
    );
  });

  it("All Records checkbox selects and deselects all sections", () => {
    render(<SummaryBuilder mode="admin" availableSections={["doctors", "medications"]} />);
    fireEvent.click(screen.getByRole("button", { name: /patient summary/i }));
    fireEvent.click(screen.getByLabelText(/all records/i));
    expect(screen.getByLabelText(/doctors/i)).toBeChecked();
    expect(screen.getByLabelText(/medications/i)).toBeChecked();
    fireEvent.click(screen.getByLabelText(/all records/i));
    expect(screen.getByLabelText(/doctors/i)).not.toBeChecked();
  });

  it("All time checkbox hides the date inputs and sends null dates", async () => {
    const { generateSummary } = await import("../api/summary");
    render(<SummaryBuilder mode="admin" availableSections={["doctors"]} />);
    fireEvent.click(screen.getByRole("button", { name: /patient summary/i }));
    fireEvent.click(screen.getByLabelText(/all time/i));
    expect(screen.queryByLabelText(/from date/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/doctors/i));
    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
    expect(generateSummary).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: null, date_to: null }),
    );
  });
});

describe("AppShell summary trigger", () => {
  function renderShell(role: string) {
    return render(
      <MemoryRouter>
        <AuthContext.Provider value={{ user: { id: "1", email: "a@b.c", role, full_name: "A" } } as never}>
          <AppShell><div>content</div></AppShell>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
  }

  it("shows Patient Summary Report for admins", () => {
    renderShell("admin");
    expect(screen.getByRole("button", { name: /patient summary/i })).toBeInTheDocument();
  });

  it("shows Patient Summary Report for viewers too", () => {
    renderShell("viewer");
    expect(screen.getByRole("button", { name: /patient summary/i })).toBeInTheDocument();
  });
});
