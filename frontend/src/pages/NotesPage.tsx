import { useEffect, useState, type FormEvent } from "react";
import { notesApi, type Note, type NoteCreate } from "../api/notes";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { Pin, PinOff } from "lucide-react";

const EMPTY: NoteCreate = { title: "", body: null, pinned: false, done: false };

export default function NotesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [notes, setNotes] = useState<Note[]>([]);
  // Without this the page asserts "No notes yet" while the fetch is still in
  // flight — stating a negative it has not verified.
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<NoteCreate>(EMPTY);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  async function reload() {
    setNotes(await notesApi.list());
  }

  useEffect(() => {
    reload()
      .catch(() => setError("Failed to load notes"))
      .finally(() => setLoading(false));
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await notesApi.create(form);
      setForm(EMPTY);
      await reload();
    } catch {
      setError("Could not add note");
    }
  }

  async function toggleDone(note: Note) {
    try {
      await notesApi.patch(note.id, { done: !note.done });
      await reload();
    } catch {
      setError("Could not update note");
    }
  }

  async function togglePin(note: Note) {
    try {
      await notesApi.patch(note.id, { pinned: !note.pinned });
      await reload();
    } catch {
      setError("Could not update note");
    }
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditBody(note.body ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    try {
      await notesApi.patch(id, { title: editTitle, body: editBody || null });
      setEditingId(null);
      await reload();
    } catch {
      setError("Could not update note");
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this note?")) return;
    try {
      await notesApi.remove(id);
      await reload();
    } catch {
      setError("Could not delete note");
    }
  }

  const canEditNote = (note: Note) =>
    isAdmin || note.author_user_id === user?.id;

  return (
    <AppShell>
      <PageLayout title="Notes / To-Do's" description="Personal notes and to-do items.">
        {/* Add form */}
        <Card>
          <CardContent className="py-6">
            <form onSubmit={onAdd} className="flex flex-col gap-4">
              <FormField label="Title" htmlFor="note-title">
                <Input
                  id="note-title"
                  required
                  placeholder="Note title…"
                  value={form.title}
                  onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                />
              </FormField>
              <FormField label="Body" htmlFor="note-body">
                <Textarea
                  id="note-body"
                  placeholder="Optional details…"
                  value={form.body ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, body: e.target.value || null }))}
                />
              </FormField>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.pinned ?? false}
                    onChange={(e) => setForm((s) => ({ ...s, pinned: e.target.checked }))}
                    className="rounded"
                  />
                  Pin to top
                </label>
                <Button type="submit">Add Note</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {/* Notes list */}
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No notes yet. Add one above.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {notes.map((note) => (
              <Card key={note.id} className={note.done ? "opacity-60" : ""}>
                <CardContent className="py-4 flex flex-col gap-2">
                  {editingId === note.id ? (
                    /* inline edit mode */
                    <div className="flex flex-col gap-3">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Title"
                        aria-label="Edit title"
                      />
                      <Textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        placeholder="Body"
                        aria-label="Edit body"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" type="button" onClick={cancelEdit}>Cancel</Button>
                        <Button size="sm" type="button" onClick={() => saveEdit(note.id)}>Save</Button>
                      </div>
                    </div>
                  ) : (
                    /* display mode */
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={note.done}
                            onChange={() => toggleDone(note)}
                            disabled={!canEditNote(note)}
                            aria-label="Mark done"
                            className="mt-0.5 shrink-0 rounded"
                          />
                          <span className={`font-medium text-sm ${note.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {note.title}
                          </span>
                          {note.pinned && <Badge variant="secondary" className="text-xs shrink-0">Pinned</Badge>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {canEditNote(note) && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() => togglePin(note)}
                                aria-label={note.pinned ? "Unpin" : "Pin"}
                              >
                                {note.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                              </Button>
                              <Button variant="outline" size="sm" type="button" onClick={() => startEdit(note)}>
                                Edit
                              </Button>
                            </>
                          )}
                          {isAdmin && (
                            <Button variant="destructive" size="sm" type="button" onClick={() => onDelete(note.id)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                      {note.body && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap pl-6">{note.body}</p>
                      )}
                      <p className="text-xs text-muted-foreground pl-6">
                        {new Date(note.created_at).toLocaleDateString()}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageLayout>
    </AppShell>
  );
}
