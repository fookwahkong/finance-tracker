from core.parsing import _get_provider
from core.parsing.extract import extract_json

from .prompt import BATCH_SYSTEM_PROMPT

# The shared provider caps output at ~512 tokens, so categorize in small
# chunks. Items are deduped first (e.g. "TOP-UP TO PAYLAH!" recurs dozens of
# times) to cut both the number of chunks and the token cost.
_CHUNK_SIZE = 25


def _build_user(items: list[str], categories: list[str]) -> str:
    numbered = "\n".join(f"{i + 1}. {it}" for i, it in enumerate(items))
    return f"Existing categories: {', '.join(categories)}\n\nMerchants:\n{numbered}"


def _categorize_chunk(items: list[str], categories: list[str]) -> list[str | None]:
    provider = _get_provider()
    raw = provider.complete(BATCH_SYSTEM_PROMPT, _build_user(items, categories))
    try:
        result = extract_json(raw).get("categories", [])
    except (ValueError, AttributeError):
        result = []
    return [(result[i] or None) if i < len(result) else None for i in range(len(items))]


def categorize_rows(items: list[str], categories: list[str]) -> list[dict]:
    """Map each item to {category, is_new}, deduping and chunking LLM calls."""
    if not items:
        return []

    unique = list(dict.fromkeys(items))
    mapping: dict[str, str | None] = {}
    for start in range(0, len(unique), _CHUNK_SIZE):
        chunk = unique[start : start + _CHUNK_SIZE]
        for item, category in zip(chunk, _categorize_chunk(chunk, categories)):
            mapping[item] = category

    known = set(categories)
    out = []
    for item in items:
        category = mapping.get(item)
        out.append(
            {
                "category": category,
                "is_new": bool(category) and category not in known,
            }
        )
    return out
