# backend/app/schemas/nutrition.py
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.nutrition import MealType


class NutritionMealCreate(BaseModel):
    food_name: str
    meal_type: MealType


class NutritionMealResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    food_name: str
    meal_type: MealType
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class NutritionAcceptableFoodCreate(BaseModel):
    food_name: str


class NutritionAcceptableFoodPatch(BaseModel):
    food_name: str | None = None
    for_breakfast: bool | None = None
    for_lunch: bool | None = None
    for_dinner: bool | None = None
    for_snacks: bool | None = None


class NutritionAcceptableFoodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    food_name: str
    for_breakfast: bool
    for_lunch: bool
    for_dinner: bool
    for_snacks: bool
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class NutritionUnacceptableFoodCreate(BaseModel):
    food_name: str


class NutritionUnacceptableFoodPatch(BaseModel):
    food_name: str | None = None


class NutritionUnacceptableFoodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    food_name: str
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
