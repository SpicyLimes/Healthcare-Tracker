import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App";

afterEach(() => vi.restoreAllMocks());

test("unauthenticated user is routed to the login page", async () => {
  vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
  render(<App />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument());
});
