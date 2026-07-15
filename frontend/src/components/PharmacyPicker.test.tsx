// frontend/src/components/PharmacyPicker.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PharmacyPicker from "./PharmacyPicker";
import * as pharmaciesApiModule from "../api/pharmacies";

afterEach(() => vi.restoreAllMocks());

function mockPharmacies() {
  vi.spyOn(pharmaciesApiModule.pharmaciesApi, "list").mockResolvedValue([
    { id: "p1", name: "CVS Main St", address: null, phone: null, fax: null, notes: null },
  ] as never);
}

describe("PharmacyPicker", () => {
  it("renders a dropdown with known pharmacies and no Other option", async () => {
    mockPharmacies();
    render(<PharmacyPicker pharmacyId={null} onChange={vi.fn()} />);
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
    expect(await screen.findByText("CVS Main St")).toBeInTheDocument();
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
  });

  it("selecting a pharmacy emits its id", async () => {
    mockPharmacies();
    const onChange = vi.fn();
    render(<PharmacyPicker pharmacyId={null} onChange={onChange} />);
    await screen.findByText("CVS Main St");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "p1" } });
    expect(onChange).toHaveBeenCalledWith("p1");
  });

  it("clearing the selection emits null", async () => {
    mockPharmacies();
    const onChange = vi.fn();
    render(<PharmacyPicker pharmacyId="p1" onChange={onChange} />);
    await screen.findByText("CVS Main St");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows the current pharmacy as selected", async () => {
    mockPharmacies();
    render(<PharmacyPicker pharmacyId="p1" onChange={vi.fn()} />);
    await screen.findByText("CVS Main St");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("p1");
  });
});
