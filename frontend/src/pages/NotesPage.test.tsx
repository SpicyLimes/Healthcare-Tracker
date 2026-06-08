import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import NotesPage from "./NotesPage";
import * as notesModule from "../api/notes";
import * as useAuthModule from "../auth/useAuth";

afterEach(() => vi.restoreAllMocks());

const BASE_NOTE: notesModule.Note = {
  id: "note-1",
  author_user_id: "u1",
  title: "Buy aspirin",
  body: null,
  pinned: false,
  done: false,
  created_at: "2026-06-07T12:00:00Z",
};

function mockAuth(role: "admin" | "viewer", id = "u1") {
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    user: { id, email: "a@b.c", role },
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);
}

describe("NotesPage", () => {
  it("lists notes", async () => {
    mockAuth("viewer");
    vi.spyOn(notesModule.notesApi, "list").mockResolvedValue([BASE_NOTE]);
    render(<NotesPage />);
    expect(await screen.findByText("Buy aspirin")).toBeInTheDocument();
  });

  it("viewer sees add form", async () => {
    mockAuth("viewer");
    vi.spyOn(notesModule.notesApi, "list").mockResolvedValue([]);
    render(<NotesPage />);
    expect(await screen.findByRole("button", { name: /add note/i })).toBeInTheDocument();
  });

  it("viewer sees no delete button", async () => {
    mockAuth("viewer");
    vi.spyOn(notesModule.notesApi, "list").mockResolvedValue([BASE_NOTE]);
    render(<NotesPage />);
    await screen.findByText("Buy aspirin");
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("admin sees delete button", async () => {
    mockAuth("admin");
    vi.spyOn(notesModule.notesApi, "list").mockResolvedValue([BASE_NOTE]);
    render(<NotesPage />);
    expect(await screen.findByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("done note has strikethrough", async () => {
    mockAuth("admin");
    vi.spyOn(notesModule.notesApi, "list").mockResolvedValue([{ ...BASE_NOTE, done: true }]);
    render(<NotesPage />);
    const title = await screen.findByText("Buy aspirin");
    expect(title.className).toContain("line-through");
  });
});
