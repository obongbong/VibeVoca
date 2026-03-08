from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: Optional[str] = None

class SocialLoginRequest(BaseModel):
    provider: str
    access_token: str  # Token received from the social provider (e.g. Kakao's access token)

class MockLoginRequest(BaseModel):
    nickname: str

class UserOut(BaseModel):
    id: uuid.UUID
    email: Optional[EmailStr] = None
    nickname: Optional[str] = None
    provider: str
    is_premium: bool

    class Config:
        from_attributes = True
