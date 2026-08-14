import base64
import os


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
        return message.content[0].text

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
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": content}],
        )
        return message.content[0].text
