"""annapod API Routers."""

from app.routers.auth import router as auth_router
from app.routers.simulator import router as simulator_router
from app.routers.knowledge import router as knowledge_router
from app.routers.learning import router as learning_router

__all__ = [
    "auth_router",
    "simulator_router",
    "knowledge_router",
    "learning_router",
]
