// frontend/src/components/DoctorPicker.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DoctorPicker from "./DoctorPicker";
import * as doctorsApi from "../api/doctors";

afterEach(() => vi.restoreAllMocks());

function mockDoctors() {
  vi.spyOn(doctorsApi.doctorsApi, "list").mockResolvedValue([
    { id: "d1", name: "Dr. Smith", specialty: null, practice: null, phone: null, fax: null, address: null, patient_portal_url: null, notes: null },
  ]);
}

describe("DoctorPicker", () => {
  it("renders a dropdown with known doctors and an Other option", async () => {
    mockDoctors();
    const onChange = vi.fn();
    render(<DoctorPicker doctorId={null} doctorOther={null} onChange={onChange} />);
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
    expect(await screen.findByText("Dr. Smith")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("selecting a known doctor emits (doctor_id, null)", async () => {
    mockDoctors();
    const onChange = vi.fn();
    render(<DoctorPicker doctorId={null} doctorOther={null} onChange={onChange} />);
    await screen.findByText("Dr. Smith");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "d1" } });
    expect(onChange).toHaveBeenCalledWith("d1", null);
  });

  it("selecting Other shows a text input", async () => {
    mockDoctors();
    const onChange = vi.fn();
    render(<DoctorPicker doctorId={null} doctorOther={null} onChange={onChange} />);
    await screen.findByText("Other");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "__other__" } });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("typing in Other input emits (null, text)", async () => {
    mockDoctors();
    const onChange = vi.fn();
    render(<DoctorPicker doctorId={null} doctorOther={null} onChange={onChange} />);
    await screen.findByText("Other");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "__other__" } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Dr. House" } });
    expect(onChange).toHaveBeenLastCalledWith(null, "Dr. House");
  });

  it("disabled prop makes inputs read-only", async () => {
    mockDoctors();
    render(<DoctorPicker doctorId={null} doctorOther={null} onChange={vi.fn()} disabled />);
    await screen.findByText("Dr. Smith");
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
