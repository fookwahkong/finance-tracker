import base64
import os


def _text_content(message) -> str:
    # Some responses lead with a ThinkingBlock before the TextBlock, so the
    # text isn't reliably at content[0].
    for block in message.content:
        if block.type == "text":
            return block.text
    raise ValueError("Claude response contained no text block")


class ClaudeProvider:
    def __init__(self):
        import anthropic

        self._client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        self._model = os.environ.get("CLAUDE_MODEL", "claude-haiku-4-5")
        self._vision_model = os.environ.get("STATEMENT_VISION_MODEL", "claude-sonnet-5")

    def complete(self, system: str, user: str) -> str:
        message = self._client.messages.create(
            model=self._model,
            max_tokens=512,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return _text_content(message)

    def complete_vision(self, system: str, user: str, images: list[bytes]) -> str:
        content: list[dict] = []
        for i, image in enumerate(images):
            if len(images) > 1:
                content.append({"type": "text", "text": f"Page {i + 1}:"})
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": base64.standard_b64encode(image).decode("ascii"),
                    },
                }
            )
        content.append({"type": "text", "text": user})

        message = self._client.messages.create(
            model=self._vision_model,
            max_tokens=16384,
            system=system,
            messages=[{"role": "user", "content": content}],
            # Without this, the model can spend the entire max_tokens budget on
            # extended thinking for a multi-page statement and return no answer
            # text at all (stop_reason "max_tokens", zero-length text block).
            thinking={"type": "disabled"},
        )
        return _text_content(message)
