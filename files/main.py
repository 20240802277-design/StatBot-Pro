from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from app.routers import analysis, health

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure charts directory exists
    charts_dir = os.getenv("CHARTS_DIR", "static/charts")
    os.makedirs(charts_dir, exist_ok=True)
    print(f"✅ StatBot Pro API started. Charts dir: {charts_dir}")
    yield
    print("👋 StatBot Pro API shutting down.")


app = FastAPI(
    title="StatBot Pro API",
    description="Autonomous CSV Data Analyst Agent — powered by LangChain + GPT-4",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files (generated charts)
charts_dir = os.getenv("CHARTS_DIR", "static/charts")
os.makedirs(charts_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])


@app.get("/")
async def root():
    return {
        "name": "StatBot Pro",
        "tagline": "Autonomous CSV Data Analyst Agent",
        "version": "1.0.0",
        "docs": "/docs",
    }
