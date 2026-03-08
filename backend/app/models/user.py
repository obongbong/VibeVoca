"""
VibeVoca - User ORM Model
SQLAlchemy 2.0 (Async-compatible) declarative model for Users.
"""
from __future__ import annotations

import uuid
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base
from app.models.voca import TimestampMixin

class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    nickname: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    # Social Login info
    provider: Mapped[str] = mapped_column(String(20), nullable=False, comment="e.g., 'kakao', 'google', 'apple', 'mock'")
    social_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False, comment="Unique ID from the social provider")

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
