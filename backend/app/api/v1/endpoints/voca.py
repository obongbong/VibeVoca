"""
VibeVoca — Vocabulary API Endpoints (v1)

엔드포인트
──────────
GET  /api/v1/sets                  전체 단어 세트 목록
GET  /api/v1/sets/{set_id}/today   오늘 복습할 단어 목록 (SRS)
POST /api/v1/review                학습 결과 제출 & 다음 복습일 갱신
GET  /api/v1/sets/{set_id}/progress  세트 학습 진행도 요약
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.repositories.voca_repo import VocaRepository
from app.schemas.voca import (
    ReviewResult,
    ReviewSubmit,
    SetListResponse,
    TodayWordsResponse,
    VocaSetOut,
    ProgressSummary,
    UserStatsResponse,
    UndoReview,
)
from app.services.srs_service import SRSService
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/sets", tags=["Vocabulary"])
review_router = APIRouter(tags=["Vocabulary"])


# ─────────────────────────────────────────────────────────────────────
# GET /sets
# ─────────────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=SetListResponse,
    summary="단어 세트 목록 조회",
    description="기초 / 800점 / 900점 세트 전체를 display_order 순으로 반환합니다.",
)
async def list_sets(
    db: AsyncSession = Depends(get_db),
) -> SetListResponse:
    repo = VocaRepository(db)
    sets_data = await repo.get_all_sets()
    sets_out = [VocaSetOut(**s) for s in sets_data]
    return SetListResponse(total=len(sets_out), sets=sets_out)


# ─────────────────────────────────────────────────────────────────────
# GET /sets/{set_id}/today
# ─────────────────────────────────────────────────────────────────────

@router.get("/{set_id}/today", response_model=TodayWordsResponse)
async def get_today_words(
    set_id: int,
    limit: int = Query(20, ge=1, le=100, description="최대 반환 단어 수"),
    mode: str = Query("default", description="학습 모드 (default, new, review)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> TodayWordsResponse:
    repo = VocaRepository(db)
    voca_set = await repo.get_set_by_id(set_id)
    if voca_set is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"세트를 찾을 수 없습니다: set_id={set_id}",
        )

    user_id_str = str(current_user.id) if current_user else "1"
    words_data = await repo.get_due_words_with_detail(user_id_str, set_id, limit, mode)

    from app.schemas.voca import WordProgressOut
    words_out = [WordProgressOut(**w) for w in words_data]

    return TodayWordsResponse(
        set_id=set_id,
        user_id=user_id_str,
        total_due_count=len(words_out),
        words=words_out,
    )


# ─────────────────────────────────────────────────────────────────────
# GET /sets/{set_id}/progress
# ─────────────────────────────────────────────────────────────────────

@router.get(
    "/{set_id}/progress",
    response_model=ProgressSummary,
    summary="세트 학습 진행도 요약",
    description="new / learning / review / mastered 상태별 단어 수와 마스터 비율을 반환합니다.",
)
async def get_progress_summary(
    set_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ProgressSummary:
    repo = VocaRepository(db)
    voca_set = await repo.get_set_by_id(set_id)
    if voca_set is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"세트를 찾을 수 없습니다: set_id={set_id}",
        )

    svc = SRSService(db)
    user_id_str = str(current_user.id) if current_user else "1"
    summary = await svc.get_set_progress_summary(user_id=user_id_str, set_id=set_id)
    return ProgressSummary(**summary)


# ─────────────────────────────────────────────────────────────────────
# POST /review
# ─────────────────────────────────────────────────────────────────────

@review_router.post(
    "/review",
    response_model=ReviewResult,
    status_code=status.HTTP_200_OK,
    summary="학습 결과 제출 (SM-2 알고리즘 적용)",
    description=(
        "단어 학습 후 품질(quality 0~5)을 제출하면 "
        "SM-2 알고리즘으로 다음 복습 일정이 계산됩니다.\n\n"
        "- quality 0~2 → 오답: repetition 리셋, interval=1일\n"
        "- quality 3~5 → 정답: EF 및 interval 갱신"
    ),
)
async def submit_review(
    body: ReviewSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ReviewResult:
    svc = SRSService(db)
    user_id_str = str(current_user.id) if current_user else body.user_id
    sm2 = await svc.record_answer(
        user_id=user_id_str,
        word_id=body.word_id,
        set_id=body.set_id,
        quality=body.quality,  # type: ignore[arg-type]
    )
    return ReviewResult(
        word_id=body.word_id,
        set_id=body.set_id,
        quality=body.quality,
        is_correct=body.quality >= 3,
        repetition=sm2.repetition,
        interval=sm2.interval,
        easiness_factor=sm2.easiness_factor,
        next_review_at=sm2.next_review_at,
        status=sm2.status.value,
    )


@review_router.post(
    "/review/undo",
    status_code=status.HTTP_200_OK,
    summary="학습 결과 취소 (Undo)",
    description="마지막 학습 결과를 취소하고 통계를 차감하며 SM-2 상태를 이전으로 돌립니다.",
)
async def undo_review(
    body: UndoReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    svc = SRSService(db)
    user_id_str = str(current_user.id) if current_user else "1"
    await svc.undo_review(
        user_id=user_id_str,
        word_id=body.word_id,
        set_id=body.set_id,
        quality=body.quality,
        repetition=body.repetition,
        interval=body.interval,
        easiness_factor=body.easiness_factor,
        next_review_at=body.next_review_at,
        last_reviewed_at=body.last_reviewed_at,
        status=body.status,
    )
    return {"status": "success", "word_id": body.word_id}

@router.get(
    "/stats",
    response_model=UserStatsResponse,
    summary="사용자 전체 학습 통계 조회",
)
async def get_user_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> UserStatsResponse:
    repo = VocaRepository(db)
    user_id_str = str(current_user.id) if current_user else "1"
    stats = await repo.get_user_statistics(user_id_str)
    return UserStatsResponse(**stats)
