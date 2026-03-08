"""
VibeVoca - Core ORM Models
SQLAlchemy 2.0 (Async-compatible) declarative models.

Tables
──────
  voca_words          : 단어 마스터 데이터
  voca_sets           : 수준별 단어 묶음 (기초 / 800점 / 900점)
  voca_set_mappings   : 단어 ↔ 묶음 N:M 연결 테이블
  user_word_progress  : 사용자 SRS 학습 로그 (SM-2 파라미터 포함)

SQLP-Level Indexes
──────────────────
  idx_set_word        : (set_id, word_id) → 특정 세트 내 단어 조회 Index-Only Scan 유도
  idx_user_next_review: (user_id, next_review_at) → 오늘의 복습 단어 필터링 Index-Only Scan 유도
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class POS(str, enum.Enum):
    """품사 (Part of Speech)"""
    NOUN        = "noun"
    VERB        = "verb"
    ADJECTIVE   = "adjective"
    ADVERB      = "adverb"
    PREPOSITION = "preposition"
    CONJUNCTION = "conjunction"
    OTHER       = "other"


class ProgressStatus(str, enum.Enum):
    """SRS 학습 상태"""
    NEW        = "new"        # 아직 한 번도 학습하지 않음
    LEARNING   = "learning"   # 학습 중 (interval < 1일)
    REVIEW     = "review"     # 복습 단계
    MASTERED   = "mastered"   # 완전 습득 (interval ≥ 21일 기준)


# ──────────────────────────────────────────────
# Mixin: timestamps
# ──────────────────────────────────────────────

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# ──────────────────────────────────────────────
# Table: voca_words
# ──────────────────────────────────────────────

class VocaWord(TimestampMixin, Base):
    """
    단어 마스터 데이터.
    한 단어가 여러 세트에 속할 수 있으므로 N:M 관계는
    VocaSetMapping을 통해 연결합니다.
    """
    __tablename__ = "voca_words"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    word: Mapped[str] = mapped_column(String(100), nullable=False, index=True, unique=True,
                                      comment="영단어 (e.g. 'allocate')")
    meaning: Mapped[str] = mapped_column(Text, nullable=False,
                                         comment="한국어 뜻 (e.g. '할당하다, 배분하다')")
    phonetic: Mapped[str | None] = mapped_column(String(100), nullable=True,
                                                  comment="발음 기호 (e.g. '/ˌæləˈkeɪt/')")
    example_sentence: Mapped[str | None] = mapped_column(Text, nullable=True,
                                                          comment="예문 (Phase 2 AI 생성)")
    pos: Mapped[POS] = mapped_column(
        Enum(POS, name="pos_enum", create_constraint=True),
        nullable=False,
        default=POS.OTHER,
        comment="품사",
    )
    difficulty: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=3,
        comment="난이도 1(쉬움) ~ 5(어려움)",
    )
    is_premium: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="True면 유료 콘텐츠 (Phase 2)",
    )

    # relationships
    set_mappings: Mapped[list["VocaSetMapping"]] = relationship(
        back_populates="word", cascade="all, delete-orphan"
    )
    user_progress: Mapped[list["UserWordProgress"]] = relationship(
        back_populates="word", cascade="all, delete-orphan"
    )


# ──────────────────────────────────────────────
# Table: voca_sets
# ──────────────────────────────────────────────

class VocaSet(TimestampMixin, Base):
    """
    수준별 단어 묶음.
    Phase 1: 기초 / 800점 / 900점 (is_premium=False)
    Phase 2: 비즈니스 / AI 추천 등 (is_premium=True)
    """
    __tablename__ = "voca_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    title: Mapped[str] = mapped_column(String(100), nullable=False, unique=True,
                                       comment="묶음 이름 (e.g. '토익 기초 필수 300')")
    description: Mapped[str | None] = mapped_column(Text, nullable=True,
                                                     comment="묶음 설명")
    level: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
        comment="수준 태그 (basic / 800 / 900)",
    )
    display_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="로비 카드 노출 순서",
    )
    is_premium: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="True면 유료 구독 전용",
    )

    # relationships
    word_mappings: Mapped[list["VocaSetMapping"]] = relationship(
        back_populates="voca_set", cascade="all, delete-orphan"
    )
    user_progress: Mapped[list["UserWordProgress"]] = relationship(
        back_populates="voca_set"
    )


# ──────────────────────────────────────────────
# Table: voca_set_mappings  (N:M 연결)
# ──────────────────────────────────────────────

class VocaSetMapping(Base):
    """
    단어 ↔ 세트 N:M 연결 테이블.

    [SQLP 튜닝]
    idx_set_word (set_id, word_id) 복합 인덱스:
    → "특정 세트의 단어 목록" 쿼리 시 Index-Only Scan 유도.
    """
    __tablename__ = "voca_set_mappings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    set_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("voca_sets.id", ondelete="CASCADE"), nullable=False
    )
    word_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("voca_words.id", ondelete="CASCADE"), nullable=False
    )
    # 세트 내 단어 순서 (카드 정렬용)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # relationships
    voca_set: Mapped["VocaSet"] = relationship(back_populates="word_mappings")
    word: Mapped["VocaWord"] = relationship(back_populates="set_mappings")

    __table_args__ = (
        UniqueConstraint("set_id", "word_id", name="uq_set_word"),
        # ★ SQLP 핵심 인덱스: 세트 내 단어 조회 최적화
        Index("idx_set_word", "set_id", "word_id"),
    )


# ──────────────────────────────────────────────
# Table: user_word_progress  (SRS 핵심 로그)
# ──────────────────────────────────────────────

class UserWordProgress(TimestampMixin, Base):
    """
    사용자별 단어 SRS 학습 상태.

    SM-2 파라미터
    ─────────────
    repetition       : 누적 연속 정답 수 (0이면 리셋)
    interval         : 다음 복습까지의 일(day) 간격
    easiness_factor  : 난이도 계수 (기본 2.5, 최소 1.3)
    next_review_at   : 다음 복습 예정 시각 (TZ-aware)

    [SQLP 튜닝]
    idx_user_next_review (user_id, next_review_at) 복합 인덱스:
    → "오늘 복습할 단어 목록" 쿼리:
        WHERE user_id = :uid AND next_review_at <= NOW()
      실행 시 Index Range Scan → Index-Only Scan 유도.
    """
    __tablename__ = "user_word_progress"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ── 식별자 ───────────────────────────────
    user_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True,
        comment="앱 사용자 UUID (auth 테이블 FK 예정)",
    )
    word_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("voca_words.id", ondelete="CASCADE"), nullable=False
    )
    set_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("voca_sets.id", ondelete="CASCADE"), nullable=False,
        comment="어떤 세트에서 학습했는지 추적",
    )

    # ── SM-2 파라미터 ────────────────────────
    repetition: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="연속 정답 횟수 (오답 시 0으로 리셋)",
    )
    interval: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1,
        comment="다음 복습까지 일(day) 수",
    )
    easiness_factor: Mapped[float] = mapped_column(
        Float, nullable=False, default=2.5,
        comment="SM-2 난이도 계수 (min=1.3, init=2.5)",
    )
    next_review_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="다음 복습 예정 시각 (UTC)",
    )
    last_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="마지막으로 학습한 시각 (UTC)",
    )

    # ── 상태 ─────────────────────────────────
    status: Mapped[ProgressStatus] = mapped_column(
        Enum(ProgressStatus, name="progress_status_enum", create_constraint=True),
        nullable=False,
        default=ProgressStatus.NEW,
    )
    total_reviews: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="누적 복습 횟수",
    )
    correct_reviews: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="누적 정답 횟수",
    )

    # relationships
    word: Mapped["VocaWord"] = relationship(back_populates="user_progress")
    voca_set: Mapped["VocaSet"] = relationship(back_populates="user_progress")

    __table_args__ = (
        UniqueConstraint("user_id", "word_id", "set_id", name="uq_user_word_set"),
        # ★ SQLP 핵심 인덱스: 오늘의 복습 단어 필터링
        #   실행 계획: Index Range Scan on (user_id, next_review_at)
        Index("idx_user_next_review", "user_id", "next_review_at"),
    )
