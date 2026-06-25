from core.parsing import _get_provider
from core.parsing.extract import extract_json
from .prompt import BATCH_SYSTEM_PROMPT


def _build_user(descriptions: list[str], categories: list[str]) -> str:
    numbered = "\n".join(f"{i + 1}. {d}" for i, d in enumerate(descriptions))
    return (
        f"Existing categories: {', '.join(categories)}\n\n"
        f"Descriptions:\n{numbered}"
    )


def categorize_rows(descriptions: list[str], categories: list[str]) -> list[dict]:
    if not descriptions:
        return []

    provider = _get_provider()
    raw = provider.complete(BATCH_SYSTEM_PROMPT, _build_user(descriptions, categories))

    try:
        results = extract_json(raw).get("rows", [])
    except (ValueError, AttributeError):
        results = []

    out: list[dict] = []
    for i, desc in enumerate(descriptions):
        result = results[i] if i < len(results) else {}
        category = result.get("category") or None
        out.append({
            "item": result.get("item") or desc.split("\n")[0],
            "category": category,
            "is_new": bool(category) and category not in categories,
        })
    return out
