import importlib
import logging

import structlog

import core.logging as log_config


def test_get_logger_returns_bound_logger():
    log_config.configure_logging()
    logger = log_config.get_logger("test")
    assert hasattr(logger, "info")
    # structlog bound logger renders without raising
    logger.info("hello", key="value")


def test_configure_is_idempotent():
    log_config.configure_logging()
    log_config.configure_logging()
    assert structlog.is_configured()


def test_sentry_not_initialized_without_dsn(monkeypatch):
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    import sentry_sdk

    importlib.reload(log_config)
    log_config.configure_logging()
    # No DSN => Sentry client is not active
    assert sentry_sdk.Hub.current.client is None


def test_sentry_initialized_with_dsn(monkeypatch):
    monkeypatch.setenv("SENTRY_DSN", "https://public@example.glitchtip.test/1")
    importlib.reload(log_config)
    log_config.configure_logging()
    import sentry_sdk

    assert sentry_sdk.Hub.current.client is not None
    # cleanup for other tests
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    importlib.reload(log_config)
