from fastapi import APIRouter, Depends
from supabase import Client

from backend.deps import enforce_ai_limit, get_db
from core.agent.orchestrator import run_agent_turn
from core.models import AgentChatRequest

router = APIRouter()


@router.post("/chat")
def chat(
    body: AgentChatRequest,
    db: Client = Depends(get_db),
    _: None = Depends(enforce_ai_limit),
):
    return run_agent_turn(db, message=body.message, history=body.history)
