import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { RecordFormModal } from "./RecordFormModal";

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

  it("calls onClose from Cancel, the close button, the backdrop, and Escape", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    fireEvent.click(screen.getByTestId("form-backdrop"));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(4);
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
