// frontend/src/pages/CalendarPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CalendarPage from "./CalendarPage";
import * as calApi from "../api/calendar";
import * as useAuthModule from "../auth/useAuth";
import type { CalendarEvent } from "../api/calendar";
import * as apptApiModule from "../api/appointments";
import * as doctorsApiModule from "../api/doctors";

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

const SORT_EVENTS: CalendarEvent[] = [
  { id: "s1", type: "appointment", title: "Oldest event", date: "2025-01-10", color: "#3b82f6" },
  { id: "s2", type: "visit_log", title: "Middle event", date: "2025-02-05", color: "#8b5cf6" },
  { id: "s3", type: "vaccination", title: "Newest event", date: "2025-03-20", color: "#10b981" },
];

async function renderAgenda(events: CalendarEvent[]) {
  mockAuth();
  vi.spyOn(calApi.calendarApi, "list").mockResolvedValue(events);
  vi.spyOn(apptApiModule.appointmentsApi, "list").mockResolvedValue([]);
  render(<MemoryRouter><CalendarPage /></MemoryRouter>);
  await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
  fireEvent.click(screen.getByText("Agenda"));
  await screen.findAllByTestId("agenda-row");
}

function agendaRowTitles(): string[] {
  return screen.getAllByTestId("agenda-row").map((r) => r.textContent ?? "");
}

describe("CalendarPage", () => {
  it("shows loading state initially", () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockRejectedValue(new Error("fail"));
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load calendar events");
  });

  it("renders month view by default with event chips", async () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockResolvedValue(ALL_EVENTS);
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
  });

  it("switches to agenda view and shows event rows", async () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockResolvedValue(ALL_EVENTS);
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    fireEvent.click(screen.getByText("Agenda"));
    expect((await screen.findAllByText("Annual physical")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Flu Shot").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Metformin 500mg").length).toBeGreaterThan(0);
  });

  it("shows empty state in agenda view when no events", async () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockResolvedValue([]);
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    fireEvent.click(screen.getByText("Agenda"));
    expect((await screen.findAllByText("No events to show")).length).toBeGreaterThan(0);
  });

  it("agenda view shows type badges", async () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockResolvedValue([
      { id: "1", type: "appointment", title: "Annual physical", date: "2026-07-15", color: "#3b82f6" },
    ]);
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    fireEvent.click(screen.getByText("Agenda"));
    expect((await screen.findAllByText("Appointment")).length).toBeGreaterThan(0);
  });

  it("renders Appointments section before the calendar month/agenda controls", async () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockResolvedValue([]);
    vi.spyOn(apptApiModule.appointmentsApi, "list").mockResolvedValue([]);
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    // "No appointment records yet." appears in the empty Appointments card before the calendar
    const allText = document.body.textContent ?? "";
    const apptIdx = allText.indexOf("No appointment records yet.");
    // The contiguous weekday header row is a reliable marker for the calendar body
    // (a bare "Sun" also matches the AppShell date line on Sundays)
    const sunIdx = allText.indexOf("SunMonTue");
    expect(apptIdx).toBeGreaterThanOrEqual(0);
    expect(sunIdx).toBeGreaterThanOrEqual(0);
    expect(apptIdx).toBeLessThan(sunIdx);
  });

  it("opens Add Appointment modal when + Add is clicked", async () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockResolvedValue([]);
    vi.spyOn(apptApiModule.appointmentsApi, "list").mockResolvedValue([]);
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /\+ add/i }));
    expect(await screen.findByRole("dialog", { name: /add appointment/i })).toBeInTheDocument();
  });

  it("agenda rows have click handlers after events load", async () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockResolvedValue([
      { id: "vl1", type: "visit_log", title: "Checkup", date: "2026-07-20", color: "#8b5cf6" },
    ]);
    vi.spyOn(apptApiModule.appointmentsApi, "list").mockResolvedValue([]);
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    fireEvent.click(screen.getByText("Agenda"));
    const rows = await screen.findAllByText("Checkup");
    // At least one row should be wrapped in a clickable element with data-testid or cursor-pointer class
    expect(
      rows.some((row) => row.closest("[data-testid='agenda-row']") !== null || row.closest(".cursor-pointer") !== null)
    ).toBe(true);
  });

  it("hides completed appointments from the Appointments card", async () => {
    mockAuth();
    vi.spyOn(calApi.calendarApi, "list").mockResolvedValue([]);
    vi.spyOn(apptApiModule.appointmentsApi, "list").mockResolvedValue([
      {
        id: "a1",
        appointment_datetime: "2026-07-15T09:00:00Z",
        appointment_type: null,
        doctor_id: null,
        doctor_other: null,
        location: null,
        reason: "Annual checkup",
        status: "upcoming",
        notes: null,
        visit_log_id: null,
      },
      {
        id: "a2",
        appointment_datetime: "2026-06-01T09:00:00Z",
        appointment_type: null,
        doctor_id: null,
        doctor_other: null,
        location: null,
        reason: "Old completed visit",
        status: "completed",
        notes: null,
        visit_log_id: "vl-123",
      },
    ]);
    vi.spyOn(doctorsApiModule.doctorsApi, "list").mockResolvedValue([]);
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    // Upcoming appointment should be visible
    const upcomingBadges = await screen.findAllByText("upcoming");
    expect(upcomingBadges.length).toBeGreaterThan(0);
    // Completed appointment should NOT be visible in the Appointments card
    const completedBadges = screen.queryAllByText("completed");
    expect(completedBadges.length).toBe(0);
  });

  it("agenda defaults to newest event first", async () => {
    await renderAgenda(SORT_EVENTS);
    const titles = agendaRowTitles();
    expect(titles[0]).toContain("Newest event");
    expect(
      titles.findIndex((t) => t.includes("Newest event"))
    ).toBeLessThan(titles.findIndex((t) => t.includes("Oldest event")));
  });

  it("agenda shows newest month group first", async () => {
    await renderAgenda(SORT_EVENTS);
    const text = document.body.textContent ?? "";
    expect(text.indexOf("March 2025")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("March 2025")).toBeLessThan(text.indexOf("January 2025"));
  });
});
