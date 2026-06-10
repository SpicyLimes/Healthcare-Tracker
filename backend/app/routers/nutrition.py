# backend/app/routers/nutrition.py
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.nutrition import MealType, NutritionAcceptableFood, NutritionMeal, NutritionUnacceptableFood
from app.models.user import User
from app.schemas.nutrition import (
    NutritionAcceptableFoodCreate,
    NutritionAcceptableFoodPatch,
    NutritionAcceptableFoodResponse,
    NutritionMealCreate,
    NutritionMealResponse,
    NutritionUnacceptableFoodCreate,
    NutritionUnacceptableFoodPatch,
    NutritionUnacceptableFoodResponse,
)
from app.security.dependencies import get_current_user, require_admin, verify_csrf

router = APIRouter(prefix="/api/nutrition", tags=["nutrition"])


# ---------------------------------------------------------------------------
# Meals
# ---------------------------------------------------------------------------

@router.get("/meals", response_model=list[NutritionMealResponse])
def list_meals(
    meal_type: Optional[MealType] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(NutritionMeal).order_by(NutritionMeal.created_at)
    if meal_type is not None:
        stmt = stmt.where(NutritionMeal.meal_type == meal_type)
    return db.execute(stmt).scalars().all()


@router.post(
    "/meals",
    response_model=NutritionMealResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
def create_meal(
    payload: NutritionMealCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    meal = NutritionMeal(
        id=uuid.uuid4(),
        food_name=payload.food_name,
        meal_type=payload.meal_type,
        created_by=current.id,
    )
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return meal


@router.delete(
    "/meals/{meal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
def delete_meal(
    meal_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    meal = db.get(NutritionMeal, meal_id)
    if meal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    db.delete(meal)
    db.commit()


# ---------------------------------------------------------------------------
# Acceptable foods
# ---------------------------------------------------------------------------

@router.get("/acceptable-foods", response_model=list[NutritionAcceptableFoodResponse])
def list_acceptable_foods(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.execute(select(NutritionAcceptableFood).order_by(NutritionAcceptableFood.food_name)).scalars().all()


@router.post(
    "/acceptable-foods",
    response_model=NutritionAcceptableFoodResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
def create_acceptable_food(
    payload: NutritionAcceptableFoodCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    food = NutritionAcceptableFood(id=uuid.uuid4(), food_name=payload.food_name, created_by=current.id)
    db.add(food)
    db.commit()
    db.refresh(food)
    return food


@router.patch(
    "/acceptable-foods/{food_id}",
    response_model=NutritionAcceptableFoodResponse,
    dependencies=[Depends(verify_csrf)],
)
def patch_acceptable_food(
    food_id: uuid.UUID,
    payload: NutritionAcceptableFoodPatch,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    food = db.get(NutritionAcceptableFood, food_id)
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(food, field, value)
    db.commit()
    db.refresh(food)
    return food


@router.delete(
    "/acceptable-foods/{food_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
def delete_acceptable_food(
    food_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    food = db.get(NutritionAcceptableFood, food_id)
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    db.delete(food)
    db.commit()


# ---------------------------------------------------------------------------
# Unacceptable foods
# ---------------------------------------------------------------------------

@router.get("/unacceptable-foods", response_model=list[NutritionUnacceptableFoodResponse])
def list_unacceptable_foods(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.execute(select(NutritionUnacceptableFood).order_by(NutritionUnacceptableFood.food_name)).scalars().all()


@router.post(
    "/unacceptable-foods",
    response_model=NutritionUnacceptableFoodResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
def create_unacceptable_food(
    payload: NutritionUnacceptableFoodCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    food = NutritionUnacceptableFood(id=uuid.uuid4(), food_name=payload.food_name, created_by=current.id)
    db.add(food)
    db.commit()
    db.refresh(food)
    return food


@router.patch(
    "/unacceptable-foods/{food_id}",
    response_model=NutritionUnacceptableFoodResponse,
    dependencies=[Depends(verify_csrf)],
)
def patch_unacceptable_food(
    food_id: uuid.UUID,
    payload: NutritionUnacceptableFoodPatch,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    food = db.get(NutritionUnacceptableFood, food_id)
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(food, field, value)
    db.commit()
    db.refresh(food)
    return food


@router.delete(
    "/unacceptable-foods/{food_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
def delete_unacceptable_food(
    food_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    food = db.get(NutritionUnacceptableFood, food_id)
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    db.delete(food)
    db.commit()
