from pydantic import BaseModel, EmailStr, Field


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class TokenPayload(BaseModel):
    sub: str
    email: EmailStr | None = None
    roles: list[str] = Field(default_factory=list)
    jti: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserPublic"


class AuthenticatedUser(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    roles: list[str]


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str

    model_config = {
        "from_attributes": True
    }


class SignoutRequest(BaseModel):
    refresh_token: str | None = None


TokenResponse.model_rebuild()
