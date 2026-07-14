import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({ apiFetch: vi.fn() }));
vi.mock("./csrf", () => ({ csrfHeader: () => ({ "X-CSRF-Token": "tok" }) }));

import { apiFetch } from "./client";
import {
  backupDownloadUrl, createBackup, deleteBackup, listBackups, restoreBackup, uploadBackup,
} from "./backups";

const mockFetch = vi.mocked(apiFetch);

function ok(json: unknown, status = 200) {
  return { ok: true, status, json: async () => json } as Response;
}
function fail(detail: unknown, status = 400) {
  return { ok: false, status, json: async () => ({ detail }) } as Response;
}

beforeEach(() => mockFetch.mockReset());

describe("backups api", () => {
  it("lists backups", async () => {
    mockFetch.mockResolvedValue(ok([{ id: "2026-07-12" }]));
    expect(await listBackups()).toEqual([{ id: "2026-07-12" }]);
    expect(mockFetch).toHaveBeenCalledWith("/api/backups");
  });

  it("createBackup POSTs with CSRF", async () => {
    mockFetch.mockResolvedValue(ok({ id: "manual-x" }, 201));
    await createBackup();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/backups");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["X-CSRF-Token"]).toBe("tok");
  });

  it("uploadBackup sends FormData", async () => {
    mockFetch.mockResolvedValue(ok({ id: "uploaded-x" }, 201));
    await uploadBackup(new File([new Blob([new Uint8Array(4)])], "b.tar"));
    const [, init] = mockFetch.mock.calls[0];
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it("surfaces string detail on upload error", async () => {
    mockFetch.mockResolvedValue(fail("Archive must contain exactly db.sql.gz and uploads.tar.gz"));
    await expect(uploadBackup(new File([], "b.tar"))).rejects.toThrow(/db\.sql\.gz/);
  });

  it("ignores non-string detail", async () => {
    mockFetch.mockResolvedValue(fail([{ loc: "x" }], 422));
    await expect(uploadBackup(new File([], "b.tar"))).rejects.toThrow(/Failed to upload/);
  });

  it("restoreBackup posts the confirm phrase", async () => {
    mockFetch.mockResolvedValue(ok({ safety_backup_id: "safety-x" }));
    const res = await restoreBackup("2026-07-12", "2026-07-12");
    expect(res.safety_backup_id).toBe("safety-x");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/backups/2026-07-12/restore");
    expect(JSON.parse(init?.body as string)).toEqual({ confirm: "2026-07-12" });
  });

  it("deleteBackup DELETEs", async () => {
    mockFetch.mockResolvedValue(ok(undefined, 204));
    await deleteBackup("uploaded-x");
    expect(mockFetch.mock.calls[0][0]).toBe("/api/backups/uploaded-x");
  });

  it("builds download url", () => {
    expect(backupDownloadUrl("2026-07-12")).toBe("/api/backups/2026-07-12/download");
  });
});
