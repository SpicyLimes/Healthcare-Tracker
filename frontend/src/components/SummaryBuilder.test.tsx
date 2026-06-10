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
    fireEvent.click(screen.getByRole("button", { name: /generate summary/i }));
    expect(screen.getByText(/build a summary/i)).toBeInTheDocument();
  });

  it("only offers the sections it was given (guest scoping)", () => {
    render(<SummaryBuilder mode="guest" token="t" availableSections={["doctors"]} />);
    fireEvent.click(screen.getByRole("button", { name: /generate summary/i }));
    expect(screen.getByLabelText(/doctors/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/medications/i)).not.toBeInTheDocument();
  });

  it("calls the guest API with the token when in guest mode", async () => {
    const { generateGuestSummary } = await import("../api/summary");
    render(<SummaryBuilder mode="guest" token="tok123" availableSections={["doctors"]} />);
    fireEvent.click(screen.getByRole("button", { name: /generate summary/i }));
    fireEvent.click(screen.getByLabelText(/doctors/i));
    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
    expect(generateGuestSummary).toHaveBeenCalledWith(
      expect.objectContaining({ sections: ["doctors"] }),
      "tok123",
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

  it("shows Generate Summary for admins", () => {
    renderShell("admin");
    expect(screen.getByRole("button", { name: /generate summary/i })).toBeInTheDocument();
  });

  it("hides Generate Summary for non-admins", () => {
    renderShell("viewer");
    expect(screen.queryByRole("button", { name: /generate summary/i })).not.toBeInTheDocument();
  });
});
