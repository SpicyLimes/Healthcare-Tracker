import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App";

afterEach(() => {
  vi.restoreAllMocks();
});

test("renders the app title", () => {
  vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ status: "ok", database: "connected" })),
  );
  render(<App />);
  expect(screen.getByText("Healthcare Tracker")).toBeInTheDocument();
});

test("displays backend health status after fetch", async () => {
  vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ status: "ok", database: "connected" })),
  );
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText(/Backend: ok/i)).toBeInTheDocument();
    expect(screen.getByText(/Database: connected/i)).toBeInTheDocument();
  });
});

test("shows an error state when the health fetch fails", async () => {
  vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText(/Backend: unreachable/i)).toBeInTheDocument();
  });
});
