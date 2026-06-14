import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import AiAssistantPage from "./AiAssistantPage"

vi.mock("../api/ai", () => ({
  getAiStatus: vi.fn(),
  sendChat: vi.fn(),
  AiUnavailableError: class extends Error {},
}))
import { getAiStatus } from "../api/ai"

describe("AiAssistantPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders a full-height assistant conversation when enabled", async () => {
    ;(getAiStatus as any).mockResolvedValue({ enabled: true, model: "m" })
    render(<MemoryRouter><AiAssistantPage /></MemoryRouter>)
    expect(await screen.findByPlaceholderText(/ask/i)).toBeInTheDocument()
  })

  it("shows the menu button, AI model name, and privacy note", async () => {
    ;(getAiStatus as any).mockResolvedValue({ enabled: true, model: "gemma-4-e4b" })
    render(<MemoryRouter><AiAssistantPage /></MemoryRouter>)
    expect(await screen.findByRole("button", { name: /navigation menu/i })).toBeInTheDocument()
    expect(screen.getByText(/AI Model:/i)).toBeInTheDocument()
    expect(screen.getByText("gemma-4-e4b")).toBeInTheDocument()
    expect(screen.getByText(/Privacy Note/i)).toBeInTheDocument()
    expect(screen.getByText(/locally-hosted language model/i)).toBeInTheDocument()
  })
})
