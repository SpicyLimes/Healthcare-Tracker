// frontend/src/api/nutritionPlan.ts
import { apiFetch } from "./client";
import { csrfHeader } from "./csrf";

const jsonWrite = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json", ...csrfHeader() },
  body: JSON.stringify(body),
});

export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

export interface NutritionMeal {
  id: string;
  food_name: string;
  meal_type: MealType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NutritionAcceptableFood {
  id: string;
  food_name: string;
  for_breakfast: boolean;
  for_lunch: boolean;
  for_dinner: boolean;
  for_snacks: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NutritionUnacceptableFood {
  id: string;
  food_name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const mealsApi = {
  async list(meal_type?: MealType): Promise<NutritionMeal[]> {
    const url = meal_type
      ? `/api/nutrition/meals?meal_type=${meal_type}`
      : "/api/nutrition/meals";
    const res = await apiFetch(url);
    if (!res.ok) throw new Error("Failed to load meals");
    return res.json();
  },
  async create(data: { food_name: string; meal_type: MealType }): Promise<NutritionMeal> {
    const res = await apiFetch("/api/nutrition/meals", { method: "POST", ...jsonWrite(data) });
    if (!res.ok) throw new Error("Failed to create meal");
    return res.json();
  },
  async remove(id: string): Promise<void> {
    const res = await apiFetch(`/api/nutrition/meals/${id}`, {
      method: "DELETE",
      headers: { ...csrfHeader() },
    });
    if (!res.ok) throw new Error("Failed to delete meal");
  },
};

export const acceptableFoodsApi = {
  async list(): Promise<NutritionAcceptableFood[]> {
    const res = await apiFetch("/api/nutrition/acceptable-foods");
    if (!res.ok) throw new Error("Failed to load acceptable foods");
    return res.json();
  },
  async create(data: { food_name: string }): Promise<NutritionAcceptableFood> {
    const res = await apiFetch("/api/nutrition/acceptable-foods", { method: "POST", ...jsonWrite(data) });
    if (!res.ok) throw new Error("Failed to create acceptable food");
    return res.json();
  },
  async patch(id: string, data: Partial<{
    food_name: string;
    for_breakfast: boolean;
    for_lunch: boolean;
    for_dinner: boolean;
    for_snacks: boolean;
  }>): Promise<NutritionAcceptableFood> {
    const res = await apiFetch(`/api/nutrition/acceptable-foods/${id}`, { method: "PATCH", ...jsonWrite(data) });
    if (!res.ok) throw new Error("Failed to update acceptable food");
    return res.json();
  },
  async remove(id: string): Promise<void> {
    const res = await apiFetch(`/api/nutrition/acceptable-foods/${id}`, {
      method: "DELETE",
      headers: { ...csrfHeader() },
    });
    if (!res.ok) throw new Error("Failed to delete acceptable food");
  },
};

export const unacceptableFoodsApi = {
  async list(): Promise<NutritionUnacceptableFood[]> {
    const res = await apiFetch("/api/nutrition/unacceptable-foods");
    if (!res.ok) throw new Error("Failed to load unacceptable foods");
    return res.json();
  },
  async create(data: { food_name: string }): Promise<NutritionUnacceptableFood> {
    const res = await apiFetch("/api/nutrition/unacceptable-foods", { method: "POST", ...jsonWrite(data) });
    if (!res.ok) throw new Error("Failed to create unacceptable food");
    return res.json();
  },
  async patch(id: string, data: { food_name: string }): Promise<NutritionUnacceptableFood> {
    const res = await apiFetch(`/api/nutrition/unacceptable-foods/${id}`, { method: "PATCH", ...jsonWrite(data) });
    if (!res.ok) throw new Error("Failed to update unacceptable food");
    return res.json();
  },
  async remove(id: string): Promise<void> {
    const res = await apiFetch(`/api/nutrition/unacceptable-foods/${id}`, {
      method: "DELETE",
      headers: { ...csrfHeader() },
    });
    if (!res.ok) throw new Error("Failed to delete unacceptable food");
  },
};

export async function uploadNutritionDocument(file: File): Promise<import("./documents").DocumentRecord> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch("/api/nutrition/documents", {
    method: "POST",
    headers: { ...csrfHeader() },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Upload failed");
  }
  return res.json();
}
