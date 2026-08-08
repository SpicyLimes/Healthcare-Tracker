// frontend/src/pages/NutritionPlanPage.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NutritionPlanPage from "./NutritionPlanPage";
import * as nutritionModule from "../api/nutritionPlan";
import * as documentsModule from "../api/documents";
import * as useAuthModule from "../auth/useAuth";

// Delete buttons now go through window.confirm; auto-accept in tests.
beforeEach(() => vi.spyOn(window, "confirm").mockReturnValue(true));
afterEach(() => vi.restoreAllMocks());

const MEAL: nutritionModule.NutritionMeal = {
  id: "meal-1",
  food_name: "Oatmeal",
  meal_type: "breakfast",
  created_by: null,
  created_at: "2026-06-09T10:00:00Z",
  updated_at: "2026-06-09T10:00:00Z",
};

const ACCEPTABLE: nutritionModule.NutritionAcceptableFood = {
  id: "af-1",
  food_name: "Banana",
  for_breakfast: false,
  for_lunch: false,
  for_dinner: false,
  for_snacks: false,
  created_by: null,
  created_at: "2026-06-09T10:00:00Z",
  updated_at: "2026-06-09T10:00:00Z",
};

const UNACCEPTABLE: nutritionModule.NutritionUnacceptableFood = {
  id: "uf-1",
  food_name: "Fried chicken",
  created_by: null,
  created_at: "2026-06-09T10:00:00Z",
  updated_at: "2026-06-09T10:00:00Z",
};

const DOC: documentsModule.DocumentRecord = {
  id: 1,
  filename: "scan_2.pdf",
  section: "nutrition_plan",
  record_id: null,
  mime_type: "application/pdf",
  file_size: 204800,
  uploaded_at: "2026-06-09T10:00:00Z",
  uploaded_by: null,
};

function mockAuth(role: "admin" | "viewer" | "contributor" = "admin") {
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    user: { id: "u1", email: "a@b.c", role },
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);
}

function mockApis(overrides: {
  meals?: nutritionModule.NutritionMeal[];
  acceptable?: nutritionModule.NutritionAcceptableFood[];
  unacceptable?: nutritionModule.NutritionUnacceptableFood[];
  docs?: documentsModule.DocumentRecord[];
} = {}) {
  vi.spyOn(nutritionModule.mealsApi, "list").mockResolvedValue(overrides.meals ?? []);
  vi.spyOn(nutritionModule.acceptableFoodsApi, "list").mockResolvedValue(overrides.acceptable ?? []);
  vi.spyOn(nutritionModule.unacceptableFoodsApi, "list").mockResolvedValue(overrides.unacceptable ?? []);
  vi.spyOn(documentsModule, "listAllDocuments").mockResolvedValue(overrides.docs ?? []);
}

describe("NutritionPlanPage", () => {
  it("renders meal in correct column", async () => {
    mockAuth();
    mockApis({ meals: [MEAL] });
    render(<NutritionPlanPage />);
    expect(await screen.findByText("Oatmeal")).toBeInTheDocument();
    // "Breakfast" appears in both the Card 1 column header and the Card 2 table header
    expect(screen.getAllByText("Breakfast").length).toBeGreaterThanOrEqual(1);
  });

  it("renders acceptable food row", async () => {
    mockAuth();
    mockApis({ acceptable: [ACCEPTABLE] });
    render(<NutritionPlanPage />);
    fireEvent.click(await screen.findByText("Acceptable Foods"));
    expect((await screen.findAllByText("Banana")).length).toBeGreaterThanOrEqual(1);
  });

  it("renders unacceptable food", async () => {
    mockAuth();
    mockApis({ unacceptable: [UNACCEPTABLE] });
    render(<NutritionPlanPage />);
    fireEvent.click(await screen.findByText("Unacceptable Foods"));
    expect(await screen.findByText("Fried chicken")).toBeInTheDocument();
  });

  it("renders document filename in Card 4", async () => {
    mockAuth();
    mockApis({ docs: [DOC] });
    render(<NutritionPlanPage />);
    expect((await screen.findAllByText("scan_2.pdf")).length).toBeGreaterThanOrEqual(1);
  });

  it("card 1 add calls mealsApi.create and reloads", async () => {
    mockAuth();
    mockApis();
    const createSpy = vi.spyOn(nutritionModule.mealsApi, "create").mockResolvedValue(MEAL);
    render(<NutritionPlanPage />);
    // "Breakfast" appears in both the Card 1 column header and the Card 2 table header; wait for either
    await screen.findAllByText("Breakfast");
    const input = screen.getByLabelText("Add breakfast item");
    fireEvent.change(input, { target: { value: "Oatmeal" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(createSpy).toHaveBeenCalledWith({ food_name: "Oatmeal", meal_type: "breakfast" }));
  });

  it("card 1 delete calls mealsApi.remove", async () => {
    mockAuth();
    mockApis({ meals: [MEAL] });
    const removeSpy = vi.spyOn(nutritionModule.mealsApi, "remove").mockResolvedValue(undefined);
    render(<NutritionPlanPage />);
    const deleteBtn = await screen.findByLabelText("Delete Oatmeal");
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(removeSpy).toHaveBeenCalledWith("meal-1"));
  });

  it("checking a meal-type checkbox calls mealsApi.create + acceptableFoodsApi.patch", async () => {
    mockAuth();
    mockApis({ acceptable: [ACCEPTABLE] });
    const createSpy = vi.spyOn(nutritionModule.mealsApi, "create").mockResolvedValue(MEAL);
    const patchSpy = vi.spyOn(nutritionModule.acceptableFoodsApi, "patch").mockResolvedValue({
      ...ACCEPTABLE, for_breakfast: true,
    });
    render(<NutritionPlanPage />);
    fireEvent.click(await screen.findByText("Acceptable Foods"));
    const checkboxes = await screen.findAllByLabelText("Banana for breakfast");
    fireEvent.click(checkboxes[0]);
    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({ food_name: "Banana", meal_type: "breakfast" });
      expect(patchSpy).toHaveBeenCalledWith("af-1", { for_breakfast: true });
    });
  });

  it("unchecking a meal-type checkbox calls mealsApi.remove + acceptableFoodsApi.patch", async () => {
    mockAuth();
    const checkedFood = { ...ACCEPTABLE, for_breakfast: true };
    // The page matches meals by food_name + meal_type, so the meal must share the food's name
    const BANANA_MEAL: nutritionModule.NutritionMeal = {
      ...MEAL,
      id: "meal-banana",
      food_name: "Banana",
      meal_type: "breakfast",
    };
    mockApis({ meals: [BANANA_MEAL], acceptable: [checkedFood] });
    const removeSpy = vi.spyOn(nutritionModule.mealsApi, "remove").mockResolvedValue(undefined);
    const patchSpy = vi.spyOn(nutritionModule.acceptableFoodsApi, "patch").mockResolvedValue({
      ...checkedFood, for_breakfast: false,
    });
    render(<NutritionPlanPage />);
    fireEvent.click(await screen.findByText("Acceptable Foods"));
    const checkboxes = await screen.findAllByLabelText("Banana for breakfast");
    fireEvent.click(checkboxes[0]);
    await waitFor(() => {
      expect(removeSpy).toHaveBeenCalledWith("meal-banana");
      expect(patchSpy).toHaveBeenCalledWith("af-1", { for_breakfast: false });
    });
  });

  it("acceptable food inline edit calls acceptableFoodsApi.patch", async () => {
    mockAuth();
    mockApis({ acceptable: [ACCEPTABLE] });
    const patchSpy = vi.spyOn(nutritionModule.acceptableFoodsApi, "patch").mockResolvedValue({
      ...ACCEPTABLE, food_name: "Banana (ripe)",
    });
    render(<NutritionPlanPage />);
    fireEvent.click(await screen.findByText("Acceptable Foods"));
    await screen.findAllByText("Banana");
    const editBtn = screen.getAllByRole("button", { name: /edit/i })[0];
    fireEvent.click(editBtn);
    const input = screen.getAllByLabelText("Edit food name")[0];
    fireEvent.change(input, { target: { value: "Banana (ripe)" } });
    fireEvent.click(screen.getAllByRole("button", { name: /save/i })[0]);
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith("af-1", { food_name: "Banana (ripe)" })
    );
  });

  it("acceptable food delete calls acceptableFoodsApi.remove", async () => {
    mockAuth();
    mockApis({ acceptable: [ACCEPTABLE] });
    const removeSpy = vi.spyOn(nutritionModule.acceptableFoodsApi, "remove").mockResolvedValue(undefined);
    render(<NutritionPlanPage />);
    fireEvent.click(await screen.findByText("Acceptable Foods"));
    await screen.findAllByText("Banana");
    const deleteBtn = screen.getAllByRole("button", { name: /delete/i })[0];
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(removeSpy).toHaveBeenCalledWith("af-1"));
  });

  it("unacceptable food delete calls unacceptableFoodsApi.remove", async () => {
    mockAuth();
    mockApis({ unacceptable: [UNACCEPTABLE] });
    const removeSpy = vi.spyOn(nutritionModule.unacceptableFoodsApi, "remove").mockResolvedValue(undefined);
    render(<NutritionPlanPage />);
    fireEvent.click(await screen.findByText("Unacceptable Foods"));
    await screen.findByText("Fried chicken");
    const deleteBtn = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(removeSpy).toHaveBeenCalledWith("uf-1"));
  });

  // --- Role gating -----------------------------------------------------------
  // This page had ZERO role checks: every backend write is require_admin, so a
  // viewer/contributor got live Add/Edit/Delete controls that 403'd, surfacing
  // as "Could not add meal" — indistinguishable from the app being broken.

  it("viewer sees no write controls and is told why", async () => {
    mockAuth("viewer");
    mockApis({ meals: [MEAL], acceptable: [ACCEPTABLE], docs: [] });
    render(<NutritionPlanPage />);
    await screen.findByText("Oatmeal");

    expect(screen.getByText(/read-only access/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upload document/i })).toBeNull();
    expect(screen.queryByLabelText(/add breakfast item/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /delete oatmeal/i })).toBeNull();
  });

  it("contributor gets the same read-only treatment", async () => {
    // No propose->approve path exists for nutrition, unlike every record page.
    mockAuth("contributor");
    mockApis({ meals: [MEAL] });
    render(<NutritionPlanPage />);
    await screen.findByText("Oatmeal");
    expect(screen.getByText(/read-only access/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/add breakfast item/i)).toBeNull();
  });

  it("viewer can still READ meal-type assignments", async () => {
    // Checkboxes are disabled, not hidden: which meals a food belongs to is
    // clinically useful information on its own.
    mockAuth("viewer");
    mockApis({ acceptable: [{ ...ACCEPTABLE, for_breakfast: true }] });
    render(<NutritionPlanPage />);
    fireEvent.click(await screen.findByText("Acceptable Foods"));
    await screen.findAllByText("Banana");
    const cb = screen.getByLabelText(/banana for breakfast/i) as HTMLInputElement;
    expect(cb.checked).toBe(true);
    expect(cb.disabled).toBe(true);
  });

  it("admin keeps every write control", async () => {
    mockAuth("admin");
    mockApis({ meals: [MEAL] });
    render(<NutritionPlanPage />);
    await screen.findByText("Oatmeal");
    expect(screen.queryByText(/read-only access/i)).toBeNull();
    expect(screen.getByRole("button", { name: /upload document/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/add breakfast item/i)).toBeInTheDocument();
  });
});
