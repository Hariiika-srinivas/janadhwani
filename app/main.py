"""
FastAPI Application Entry Point for JanaDhwani
"""
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse

from app.config import STATIC_DIR, DB_PATH
from app.db import init_db, get_connection
from engine.escalation import run_escalation_cycle
from routers import complaints, officers, dashboard, public, admin, demo

async def background_escalation_worker():
    """Background task running escalation cycle every 60 seconds."""
    while True:
        try:
            await asyncio.sleep(60)
            conn = get_connection()
            run_escalation_cycle(conn)
            conn.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Background escalation worker error: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database exists
    if not DB_PATH.exists():
        from app.seed import seed_database
        seed_database(reset=False)

    worker_task = asyncio.create_task(background_escalation_worker())
    yield
    # Shutdown
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="JanaDhwani Public Grievance Platform",
    description="Multilingual, voice-based public grievance registration, tracking, and escalation platform for Kalyana Karnataka Solvathon 2026.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(complaints.router)
app.include_router(officers.router)
app.include_router(dashboard.router)
app.include_router(public.router)
app.include_router(admin.router)
app.include_router(demo.router)

# Mount Static Files
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
def read_root():
    return {
        "platform": "JanaDhwani",
        "solvathon": "Kalyana Karnataka Solvathon 2026",
        "status": "OPERATIONAL",
        "docs_url": "/docs",
        "departments": ["HEALTH", "POLICE"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
