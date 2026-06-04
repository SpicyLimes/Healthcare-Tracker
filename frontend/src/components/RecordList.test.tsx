import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RecordList, { type Column, type Field } from "./RecordList";

interface Med {
  id: string;
  name: string;
}

const columns: Column<Med>[] = [{ header: "Name", render: (m) => m.name }];
const fields: Field[] = [{ name: "name", label: "Name", required: true }];

function makeApi(initial: Med[]) {
  const data = [...initial];
  return {
    list: vi.fn(async () => data),
    create: vi.fn(async (input: Record<string, string>) => {
      const row = { id: String(data.length + 1), name: input.name };
      data.push(row);
      return row;
    }),
    remove: vi.fn(async (id: string) => {
      const i = data.findIndex((d) => d.id === id);
      if (i >= 0) data.splice(i, 1);
    }),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("RecordList", () => {
  it("renders rows from the api", async () => {
    const api = makeApi([{ id: "1", name: "Aspirin" }]);
    render(<RecordList title="Meds" api={api} columns={columns} fields={fields} isAdmin={false} />);
    expect(await screen.findByText("Aspirin")).toBeInTheDocument();
  });

  it("hides add form and delete buttons for non-admins", async () => {
    const api = makeApi([{ id: "1", name: "Aspirin" }]);
    render(<RecordList title="Meds" api={api} columns={columns} fields={fields} isAdmin={false} />);
    await screen.findByText("Aspirin");
    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("admin can add a record", async () => {
    const api = makeApi([]);
    render(<RecordList title="Meds" api={api} columns={columns} fields={fields} isAdmin={true} />);
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Tylenol" } });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(await screen.findByText("Tylenol")).toBeInTheDocument();
    expect(api.create).toHaveBeenCalledWith({ name: "Tylenol" });
  });

  it("admin can delete a record", async () => {
    const api = makeApi([{ id: "1", name: "Aspirin" }]);
    render(<RecordList title="Meds" api={api} columns={columns} fields={fields} isAdmin={true} />);
    await screen.findByText("Aspirin");
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("1"));
  });
});
