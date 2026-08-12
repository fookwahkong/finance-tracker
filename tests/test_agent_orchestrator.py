from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock
from zoneinfo import ZoneInfo

import anthropic
import httpx

from core.agent.orchestrator import MAX_TOOL_ITERATIONS, run_agent_turn
from core.agent.tools import TOOLS


def text_response(text):
    return SimpleNamespace(
        content=[SimpleNamespace(type="text", text=text)],
        stop_reason="end_turn",
    )


def tool_use_response(tool_id, name, input_):
    return SimpleNamespace(
        content=[SimpleNamespace(type="tool_use", id=tool_id, name=name, input=input_)],
        stop_reason="tool_use",
    )


def test_single_turn_reply_no_tools(monkeypatch):
    client = MagicMock()
    client.messages.create.return_value = text_response("You spent $200 this month.")
    monkeypatch.setattr("core.agent.orchestrator._client", client)

    result = run_agent_turn(db=None, message="How much did I spend?", history=[])

    assert result["reply"] == "You spent $200 this month."
    assert result["history"][-1] == {
        "role": "assistant",
        "content": [{"type": "text", "text": "You spent $200 this month."}],
    }


def test_thinking_block_is_preserved_and_excluded_from_reply_text(monkeypatch):
    client = MagicMock()
    client.messages.create.return_value = SimpleNamespace(
        content=[
            SimpleNamespace(type="thinking", thinking="reasoning about the answer", signature="sig123"),
            SimpleNamespace(type="text", text="You spent $200 this month."),
        ],
        stop_reason="end_turn",
    )
    monkeypatch.setattr("core.agent.orchestrator._client", client)

    result = run_agent_turn(db=None, message="How much did I spend?", history=[])

    assert result["reply"] == "You spent $200 this month."
    assert result["history"][-1] == {
        "role": "assistant",
        "content": [
            {"type": "thinking", "thinking": "reasoning about the answer", "signature": "sig123"},
            {"type": "text", "text": "You spent $200 this month."},
        ],
    }


def test_executes_tool_call_and_continues_loop(monkeypatch):
    client = MagicMock()
    client.messages.create.side_effect = [
        tool_use_response("t1", "get_spending_summary", {"month": "2026-08"}),
        text_response("You're on track."),
    ]
    monkeypatch.setattr("core.agent.orchestrator._client", client)

    fake_tool = MagicMock(return_value={"total_expenses": -200})
    monkeypatch.setitem(
        TOOLS, "get_spending_summary", {"description": "x", "input_schema": {}, "run": fake_tool}
    )

    db = object()
    result = run_agent_turn(db=db, message="How's my spending?", history=[])

    assert result["reply"] == "You're on track."
    fake_tool.assert_called_once_with(db, month="2026-08")
    tool_result_msg = result["history"][2]
    assert tool_result_msg["role"] == "user"
    assert tool_result_msg["content"][0]["type"] == "tool_result"
    assert tool_result_msg["content"][0]["tool_use_id"] == "t1"


def test_stops_after_max_iterations(monkeypatch):
    client = MagicMock()
    client.messages.create.return_value = tool_use_response("t1", "get_spending_summary", {"month": "2026-08"})
    monkeypatch.setattr("core.agent.orchestrator._client", client)

    fake_tool = MagicMock(return_value={})
    monkeypatch.setitem(
        TOOLS, "get_spending_summary", {"description": "x", "input_schema": {}, "run": fake_tool}
    )

    result = run_agent_turn(db=None, message="loop forever", history=[])

    assert client.messages.create.call_count == MAX_TOOL_ITERATIONS
    assert "narrower" in result["reply"] or "steps" in result["reply"]


def test_injects_singapore_date_context_on_new_conversation(monkeypatch):
    fixed_now = datetime(2026, 8, 12, 14, 30, tzinfo=ZoneInfo("Asia/Singapore"))
    monkeypatch.setattr("core.agent.orchestrator._now_sgt", lambda: fixed_now)
    client = MagicMock()
    client.messages.create.return_value = text_response("ok")
    monkeypatch.setattr("core.agent.orchestrator._client", client)

    run_agent_turn(db=None, message="How much did I spend this month?", history=[])

    sent_messages = client.messages.create.call_args.kwargs["messages"]
    first_user_content = sent_messages[0]["content"]
    assert "Singapore" in first_user_content
    assert "2026-08-12" in first_user_content
    assert "How much did I spend this month?" in first_user_content


def test_does_not_reinject_date_context_when_history_present(monkeypatch):
    client = MagicMock()
    client.messages.create.return_value = text_response("ok")
    monkeypatch.setattr("core.agent.orchestrator._client", client)

    existing_history = [
        {"role": "user", "content": "(Context: today is Wednesday, 2026-08-12 14:30 Singapore time (UTC+8)...)\n\nHi"},
        {"role": "assistant", "content": [{"type": "text", "text": "Hi there!"}]},
    ]
    run_agent_turn(db=None, message="And last week?", history=existing_history)

    sent_messages = client.messages.create.call_args.kwargs["messages"]
    new_user_content = sent_messages[len(existing_history)]["content"]
    assert new_user_content == "And last week?"


def test_rate_limit_error_returns_friendly_message(monkeypatch):
    client = MagicMock()
    response = httpx.Response(429, request=httpx.Request("POST", "http://test"))
    client.messages.create.side_effect = anthropic.RateLimitError(
        "rate limited", response=response, body=None
    )
    monkeypatch.setattr("core.agent.orchestrator._client", client)

    original_history = [{"role": "user", "content": "earlier message"}]
    result = run_agent_turn(db=None, message="one more question", history=original_history)

    assert "tomorrow" in result["reply"]
    assert result["history"] == original_history
