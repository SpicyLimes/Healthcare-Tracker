// frontend/src/pages/CalendarPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CalendarPage from "./CalendarPage";
import * as calApi from "../api/calendar";
import * as useAuthModule from "../auth/useAuth";
import type { CalendarEvent } from "../api/calendar";

afterEach(() => vi.restoreAllMocks());

function mockAuth() {
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    user: { id: "u1", email: "a@b.c", role: "admin" },
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);
}

const ALL_EVENTS: CalendarEvent[] = [
  { id: "1", type: "appointment", title: "Annual physical", date: "2026-07-15", color: "#3b82f6" },
  { id: "2", type: "visit_log", title: "Checkup", date: "2026-07-20", color: "#8b5cf6" },
  { id: "3", type: "vaccination", title: "Flu Shot", date: "2026-07-22", color: "#10b981" },
  { id: "4", type: "surgery", title: "Knee replacement", date: "2026-07-25", color: "#ef4444" },
  { id: "5", type: "hospitalization", title: "City Hospital", date: "2026-07-28", color: "#f97316" },
  { id: "6", type: "medication", title: "Metformin 500mg", date: "2026-07-01", color: "#eab308" },
];

describe("CalendarPage", () => {
  it("shows loading state initially", () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockReturnValue(new Promise(() => {}));
    render(<CalendarPage />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockRejectedValue(new Error("fail"));
    render(<CalendarPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load calendar events");
  });

  it("renders month view by default with event chips", async () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockResolvedValue(ALL_EVENTS);
    render(<CalendarPage />);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
  });

  it("switches to agenda view and shows event rows", async () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockResolvedValue(ALL_EVENTS);
    render(<CalendarPage />);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    fireEvent.click(screen.getByText("Agenda"));
    expect((await screen.findAllByText("Annual physical")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Flu Shot").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Metformin 500mg").length).toBeGreaterThan(0);
  });

  it("shows empty state in agenda view when no events", async () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockResolvedValue([]);
    render(<CalendarPage />);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    fireEvent.click(screen.getByText("Agenda"));
    expect((await screen.findAllByText("No events to show")).length).toBeGreaterThan(0);
  });

  it("agenda view shows type badges", async () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockResolvedValue([
      { id: "1", type: "appointment", title: "Annual physical", date: "2026-07-15", color: "#3b82f6" },
    ]);
    render(<CalendarPage />);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    fireEvent.click(screen.getByText("Agenda"));
    expect((await screen.findAllByText("Appointment")).length).toBeGreaterThan(0);
  });
});
