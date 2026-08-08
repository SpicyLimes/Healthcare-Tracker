from pydantic import BaseModel, ConfigDict


class RelatedItemRead(BaseModel):
    id: str
    title: str
    date: str | None


class RelatedGroupRead(BaseModel):
    """Records linked to a doctor through one clinical role."""

    model_config = ConfigDict(from_attributes=True)

    role: str
    section: str
    count: int
    items: list[RelatedItemRead]
