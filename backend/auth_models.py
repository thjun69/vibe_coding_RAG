from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

# 요청 모델들
class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=2, max_length=50, pattern="^[a-zA-Z0-9가-힣_\\-\\s]+$")
    password: str = Field(..., min_length=8, max_length=100)
    full_name: Optional[str] = Field(None, max_length=255)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# 응답 모델들
class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UserLoginResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "bearer"

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    email: Optional[str] = None

# 에러 응답
class AuthError(BaseModel):
    detail: str
    error_type: str = "auth_error"
