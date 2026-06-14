import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AiChatPanel from "./AiChatPanel";

vi.mock("../api/ai", () => ({
  getAiStatus: vi.fn(),
  sendChat: vi.fn(),
  AiUnavailableError: class AiUnavailableError extends Error {},
}));

import { getAiStatus, sendChat, AiUnavailableError } from "../api/ai";

describe("AiChatPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders no launcher when AI is disabled", async () => {
    (getAiStatus as any).mockResolvedValue({ enabled: false, model: null });
    render(<MemoryRouter><AiChatPanel /></MemoryRouter>);
    await waitFor(() => expect(getAiStatus).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /assistant/i })).toBeNull();
  });

  it("shows launcher and sends a message when enabled", async () => {
    (getAiStatus as any).mockResolvedValue({ enabled: true, model: "m" });
    (sendChat as any).mockResolvedValue({ answer: "Hi there.", tools_used: [] });
    render(<MemoryRouter><AiChatPanel /></MemoryRouter>);
    const launcher = await screen.findByRole("button", { name: /assistant/i });
    fireEvent.click(launcher);
    fireEvent.change(await screen.findByPlaceholderText(/ask/i), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(sendChat).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("Hi there.")).toBeInTheDocument());
  });

  it("shows an unavailable message on 503", async () => {
    (getAiStatus as any).mockResolvedValue({ enabled: true, model: "m" });
    (sendChat as any).mockRejectedValue(new AiUnavailableError("down"));
    render(<MemoryRouter><AiChatPanel /></MemoryRouter>);
    const launcher = await screen.findByRole("button", { name: /assistant/i });
    fireEvent.click(launcher);
    fireEvent.change(await screen.findByPlaceholderText(/ask/i), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/unavailable|check settings/i)).toBeInTheDocument());
  });

  it("renders create proposals inline under the assistant answer", async () => {
    (getAiStatus as any).mockResolvedValue({ enabled: true, model: "m" });
    (sendChat as any).mockResolvedValue({
      answer: "I'll add these. Confirm?",
      tools_used: ["propose_record"],
      proposals: [
        { action: "create", section: "surgeries", fields: { procedure: "Appendectomy" }, warnings: [] },
      ],
    });
    render(<MemoryRouter><AiChatPanel /></MemoryRouter>);
    const launcher = await screen.findByRole("button", { name: /assistant/i });
    fireEvent.click(launcher);
    fireEvent.change(await screen.findByPlaceholderText(/ask/i), { target: { value: "she had an appendectomy" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(sendChat).toHaveBeenCalled());
    expect(await screen.findByText(/Appendectomy/)).toBeInTheDocument();
    expect(screen.getByText(/surgeries/i)).toBeInTheDocument();
    expect(screen.getByText(/create/i)).toBeInTheDocument();
  });

  it("shows a warning note on a proposal", async () => {
    (getAiStatus as any).mockResolvedValue({ enabled: true, model: "m" });
    (sendChat as any).mockResolvedValue({
      answer: "Drafted, but note:",
      tools_used: ["propose_record"],
      proposals: [
        { action: "create", section: "surgeries", fields: { procedure: "X" }, warnings: ["Could not use value for 'surgery_date'"] },
      ],
    });
    render(<MemoryRouter><AiChatPanel /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /assistant/i }));
    fireEvent.change(await screen.findByPlaceholderText(/ask/i), { target: { value: "add surgery" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(sendChat).toHaveBeenCalled());
    expect(await screen.findByText(/surgery_date/)).toBeInTheDocument();
  });

  it("shows AI model name and privacy note in the desktop panel empty state", async () => {
    (getAiStatus as any).mockResolvedValue({ enabled: true, model: "gemma-4-e4b" });
    render(<MemoryRouter><AiChatPanel /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /assistant/i }));
    expect(await screen.findByText(/AI Model:/i)).toBeInTheDocument();
    expect(screen.getByText("gemma-4-e4b")).toBeInTheDocument();
    expect(screen.getByText(/Privacy Note/i)).toBeInTheDocument();
    expect(screen.getByText(/locally-hosted language model/i)).toBeInTheDocument();
  });

  it("does not show the redundant shield subtitle in the panel header", async () => {
    (getAiStatus as any).mockResolvedValue({ enabled: true, model: "m" });
    render(<MemoryRouter><AiChatPanel /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /assistant/i }));
    await screen.findByPlaceholderText(/ask/i);
    expect(screen.queryByText(/Answers come only from your records/i)).toBeNull();
  });

  it("shows Standard, Medium, and Large width preset buttons in the panel header", async () => {
    (getAiStatus as any).mockResolvedValue({ enabled: true, model: "m" });
    render(<MemoryRouter><AiChatPanel /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /assistant/i }));
    await screen.findByPlaceholderText(/ask/i);
    expect(screen.getByRole("button", { name: /standard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /medium/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /large/i })).toBeInTheDocument();
  });

  it("applies sm:max-w-lg class when Medium preset is selected", async () => {
    (getAiStatus as any).mockResolvedValue({ enabled: true, model: "m" });
    render(<MemoryRouter><AiChatPanel /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /assistant/i }));
    const mediumBtn = await screen.findByRole("button", { name: /medium/i });
    fireEvent.click(mediumBtn);
    const sheetContent = document.querySelector("[data-slot='sheet-content']");
    expect(sheetContent?.className).toMatch(/max-w-lg/);
  });

  it("applies sm:max-w-xl class when Large preset is selected", async () => {
    (getAiStatus as any).mockResolvedValue({ enabled: true, model: "m" });
    render(<MemoryRouter><AiChatPanel /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /assistant/i }));
    const largeBtn = await screen.findByRole("button", { name: /large/i });
    fireEvent.click(largeBtn);
    const sheetContent = document.querySelector("[data-slot='sheet-content']");
    expect(sheetContent?.className).toMatch(/max-w-xl/);
  });

  it("persists the selected width preset to localStorage", async () => {
    (getAiStatus as any).mockResolvedValue({ enabled: true, model: "m" });
    render(<MemoryRouter><AiChatPanel /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /assistant/i }));
    fireEvent.click(await screen.findByRole("button", { name: /large/i }));
    expect(localStorage.getItem("ai-panel-width")).toBe("large");
  });

  it("restores the saved width preset from localStorage on mount", async () => {
    localStorage.setItem("ai-panel-width", "medium");
    (getAiStatus as any).mockResolvedValue({ enabled: true, model: "m" });
    render(<MemoryRouter><AiChatPanel /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /assistant/i }));
    await screen.findByPlaceholderText(/ask/i);
    const sheetContent = document.querySelector("[data-slot='sheet-content']");
    expect(sheetContent?.className).toMatch(/max-w-lg/);
  });
});
