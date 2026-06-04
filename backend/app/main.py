from fastapi import FastAPI

from app.routers import auth, health

app = FastAPI(title="Healthcare Tracker API", version="0.2.0")
app.include_router(health.router)
app.include_router(auth.router)
