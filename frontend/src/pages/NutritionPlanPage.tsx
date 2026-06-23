// frontend/src/pages/NutritionPlanPage.tsx
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  mealsApi, acceptableFoodsApi, unacceptableFoodsApi, uploadNutritionDocument,
  type MealType, type NutritionMeal, type NutritionAcceptableFood, type NutritionUnacceptableFood,
} from "../api/nutritionPlan";
import { listAllDocuments, deleteDocument, getDownloadUrl, type DocumentRecord } from "../api/documents";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-field";
import { formatDate } from "@/lib/format";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MobileRecordList } from "@/components/MobileRecordList";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};
const MEAL_FLAG: Record<MealType, keyof NutritionAcceptableFood> = {
  breakfast: "for_breakfast",
  lunch: "for_lunch",
  dinner: "for_dinner",
  snacks: "for_snacks",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NutritionPlanPage() {
  const [meals, setMeals] = useState<NutritionMeal[]>([]);
  const [acceptableFoods, setAcceptableFoods] = useState<NutritionAcceptableFood[]>([]);
  const [unacceptableFoods, setUnacceptableFoods] = useState<NutritionUnacceptableFood[]>([]);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [error, setError] = useState("");

  // Card 1 add inputs per meal type
  const [card1Inputs, setCard1Inputs] = useState<Record<MealType, string>>({
    breakfast: "", lunch: "", dinner: "", snacks: "",
  });

  // Card 2 add input
  const [card2Input, setCard2Input] = useState("");
  // Card 2 inline edit
  const [editingAcceptableId, setEditingAcceptableId] = useState<string | null>(null);
  const [editingAcceptableValue, setEditingAcceptableValue] = useState("");

  // Card 3 add input
  const [card3Input, setCard3Input] = useState("");
  // Card 3 inline edit
  const [editingUnacceptableId, setEditingUnacceptableId] = useState<string | null>(null);
  const [editingUnacceptableValue, setEditingUnacceptableValue] = useState("");

  // Collapse state for Cards 2 & 3
  const [acceptableOpen, setAcceptableOpen] = useState(false);
  const [unacceptableOpen, setUnacceptableOpen] = useState(false);

  // Card 4 upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function reload() {
    const [m, af, uf, d] = await Promise.all([
      mealsApi.list(),
      acceptableFoodsApi.list(),
      unacceptableFoodsApi.list(),
      listAllDocuments("nutrition_plan"),
    ]);
    setMeals(m);
    setAcceptableFoods(af);
    setUnacceptableFoods(uf);
    setDocs(d);
  }

  useEffect(() => {
    reload().catch(() => setError("Failed to load nutrition data"));
  }, []);

  // Card 1: direct add
  async function handleCard1Add(e: FormEvent, mealType: MealType) {
    e.preventDefault();
    const food_name = card1Inputs[mealType].trim();
    if (!food_name) return;
    try {
      await mealsApi.create({ food_name, meal_type: mealType });
      setCard1Inputs((s) => ({ ...s, [mealType]: "" }));
      await reload();
    } catch {
      setError("Could not add meal");
    }
  }

  // Card 1: delete — also clear the corresponding acceptable-food flag so the checkbox stays in sync
  async function handleCard1Delete(id: string) {
    try {
      const meal = meals.find((m) => m.id === id);
      await mealsApi.remove(id);
      if (meal) {
        const flag = MEAL_FLAG[meal.meal_type];
        const matchingFood = acceptableFoods.find(
          (f) => f.food_name === meal.food_name && (f[flag] as boolean)
        );
        if (matchingFood) {
          await acceptableFoodsApi.patch(matchingFood.id, { [flag]: false });
        }
      }
      await reload();
    } catch {
      setError("Could not delete meal");
    }
  }

  // Card 2: checkbox toggle
  async function handleCheckbox(food: NutritionAcceptableFood, mealType: MealType) {
    const flag = MEAL_FLAG[mealType];
    const isChecked = food[flag] as boolean;
    try {
      if (!isChecked) {
        // Check: create meal entry + patch flag
        await mealsApi.create({ food_name: food.food_name, meal_type: mealType });
        await acceptableFoodsApi.patch(food.id, { [flag]: true });
      } else {
        // Uncheck: delete matching meal + patch flag
        const match = meals.find(
          (m) => m.food_name === food.food_name && m.meal_type === mealType
        );
        if (match) await mealsApi.remove(match.id);
        await acceptableFoodsApi.patch(food.id, { [flag]: false });
      }
      await reload();
    } catch {
      setError("Could not update food assignment");
    }
  }

  // Card 2: add acceptable food
  async function handleCard2Add(e: FormEvent) {
    e.preventDefault();
    const food_name = card2Input.trim();
    if (!food_name) return;
    try {
      await acceptableFoodsApi.create({ food_name });
      setCard2Input("");
      await reload();
    } catch {
      setError("Could not add acceptable food");
    }
  }

  // Card 2: save inline edit
  async function handleAcceptableEditSave(id: string) {
    try {
      await acceptableFoodsApi.patch(id, { food_name: editingAcceptableValue });
      setEditingAcceptableId(null);
      await reload();
    } catch {
      setError("Could not update food name");
    }
  }

  // Card 2: delete acceptable food
  async function handleAcceptableDelete(id: string) {
    try {
      await acceptableFoodsApi.remove(id);
      await reload();
    } catch {
      setError("Could not delete acceptable food");
    }
  }

  // Card 3: add unacceptable food
  async function handleCard3Add(e: FormEvent) {
    e.preventDefault();
    const food_name = card3Input.trim();
    if (!food_name) return;
    try {
      await unacceptableFoodsApi.create({ food_name });
      setCard3Input("");
      await reload();
    } catch {
      setError("Could not add unacceptable food");
    }
  }

  // Card 3: save inline edit
  async function handleUnacceptableEditSave(id: string) {
    try {
      await unacceptableFoodsApi.patch(id, { food_name: editingUnacceptableValue });
      setEditingUnacceptableId(null);
      await reload();
    } catch {
      setError("Could not update food name");
    }
  }

  // Card 3: delete unacceptable food
  async function handleUnacceptableDelete(id: string) {
    try {
      await unacceptableFoodsApi.remove(id);
      await reload();
    } catch {
      setError("Could not delete unacceptable food");
    }
  }

  // Card 4: upload document
  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await uploadNutritionDocument(file);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Card 4: delete document
  async function handleDocDelete(id: number) {
    try {
      await deleteDocument(id);
      await reload();
    } catch {
      setError("Could not delete document");
    }
  }

  return (
    <AppShell>
      <PageLayout title="Nutrition Plan" description="Manage meals, acceptable foods, and dietary restrictions.">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {/* Card 1 — Meals */}
        <Card>
          <CardContent className="py-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">Meals</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {MEAL_TYPES.map((mealType) => {
                const entries = meals.filter((m) => m.meal_type === mealType);
                return (
                  <div key={mealType} className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-foreground">{MEAL_LABELS[mealType]}</p>
                    {entries.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No items yet.</p>
                    ) : (
                      <ul className="list-none flex flex-col gap-1">
                        {entries.map((meal) => (
                          <li key={meal.id} className="flex items-center justify-between gap-1 rounded-md border border-border bg-muted/20 px-2 py-1 text-sm">
                            <span className="text-foreground truncate">{meal.food_name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1 text-destructive hover:text-destructive shrink-0"
                              onClick={() => handleCard1Delete(meal.id)}
                              aria-label={`Delete ${meal.food_name}`}
                            >
                              ✕
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form onSubmit={(e) => handleCard1Add(e, mealType)} className="flex gap-1 mt-1">
                      <Input
                        placeholder="Add item…"
                        value={card1Inputs[mealType]}
                        onChange={(e) => setCard1Inputs((s) => ({ ...s, [mealType]: e.target.value }))}
                        className="h-7 text-xs"
                        aria-label={`Add ${mealType} item`}
                      />
                      <Button type="submit" size="sm" className="h-7 px-2 text-xs shrink-0">Add</Button>
                    </form>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Card 2 — Acceptable Foods */}
        <Card>
          <CardContent className="py-3">
            <button
              className="flex w-full items-center justify-between py-1 text-left"
              onClick={() => setAcceptableOpen((o) => !o)}
              aria-expanded={acceptableOpen}
            >
              <span className="text-base font-semibold text-foreground">Acceptable Foods</span>
              {acceptableOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {acceptableOpen && (
              <>
                <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {acceptableFoods.length === 0 && (
                    <p className="text-xs text-muted-foreground col-span-2">No acceptable foods added yet.</p>
                  )}
                  {acceptableFoods.map((food) => (
                    <div key={food.id} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                      {editingAcceptableId === food.id ? (
                        <div className="flex gap-1">
                          <Input
                            value={editingAcceptableValue}
                            onChange={(e) => setEditingAcceptableValue(e.target.value)}
                            className="h-7 text-xs flex-1"
                            aria-label="Edit food name"
                          />
                          <Button size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => handleAcceptableEditSave(food.id)}>Save</Button>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => setEditingAcceptableId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-foreground truncate">{food.food_name}</span>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => { setEditingAcceptableId(food.id); setEditingAcceptableValue(food.food_name); }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => handleAcceptableDelete(food.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                            {MEAL_TYPES.map((mt) => (
                              <label key={mt} className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={food[MEAL_FLAG[mt]] as boolean}
                                  onChange={() => handleCheckbox(food, mt)}
                                  aria-label={`${food.food_name} for ${mt}`}
                                  className="rounded border-border"
                                />
                                {MEAL_LABELS[mt]}
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <form onSubmit={handleCard2Add} className="mt-3 flex gap-2">
                  <Input
                    placeholder="Add acceptable food…"
                    value={card2Input}
                    onChange={(e) => setCard2Input(e.target.value)}
                    aria-label="Add acceptable food"
                  />
                  <Button type="submit" size="sm" className="shrink-0">Add</Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 3 — Unacceptable Foods */}
        <Card>
          <CardContent className="py-3">
            <button
              className="flex w-full items-center justify-between py-1 text-left"
              onClick={() => setUnacceptableOpen((o) => !o)}
              aria-expanded={unacceptableOpen}
            >
              <span className="text-base font-semibold text-foreground">Unacceptable Foods</span>
              {unacceptableOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {unacceptableOpen && (
              <>
                <div className="mt-4 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {unacceptableFoods.length === 0 && (
                    <p className="text-xs text-muted-foreground col-span-2">No unacceptable foods added yet.</p>
                  )}
                  {unacceptableFoods.map((food) => (
                    <div key={food.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                      {editingUnacceptableId === food.id ? (
                        <div className="flex flex-1 gap-1">
                          <Input
                            value={editingUnacceptableValue}
                            onChange={(e) => setEditingUnacceptableValue(e.target.value)}
                            className="h-7 text-xs flex-1"
                            aria-label="Edit food name"
                          />
                          <Button size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => handleUnacceptableEditSave(food.id)}>Save</Button>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => setEditingUnacceptableId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 text-foreground truncate">{food.food_name}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs shrink-0"
                            onClick={() => {
                              setEditingUnacceptableId(food.id);
                              setEditingUnacceptableValue(food.food_name);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive shrink-0"
                            onClick={() => handleUnacceptableDelete(food.id)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <form onSubmit={handleCard3Add} className="mt-3 flex gap-2">
                  <Input
                    placeholder="Add unacceptable food…"
                    value={card3Input}
                    onChange={(e) => setCard3Input(e.target.value)}
                    aria-label="Add unacceptable food"
                  />
                  <Button type="submit" size="sm" className="shrink-0">Add</Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 4 — Documents */}
        <Card>
          <CardContent className="py-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-foreground">Documents</h2>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.txt,.csv"
                  onChange={handleDocUpload}
                  aria-label="Upload nutrition plan document"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Uploading…" : "Upload Document"}
                </Button>
              </div>
            </div>
            {docs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <>
                <div className="md:hidden">
                  <MobileRecordList
                    records={docs}
                    getHeadline={(doc) => doc.filename}
                    getSubtitle={(doc) => `${formatBytes(doc.file_size)} · ${formatDate(doc.uploaded_at)}`}
                    getFields={(doc) => [
                      { key: "Size", value: formatBytes(doc.file_size) },
                      { key: "Uploaded", value: formatDate(doc.uploaded_at) },
                    ]}
                    expandedContent={(doc) => (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={getDownloadUrl(doc.id)} target="_blank" rel="noopener noreferrer">Open</a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDocDelete(doc.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                    emptyMessage="No documents uploaded yet."
                  />
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Filename</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Size</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Uploaded</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map((doc) => (
                        <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium text-foreground">{doc.filename}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatBytes(doc.file_size)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(doc.uploaded_at)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" asChild>
                                <a href={getDownloadUrl(doc.id)} target="_blank" rel="noopener noreferrer">
                                  Open
                                </a>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDocDelete(doc.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </PageLayout>
    </AppShell>
  );
}
