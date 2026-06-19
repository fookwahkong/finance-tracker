import os
from datetime import date

from .extract import extract_json
from .prompt import SYSTEM_PROMPT

_provider = None


def _get_provider():
    global _provider
    if _provider is None:
        name = os.environ.get("LLM_PROVIDER", "claude").lower()
        if name == "claude":
            from .claude import ClaudeProvider

            _provider = ClaudeProvider()
        elif name == "ollama":
            from .ollama import OllamaProvider

            _provider = OllamaProvider()
        else:
            raise ValueError(
                f"Unknown LLM_PROVIDER: {name!r} (expected 'claude' or 'ollama')"
            )
    return _provider


def _build_user_msg(text: str, categories: list[str]) -> str:
    return (
        f"Today's date: {date.today().isoformat()}\n"
        f"Available categories: {', '.join(categories)}\n\n"
        f"Transaction: {text}"
    )


def parse_transaction(text: str, categories: list[str]) -> dict:
    provider = _get_provider()
    raw = provider.complete(SYSTEM_PROMPT, _build_user_msg(text, categories))
    return extract_json(raw)
