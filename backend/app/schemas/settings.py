from pydantic import BaseModel, ConfigDict


class AiSettingsRead(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)
    enabled: bool
    base_url: str | None
    model: str | None


class AiSettingsUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    enabled: bool | None = None
    base_url: str | None = None
    model: str | None = None


class AiConnectionTest(BaseModel):
    reachable: bool
    detail: str
