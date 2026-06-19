import os

import httpx


class OllamaProvider:
    def __init__(self):
        self._host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
        self._model = os.environ.get("OLLAMA_MODEL", "llama3.1")

    def complete(self, system: str, user: str) -> str:
        try:
            resp = httpx.post(
                f"{self._host}/api/chat",
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "stream": False,
                    "format": "json",
                },
                timeout=60,
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Ollama unreachable at {self._host}: {exc}") from exc
        return resp.json()["message"]["content"]
