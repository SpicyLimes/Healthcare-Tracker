# backend/app/models/nutrition.py
import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MealType(str, enum.Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"
    snacks = "snacks"


class NutritionMeal(Base):
    __tablename__ = "nutrition_meals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meal_type: Mapped[MealType] = mapped_column(Enum(MealType, name="mealtype"), nullable=False)
    food_name: Mapped[str] = mapped_column(String, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class NutritionAcceptableFood(Base):
    __tablename__ = "nutrition_acceptable_foods"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    food_name: Mapped[str] = mapped_column(String, nullable=False)
    for_breakfast: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    for_lunch: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    for_dinner: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    for_snacks: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class NutritionUnacceptableFood(Base):
    __tablename__ = "nutrition_unacceptable_foods"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    food_name: Mapped[str] = mapped_column(String, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
