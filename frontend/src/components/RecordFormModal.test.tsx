import * as React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { RecordFormModal } from "./RecordFormModal";

// Without this, modals from earlier tests stay mounted and the next test's
// queries can match THEIR nodes — the dirty-guard check reads the first form
// in the document, so a stale one made an empty form look filled.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderModal(over: Partial<React.ComponentProps<typeof RecordFormModal>> = {}) {
  const onClose = over.onClose ?? vi.fn();
  const onSubmit = over.onSubmit ?? vi.fn((e) => e.preventDefault());
  render(
    <RecordFormModal title="Add Medication" onClose={onClose} onSubmit={onSubmit} {...over}>
      <input aria-label="Name" />
    </RecordFormModal>
  );
  return { onClose, onSubmit };
}

describe("RecordFormModal", () => {
  it("renders the title and children", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Add Medication");
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("uses the default submit label", () => {
    renderModal();
    expect(screen.getByRole("button", { name: /^save$/i })).toBeInTheDocument();
  });

  it("uses a custom submit label", () => {
    renderModal({ submitLabel: "Add Medication" });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /add medication/i })).toBeInTheDocument();
  });

  it("calls onSubmit when the form is submitted", () => {
    const { onSubmit } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("calls onClose from Cancel, the close button, and the backdrop", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    fireEvent.click(screen.getByTestId("form-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("closes on Escape without the user first clicking inside", () => {
    // Fire on `document`, NOT on the dialog node. The previous test dispatched
    // keyDown directly on the dialog, which bypasses focus routing entirely —
    // it passed while Escape was genuinely broken, because the overlay had no
    // tabIndex and nothing focused it on mount, so activeElement stayed <body>
    // and the bubbling React handler never ran.
    const onClose = vi.fn();
    renderModal({ onClose });
    expect(document.activeElement).not.toBe(document.body);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the error line only when error is set", () => {
    const { rerender } = render(
      <RecordFormModal title="X" onClose={vi.fn()} onSubmit={vi.fn()}>
        <input aria-label="Name" />
      </RecordFormModal>
    );
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(
      <RecordFormModal title="X" onClose={vi.fn()} onSubmit={vi.fn()} error="Boom">
        <input aria-label="Name" />
      </RecordFormModal>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
  });
});

describe("RecordFormModal dirty guard", () => {
  it("confirms before discarding entered data on a backdrop click", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onClose = vi.fn();
    render(
      <RecordFormModal title="X" onClose={onClose} onSubmit={vi.fn()}>
        <input aria-label="Name" defaultValue="half-typed medication" />
      </RecordFormModal>
    );
    fireEvent.click(screen.getByTestId("form-backdrop"));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes without confirming when nothing has been entered", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onClose = vi.fn();
    render(
      <RecordFormModal title="X" onClose={onClose} onSubmit={vi.fn()}>
        <input aria-label="Name" defaultValue="" />
      </RecordFormModal>
    );
    fireEvent.click(screen.getByTestId("form-backdrop"));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
