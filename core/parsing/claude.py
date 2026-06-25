import os


class ClaudeProvider:
    def __init__(self):
        import anthropic

        self._client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        self._model = os.environ.get("CLAUDE_MODEL", "claude-haiku-4-5")

    def complete(self, system: str, user: str) -> str:
        message = self._client.messages.create(
            model=self._model,
            max_tokens=512,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return message.content[0].text
