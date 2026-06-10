// frontend/src/pages/NutritionPlanPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NutritionPlanPage from "./NutritionPlanPage";
import * as nutritionModule from "../api/nutritionPlan";
import * as documentsModule from "../api/documents";
import * as useAuthModule from "../auth/useAuth";

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

function mockAuth() {
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    user: { id: "u1", email: "a@b.c", role: "admin" },
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
    expect(await screen.findByText("Banana")).toBeInTheDocument();
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
    expect(await screen.findByText("scan_2.pdf")).toBeInTheDocument();
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
    const checkbox = await screen.findByLabelText("Banana for breakfast");
    fireEvent.click(checkbox);
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
    const checkbox = await screen.findByLabelText("Banana for breakfast");
    fireEvent.click(checkbox);
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
    await screen.findByText("Banana");
    const editBtn = screen.getAllByRole("button", { name: /edit/i })[0];
    fireEvent.click(editBtn);
    const input = screen.getByLabelText("Edit food name");
    fireEvent.change(input, { target: { value: "Banana (ripe)" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
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
    await screen.findByText("Banana");
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
});
