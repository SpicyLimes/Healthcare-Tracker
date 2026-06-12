import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
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
})
