import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecordDetailModal } from "./RecordDetailModal";

describe("RecordDetailModal", () => {
  const fields = [
    { label: "Kind", value: "Medication" },
    { label: "Frequency", value: null },
  ];

  it("renders the title and fields, with — for null values", () => {
    render(
      <RecordDetailModal title="Lisinopril" fields={fields} isAdmin onClose={() => {}} />
    );
    expect(screen.getByText("Lisinopril")).toBeInTheDocument();
    expect(screen.getByText("Medication")).toBeInTheDocument();
    expect(screen.getByText("Frequency")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows the Edit button only for admins and calls onEdit", () => {
    const onEdit = vi.fn();
    const { rerender } = render(
      <RecordDetailModal title="X" fields={fields} isAdmin={false} onClose={() => {}} onEdit={onEdit} />
    );
    expect(screen.queryByRole("button", { name: /^edit$/i })).toBeNull();

    rerender(<RecordDetailModal title="X" fields={fields} isAdmin onClose={() => {}} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and on backdrop click", () => {
    // Escape fires on `document`, not on the dialog node — dispatching straight
    // at the dialog bypasses focus routing and passes even when Escape is broken.
    const onClose = vi.fn();
    render(<RecordDetailModal title="X" fields={fields} isAdmin onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("detail-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders extra content when provided", () => {
    render(
      <RecordDetailModal
        title="X"
        fields={fields}
        isAdmin
        onClose={() => {}}
        extra={<div>DOCS HERE</div>}
      />
    );
    expect(screen.getByText("DOCS HERE")).toBeInTheDocument();
  });
});
