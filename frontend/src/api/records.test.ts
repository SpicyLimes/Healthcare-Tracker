import { afterEach, describe, expect, it, vi } from "vitest";
import { createRecordClient } from "./records";

interface Foo {
  id: string;
  name: string;
}

afterEach(() => vi.restoreAllMocks());

describe("createRecordClient", () => {
  const foos = createRecordClient<Foo, { name: string }, { name?: string }>("/api/foos");

  it("list GETs the collection", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: "1", name: "a" }]), { status: 200 }),
    );
    const result = await foos.list();
    expect(result).toEqual([{ id: "1", name: "a" }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/foos", undefined);
  });

  it("create POSTs with a CSRF header", async () => {
    document.cookie = "csrf_token=tok123";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "2", name: "b" }), { status: 201 }),
    );
    const created = await foos.create({ name: "b" });
    expect(created.id).toBe("2");
  });

  it("remove DELETEs by id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await foos.remove("9");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/foos/9",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("list throws on non-ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    await expect(foos.list()).rejects.toThrow();
  });
});
