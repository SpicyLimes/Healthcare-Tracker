import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import AiAssistantPage from "./AiAssistantPage"

vi.mock("../api/settings", () => ({ getAiSettings: vi.fn() }))
vi.mock("../api/ai", () => ({
  sendChat: vi.fn(),
  AiUnavailableError: class extends Error {},
}))
import { getAiSettings } from "../api/settings"

describe("AiAssistantPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders a full-height assistant conversation when enabled", async () => {
    ;(getAiSettings as any).mockResolvedValue({ enabled: true, base_url: "http://x/v1", model: "m" })
    render(<MemoryRouter><AiAssistantPage /></MemoryRouter>)
    expect(await screen.findByPlaceholderText(/ask/i)).toBeInTheDocument()
  })

  it("shows the menu button, AI model name, and privacy note", async () => {
    ;(getAiSettings as any).mockResolvedValue({ enabled: true, base_url: "http://x/v1", model: "gemma-4-e4b" })
    render(<MemoryRouter><AiAssistantPage /></MemoryRouter>)
    expect(await screen.findByRole("button", { name: /navigation menu/i })).toBeInTheDocument()
    expect(screen.getByText(/AI Model:/i)).toBeInTheDocument()
    expect(screen.getByText("gemma-4-e4b")).toBeInTheDocument()
    expect(screen.getByText(/Privacy Note/i)).toBeInTheDocument()
    expect(screen.getByText(/locally-hosted language model/i)).toBeInTheDocument()
  })
})
