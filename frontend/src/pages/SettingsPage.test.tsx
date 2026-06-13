import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import SettingsPage from "./SettingsPage";

vi.mock("../api/settings", () => ({
  getAiSettings: vi.fn().mockResolvedValue({ enabled: false, base_url: null, model: null }),
  updateAiSettings: vi.fn().mockResolvedValue({ enabled: true, base_url: "http://localhost:1234/v1", model: "m" }),
  testAiConnection: vi.fn().mockResolvedValue({ reachable: true, detail: "Reachable." }),
}));
import { getAiSettings, updateAiSettings, testAiConnection } from "../api/settings";

describe("SettingsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads current settings", async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole("heading", { name: /AI Assistant/i })).toBeInTheDocument());
    expect(getAiSettings).toHaveBeenCalledOnce();
  });

  it("saves settings on Save", async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByLabelText(/Base URL/i));
    fireEvent.change(screen.getByLabelText(/Base URL/i), { target: { value: "http://localhost:1234/v1" } });
    fireEvent.change(screen.getByLabelText(/Model/i), { target: { value: "m" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(updateAiSettings).toHaveBeenCalled());
  });

  it("tests connection on Test", async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByRole("button", { name: /test connection/i }));
    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
    await waitFor(() => expect(testAiConnection).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/reachable/i)).toBeInTheDocument());
  });

  it("shows a provider setup guide card with Ollama and LM Studio examples", async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByRole("heading", { name: /AI Assistant/i }));
    expect(screen.getByText(/Provider Setup Guide/i)).toBeInTheDocument();
    expect(screen.getAllByText(/LM Studio/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ollama/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/same stack/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/separate container/i).length).toBeGreaterThan(0);
  });
});
