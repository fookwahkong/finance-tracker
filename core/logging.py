import logging
import os

import structlog

_configured = False


def configure_logging() -> None:
    """Configure stdlib logging + structlog. Idempotent. Local-first: stdout only.

    Initializes Sentry/GlitchTip only when SENTRY_DSN is set.
    """
    global _configured

    env = os.environ.get("APP_ENV", "prod")
    is_dev = env == "dev"

    logging.basicConfig(
        format="%(message)s",
        level=logging.INFO,
        handlers=[logging.StreamHandler()],
    )

    renderer = structlog.dev.ConsoleRenderer() if is_dev else structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    dsn = os.environ.get("SENTRY_DSN")
    if dsn:
        import sentry_sdk

        sentry_sdk.init(
            dsn=dsn,
            environment=env,
            traces_sample_rate=0.0,
        )

    _configured = True


def get_logger(name: str = "app") -> structlog.stdlib.BoundLogger:
    if not _configured:
        configure_logging()
    return structlog.get_logger(name)
