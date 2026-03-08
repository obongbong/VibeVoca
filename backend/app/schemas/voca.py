"""
VibeVoca — Pydantic v2 Schemas for Vocabulary API
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict


# ──────────────────────────────────────────────
# Word Schemas
# ──────────────────────────────────────────────

class WordOut(BaseModel):
    """단어 기본 정보 응답 모델."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    word: str
    meaning: str
    phonetic: str | None = None
    pos: str
    difficulty: int
    example_sentence: str | None = None


# ──────────────────────────────────────────────
# VocaSet Schemas
# ──────────────────────────────────────────────

class VocaSetOut(BaseModel):
    """단어 세트 요약 응답 모델 (목록용)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None = None
    level: str | None = None
    display_order: int
    is_premium: bool
    word_count: int = 0   # Repository에서 채워줌


class SetListResponse(BaseModel):
    """GET /sets 응답."""
    total: int
    sets: list[VocaSetOut]


# ──────────────────────────────────────────────
# Today's Study Words Schemas
# ──────────────────────────────────────────────

class WordProgressOut(BaseModel):
    """오늘의 학습 카드 한 장 (단어 정보 + SRS 상태)."""
    model_config = ConfigDict(from_attributes=True)

    # word info (joined)
    id: int  # word_id -> id 로 변경 (프론트엔드 대응)
    word: str
    meaning: str
    phonetic: str | None = None
    pos: str
    difficulty: int
    example_sentence: str | None = None

    # SRS state
    repetition: int
    interval: int
    easiness_factor: float
    next_review_at: datetime | None = None # 신규 단어는 None일 수 있음
    status: str


class TodayWordsResponse(BaseModel):
    """GET /sets/{set_id}/today 응답."""
    set_id: int
    user_id: str
    total_due_count: int  # due_count -> total_due_count 로 변경
    words: list[WordProgressOut]


# ──────────────────────────────────────────────
# Review Submit Schemas
# ──────────────────────────────────────────────

class ReviewSubmit(BaseModel):
    """POST /review 요청 바디."""
    user_id: str | None = Field(
        None,
        description="사용자 UUID. 토큰이 없는 경우 fallback으로 사용됨.",
        examples=["550e8400-e29b-41d4-a716-446655440000"],
    )
    word_id: int = Field(..., description="학습한 단어 ID", examples=[42])
    set_id: int = Field(..., description="세트 ID", examples=[1])
    quality: Literal[0, 1, 2, 3, 4, 5] = Field(
        ...,
        description="답변 품질 0(완전모름) ~ 5(완벽). 3 미만은 오답으로 처리됩니다.",
        examples=[4],
    )


class ReviewResult(BaseModel):
    """POST /review 응답."""
    word_id: int
    set_id: int
    quality: int
    is_correct: bool            # quality >= 3
    repetition: int
    interval: int
    easiness_factor: float
    next_review_at: datetime | None = None
    status: str


class UndoReview(BaseModel):
    """POST /review/undo 요청 바디."""
    word_id: int
    set_id: int
    quality: Literal[0, 1, 2, 3, 4, 5] = Field(
        ..., description="취소할 리뷰의 품질"
    )
    # 복구할 이전 상태
    repetition: int
    interval: int
    easiness_factor: float
    next_review_at: datetime | None = None
    last_reviewed_at: datetime | None = None
    status: str


# ──────────────────────────────────────────────
# Progress Summary Schema
# ──────────────────────────────────────────────

class ProgressSummary(BaseModel):
    """세트별 학습 진행도 요약."""
    set_id: int
    total: int
    counts: dict[str, int]
    mastery_rate: float


# ──────────────────────────────────────────────
# User Statistics Schemas
# ──────────────────────────────────────────────

class DailyStat(BaseModel):
    """일자별 학습 통계"""
    date: str
    studied_count: int

class UserStatsResponse(BaseModel):
    """GET /stats 응답"""
    today_studied: int
    total_studied: int
    mastered_count: int
    due_count: int
    streak: int
    daily_stats: list[DailyStat]
