import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AiChatPanel from "./AiChatPanel";

vi.mock("../api/settings", () => ({
  getAiSettings: vi.fn(),
}));
vi.mock("../api/ai", () => ({
  sendChat: vi.fn(),
  AiUnavailableError: class AiUnavailableError extends Error {},
}));

import { getAiSettings } from "../api/settings";
import { sendChat, AiUnavailableError } from "../api/ai";

describe("AiChatPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders no launcher when AI is disabled", async () => {
    (getAiSettings as any).mockResolvedValue({ enabled: false, base_url: null, model: null });
    render(<AiChatPanel />);
    await waitFor(() => expect(getAiSettings).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /assistant/i })).toBeNull();
  });

  it("shows launcher and sends a message when enabled", async () => {
    (getAiSettings as any).mockResolvedValue({ enabled: true, base_url: "http://x/v1", model: "m" });
    (sendChat as any).mockResolvedValue({ answer: "Hi there.", tools_used: [] });
    render(<AiChatPanel />);
    const launcher = await screen.findByRole("button", { name: /assistant/i });
    fireEvent.click(launcher);
    fireEvent.change(await screen.findByPlaceholderText(/ask/i), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(sendChat).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("Hi there.")).toBeInTheDocument());
  });

  it("shows an unavailable message on 503", async () => {
    (getAiSettings as any).mockResolvedValue({ enabled: true, base_url: "http://x/v1", model: "m" });
    (sendChat as any).mockRejectedValue(new AiUnavailableError("down"));
    render(<AiChatPanel />);
    const launcher = await screen.findByRole("button", { name: /assistant/i });
    fireEvent.click(launcher);
    fireEvent.change(await screen.findByPlaceholderText(/ask/i), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/unavailable|check settings/i)).toBeInTheDocument());
  });
});
