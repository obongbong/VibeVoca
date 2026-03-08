"""
VibeVoca - API Dependencies
Dependencies for retrieving the current user from JWT token.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core import security
from app.models.user import User
from app.schemas.auth import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login", # this is just a placeholder for swagger UI
    auto_error=False
)

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        # Fallback for development if no token is provided: 
        # (Remove or replace this when enforcing strict auth)
        return None
        
    payload = security.verify_token(token)
    if payload is None:
        raise credentials_exception
        
    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
        
    stmt = select(User).where(User.id == user_id_str)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return user
