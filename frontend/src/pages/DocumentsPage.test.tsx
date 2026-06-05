import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DocumentsPage from "./DocumentsPage";
import * as docsApi from "../api/documents";

afterEach(() => vi.restoreAllMocks());

const DOCS: docsApi.DocumentRecord[] = [
  { id: 1, filename: "surgery_report.pdf", section: "surgeries", record_id: "r1",
    mime_type: "application/pdf", file_size: 2048, uploaded_at: "2026-06-01T10:00:00Z" },
  { id: 2, filename: "vax_card.png", section: "vaccinations", record_id: "r2",
    mime_type: "image/png", file_size: 512, uploaded_at: "2026-06-02T10:00:00Z" },
];

describe("DocumentsPage", () => {
  it("renders global document list", async () => {
    vi.spyOn(docsApi, "listAllDocuments").mockResolvedValue(DOCS);
    render(<DocumentsPage />);
    expect(await screen.findByText("surgery_report.pdf")).toBeInTheDocument();
    expect(screen.getByText("vax_card.png")).toBeInTheDocument();
  });

  it("section filter calls API with section param", async () => {
    const spy = vi.spyOn(docsApi, "listAllDocuments").mockResolvedValue([DOCS[1]]);
    render(<DocumentsPage />);
    await screen.findByText("Documents");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "vaccinations" } });

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith("vaccinations");
    });
    expect(await screen.findByText("vax_card.png")).toBeInTheDocument();
  });
});
