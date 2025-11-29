from datetime import timedelta
from functools import lru_cache
from typing import Any

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_DURATION_MULTIPLIERS = {
    "s": 1,
    "m": 60,
    "h": 60 * 60,
    "d": 60 * 60 * 24,
    "w": 60 * 60 * 24 * 7
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", populate_by_name=True)

    environment: str = Field(default="development", alias="NODE_ENV")
    app_name: str = Field(default="Varaaha", alias="APP_NAME")
    app_domain: str = Field(default="localhost", alias="APP_DOMAIN")
    api_base_url: str = Field(default="http://localhost:4000", alias="APP_URL")
    api_prefix: str = Field(default="/api")
    secret_key: str = Field(alias="JWT_SECRET")
    refresh_secret_key: str = Field(alias="JWT_REFRESH_SECRET")
    jwt_access_expires: str = Field(
        default="15m",
        validation_alias=AliasChoices("JWT_ACCESS_EXPIRES_IN", "JWT_ACCESS_EXPIRES_MINUTES")
    )
    jwt_refresh_expires: str = Field(
        default="7d",
        validation_alias=AliasChoices("JWT_REFRESH_EXPIRES_IN", "JWT_REFRESH_EXPIRES_DAYS")
    )

    database_host: str = Field(alias="DATABASE_HOST")
    database_port: int = Field(default=3306, alias="DATABASE_PORT")
    database_user: str = Field(alias="DATABASE_USER")
    database_password: str = Field(alias="DATABASE_PASSWORD")
    database_name: str = Field(alias="DATABASE_NAME")

    smtp_host: str | None = Field(default=None, alias="SMTP_HOST")
    smtp_port: int | None = Field(default=None, alias="SMTP_PORT")
    smtp_user: str | None = Field(default=None, alias="SMTP_USER")
    smtp_password: str | None = Field(default=None, alias="SMTP_PASSWORD")
    smtp_from: str | None = Field(default=None, alias="SMTP_FROM")
    smtp_secure: bool | None = Field(default=None, validation_alias=AliasChoices("SMTP_SECURE"))

    razorpay_key_id: str | None = Field(default=None, alias="RAZORPAY_KEY_ID")
    razorpay_key_secret: str | None = Field(default=None, alias="RAZORPAY_KEY_SECRET")
    razorpay_webhook_secret: str | None = Field(default=None, alias="RAZORPAY_WEBHOOK_SECRET")

    @field_validator("smtp_secure", mode="before")
    @classmethod
    def parse_smtp_secure(cls, value: Any) -> bool | None:
        if value in (None, "", "null", "None"):
            return None
        if isinstance(value, bool):
            return value
        value_str = str(value).strip().lower()
        if value_str in {"true", "1", "yes", "on"}:
            return True
        if value_str in {"false", "0", "no", "off"}:
            return False
        return None

    def database_dsn(self) -> str:
        return (
            f"mysql+asyncmy://{self.database_user}:{self.database_password}@"
            f"{self.database_host}:{self.database_port}/{self.database_name}"
        )

    @staticmethod
    def _parse_duration(value: str, fallback: timedelta) -> timedelta:
        if not value:
            return fallback
        trimmed = value.strip().lower()
        if trimmed.isdigit():
            # default to seconds if no unit supplied
            return timedelta(seconds=int(trimmed))
        number = ""
        unit = ""
        for char in trimmed:
            if char.isdigit():
                number += char
            else:
                unit += char
        if not number:
            return fallback
        multiplier = _DURATION_MULTIPLIERS.get(unit[:1], _DURATION_MULTIPLIERS["s"])
        return timedelta(seconds=int(number) * multiplier)

    @property
    def access_token_expiry(self) -> timedelta:
        return self._parse_duration(self.jwt_access_expires, timedelta(minutes=15))

    @property
    def refresh_token_expiry(self) -> timedelta:
        return self._parse_duration(self.jwt_refresh_expires, timedelta(days=7))


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings: Settings = get_settings()
