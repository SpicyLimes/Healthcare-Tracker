// frontend/src/components/DocumentsPanel.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DocumentsPanel from "./DocumentsPanel";
import * as docsApi from "../api/documents";

afterEach(() => vi.restoreAllMocks());

const DOC: docsApi.DocumentRecord = {
  id: 1,
  filename: "report.pdf",
  section: "vaccinations",
  record_id: "rec-1",
  mime_type: "application/pdf",
  file_size: 1024,
  uploaded_at: "2026-06-04T12:00:00Z",
};

async function expandPanel() {
  fireEvent.click(screen.getByRole("button", { name: /documents/i }));
}

describe("DocumentsPanel", () => {
  it("renders file list when documents exist", async () => {
    vi.spyOn(docsApi, "listDocumentsForRecord").mockResolvedValue([DOC]);
    render(<DocumentsPanel section="vaccinations" recordId="rec-1" isAdmin={false} />);
    await expandPanel();
    expect(await screen.findByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("1.0 KB")).toBeInTheDocument();
  });

  it("renders empty state when no documents", async () => {
    vi.spyOn(docsApi, "listDocumentsForRecord").mockResolvedValue([]);
    render(<DocumentsPanel section="vaccinations" recordId="rec-1" isAdmin={false} />);
    await expandPanel();
    expect(await screen.findByText(/no documents attached/i)).toBeInTheDocument();
  });

  it("upload button absent for viewer", async () => {
    vi.spyOn(docsApi, "listDocumentsForRecord").mockResolvedValue([]);
    render(<DocumentsPanel section="vaccinations" recordId="rec-1" isAdmin={false} />);
    await expandPanel();
    await screen.findByText(/no documents attached/i);
    expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
  });

  it("delete button absent for viewer", async () => {
    vi.spyOn(docsApi, "listDocumentsForRecord").mockResolvedValue([DOC]);
    render(<DocumentsPanel section="vaccinations" recordId="rec-1" isAdmin={false} />);
    await expandPanel();
    await screen.findByText("report.pdf");
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("rejects disallowed file type before calling API", async () => {
    vi.spyOn(docsApi, "listDocumentsForRecord").mockResolvedValue([]);
    const uploadSpy = vi.spyOn(docsApi, "uploadDocument");
    render(<DocumentsPanel section="vaccinations" recordId="rec-1" isAdmin={true} />);
    await expandPanel();
    await screen.findByText(/no documents attached/i);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(["data"], "virus.exe", { type: "application/x-msdownload" });
    fireEvent.change(input, { target: { files: [badFile] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/not allowed/i);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("rejects file over 20MB before calling API", async () => {
    vi.spyOn(docsApi, "listDocumentsForRecord").mockResolvedValue([]);
    const uploadSpy = vi.spyOn(docsApi, "uploadDocument");
    render(<DocumentsPanel section="vaccinations" recordId="rec-1" isAdmin={true} />);
    await expandPanel();
    await screen.findByText(/no documents attached/i);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = new File([new ArrayBuffer(21 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(bigFile, "size", { value: 21 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [bigFile] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/20 mb/i);
    expect(uploadSpy).not.toHaveBeenCalled();
  });
});
