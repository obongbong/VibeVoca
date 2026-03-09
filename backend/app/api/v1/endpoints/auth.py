"""
VibeVoca - Auth API Endpoints
Handles login and token generation.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import uuid
import requests

from app.db.session import get_db
from app.models.user import User
from app.models.voca import UserWordProgress
from app.core.config import get_settings
from app.core.security import create_access_token
from app.api.deps import get_current_user

settings = get_settings()

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete the current logged-in user and all their progress data.
    """
    # The get_current_user dependency already ensures that current_user is not None
    # and raises HTTPException(401) if not authenticated.
    
    user_id_str = str(current_user.id)
    
    # 1. Delete user progress data
    # (Since FK is not yet formally cascading in the DB schema, we do it manually)
    await db.execute(
        delete(UserWordProgress).where(UserWordProgress.user_id == user_id_str)
    )
    
    # 2. Delete the user
    await db.delete(current_user)
    
    await db.commit()
    return None

@router.post("/login/mock", response_model=Token)
async def mock_login(
    req: MockLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    [Development Only] Mock login endpoint.
    Creates a user if the nickname doesn't exist and returns a JWT token.
    """
    stmt = select(User).where(User.nickname == req.nickname, User.provider == "mock")
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        # Create new mock user
        user = User(
            id=uuid.uuid4(),
            nickname=req.nickname,
            provider="mock",
            social_id=f"mock_{req.nickname}",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token = create_access_token(subject=str(user.id))
    return Token(access_token=access_token, token_type="bearer")

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

@router.post("/login/social", response_model=Token)
async def social_login(
    req: SocialLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    [Production] Social login endpoint.
    Validates token with provider (kakao, google), finds or creates user, returns our JWT.
    """
    GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID
    email = None
    nickname = None
    social_id = None
    
    if req.provider == 'google':
        try:
            # req.access_token contains the id_token from Google
            idinfo = id_token.verify_oauth2_token(
                req.access_token, 
                google_requests.Request(), 
                GOOGLE_CLIENT_ID
            )
            
            social_id = idinfo['sub']
            email = idinfo.get('email')
            nickname = idinfo.get('name', 'GoogleUser')
            
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Google token")
    elif req.provider == 'kakao':
        headers = {
            "Authorization": f"Bearer {req.access_token}",
            "Content-type": "application/x-www-form-urlencoded;charset=utf-8"
        }
        res = requests.get("https://kapi.kakao.com/v2/user/me", headers=headers)
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid Kakao token")
        
        kakao_data = res.json()
        social_id = str(kakao_data.get("id"))
        
        # Kakao nickname is usually in properties -> nickname
        properties = kakao_data.get("properties", {})
        nickname = properties.get("nickname", "KakaoUser")
        
        # Kakao email is usually in kakao_account -> email
        kakao_account = kakao_data.get("kakao_account", {})
        email = kakao_account.get("email")
    else:
        # Placeholder for other providers like 'apple'
        social_id = f"{req.provider}_mock_id_12345"
        email = f"user@{req.provider}.com"
        nickname = f"{req.provider}User"
    
    stmt = select(User).where(User.provider == req.provider, User.social_id == social_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            id=uuid.uuid4(),
            email=email,
            nickname=nickname,
            provider=req.provider,
            social_id=social_id,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token = create_access_token(subject=str(user.id))
    return Token(access_token=access_token, token_type="bearer")

@router.get("/me", response_model=UserOut)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current logged in user details.
    """
    if current_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user
