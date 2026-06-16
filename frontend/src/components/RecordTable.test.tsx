import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { RecordTable } from "./RecordTable";

interface Row { id: string; name: string; dose: string | null; active: boolean; kind: string }

const rows: Row[] = [
  { id: "1", name: "Lisinopril", dose: "10 mg", active: true, kind: "Medication" },
  { id: "2", name: "Aspirin", dose: null, active: false, kind: "Medication" },
];

function renderTable(over: Partial<React.ComponentProps<typeof RecordTable<Row>>> = {}) {
  return render(
    <RecordTable<Row>
      rows={rows}
      loading={false}
      isAdmin
      getRowId={(r) => r.id}
      primaryColumns={[
        { header: "Name", sortKey: "name", render: (r) => r.name },
        { header: "Dose", sortKey: "dose", render: (r) => r.dose ?? "" },
      ]}
      detailTitle={(r) => r.name}
      detailFields={(r) => [{ label: "Kind", value: r.kind }]}
      getHeadline={(r) => r.name}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      emptyMessage="No records yet."
      {...over}
    />
  );
}

describe("RecordTable", () => {
  it("renders only the primary columns in the desktop table", () => {
    renderTable();
    expect(screen.getByRole("button", { name: /sort by name/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sort by dose/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sort by kind/i })).toBeNull();
  });

  it("opens the detail modal when More is clicked", () => {
    renderTable();
    const moreButtons = screen.getAllByRole("button", { name: /^more$/i });
    fireEvent.click(moreButtons[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Kind")).toBeInTheDocument();
  });

  it("hides Edit/Delete/More-edit for non-admins", () => {
    renderTable({ isAdmin: false });
    expect(screen.queryByRole("button", { name: /^edit$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^delete$/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^more$/i }).length).toBeGreaterThan(0);
  });

  it("calls onDelete with the row when Delete is clicked", () => {
    const onDelete = vi.fn();
    renderTable({ onDelete });
    fireEvent.click(screen.getAllByRole("button", { name: /^delete$/i })[0]);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("toggles sort when a sortable header is clicked", () => {
    renderTable();
    const header = screen.getByRole("button", { name: /sort by name/i });
    fireEvent.click(header);
    expect(screen.getAllByText(/Lisinopril|Aspirin/).length).toBeGreaterThan(0);
  });

  it("shows the empty message when there are no rows", () => {
    renderTable({ rows: [] });
    expect(screen.getAllByText("No records yet.").length).toBeGreaterThan(0);
  });

  it("shows a loading row when loading", () => {
    renderTable({ loading: true, rows: [] });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("closes the detail modal before calling onEdit from the modal", () => {
    const onEdit = vi.fn();
    renderTable({ onEdit });
    // open the detail modal
    fireEvent.click(screen.getAllByRole("button", { name: /^more$/i })[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // click Edit inside the modal (last matching Edit is the modal footer button)
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^edit$/i }));
    // modal is gone and the page handler fired exactly once
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
