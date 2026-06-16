import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChatConversation from "./ChatConversation";

// sendChat returns a promise we control so we can observe the "loading" window.
vi.mock("../api/ai", () => ({
  sendChat: vi.fn(() => new Promise(() => {})), // never resolves → stays loading
  AiUnavailableError: class AiUnavailableError extends Error {},
}));

describe("ChatConversation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the input enabled while the AI is responding", async () => {
    render(<ChatConversation />);
    const input = screen.getByPlaceholderText(/ask/i) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    // Now in the loading window (sendChat never resolves).
    expect(input).not.toBeDisabled();
    // Send button IS disabled during loading to prevent a second request.
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });
});
