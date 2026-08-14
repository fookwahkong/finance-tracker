"""Claude tool-use loop for the chat agent (ai-agent.md phase 1).

The client holds conversation history and resends it each turn; nothing
here persists it. Tools are read-only in phase 1, so this is the only LLM
call site and the only place rate-limit/credit errors need handling.
"""

import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo

import anthropic

from core.agent.tools import TOOLS

MODEL = os.environ.get("AGENT_CLAUDE_MODEL", "claude-sonnet-5")
MAX_TOOL_ITERATIONS = 5

_SYSTEM = (
    "You are a helpful assistant inside a personal finance app. Answer "
    "questions about the user's spending, budgets, savings goals, and "
    "investment portfolio. Always call a tool to look up real numbers "
    "instead of guessing or recalling from earlier in the conversation. "
    'When the user references a relative date ("this month", "last week", '
    '"today"), resolve it against the date given at the start of the '
    "conversation. Format replies in concise markdown — bold for key figures, "
    "bullet lists for multiple items — and keep prose tight, no filler or "
    "repeated disclaimers."
)

_RATE_LIMIT_REPLY = "I'm rate-limited right now — try again tomorrow."
_ITERATIONS_EXCEEDED_REPLY = "I wasn't able to finish that within the allowed number of steps — try asking something narrower."

_client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


def _tool_specs() -> list[dict]:
    return [
        {"name": name, "description": tool["description"], "input_schema": tool["input_schema"]}
        for name, tool in TOOLS.items()
    ]


def _block_to_dict(block) -> dict:
    if block.type == "text":
        return {"type": "text", "text": block.text}
    if block.type == "thinking":
        return {"type": "thinking", "thinking": block.thinking, "signature": block.signature}
    if block.type == "redacted_thinking":
        return {"type": "redacted_thinking", "data": block.data}
    return {"type": "tool_use", "id": block.id, "name": block.name, "input": block.input}


def _reply_text(content_blocks: list[dict]) -> str:
    return "".join(b["text"] for b in content_blocks if b["type"] == "text")


def _now_sgt() -> datetime:
    return datetime.now(ZoneInfo("Asia/Singapore"))


def _with_date_context(message: str) -> str:
    now = _now_sgt()
    context = (
        f"(Context: today is {now.strftime('%A, %Y-%m-%d %H:%M')} Singapore time (UTC+8). "
        'Resolve relative dates like "this month", "last week", or "today" against this date.)'
    )
    return f"{context}\n\n{message}"


def run_agent_turn(db, message: str, history: list[dict]) -> dict:
    if not history:
        message = _with_date_context(message)
    messages = [*history, {"role": "user", "content": message}]

    for _ in range(MAX_TOOL_ITERATIONS):
        try:
            response = _client.messages.create(
                model=MODEL,
                max_tokens=1024,
                system=_SYSTEM,
                tools=_tool_specs(),
                messages=messages,
            )
        except anthropic.APIStatusError:
            return {"reply": _RATE_LIMIT_REPLY, "history": history}

        content = [_block_to_dict(b) for b in response.content]
        messages.append({"role": "assistant", "content": content})

        if response.stop_reason != "tool_use":
            return {"reply": _reply_text(content), "history": messages}

        tool_results = []
        for block in content:
            if block["type"] != "tool_use":
                continue
            result = TOOLS[block["name"]]["run"](db, **block["input"])
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block["id"],
                    "content": json.dumps(result),
                }
            )
        messages.append({"role": "user", "content": tool_results})

    return {"reply": _ITERATIONS_EXCEEDED_REPLY, "history": messages}
