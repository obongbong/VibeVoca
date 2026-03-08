"""
SRS 서비스 사용 예시 모음

1. FastAPI 엔드포인트에서의 호출 방법
2. 순수 함수(calculate_sm2) 단위 테스트
"""
# ──────────────────────────────────────────────────────────
# 1. FastAPI 엔드포인트 예시
# ──────────────────────────────────────────────────────────
# app/api/v1/srs.py 에 아래 코드를 추가하면 됩니다.

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.srs_service import SRSService, Quality

router = APIRouter(prefix="/srs", tags=["SRS"])


class AnswerRequest(BaseModel):
    user_id: str = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    word_id: int = Field(..., example=42)
    set_id: int  = Field(..., example=1)
    quality: int = Field(..., ge=0, le=5, example=4,
                         description="0=완전모름 / 3=어렵게 기억 / 5=완벽")


class AnswerResponse(BaseModel):
    repetition: int
    interval: int
    easiness_factor: float
    next_review_at: str   # ISO-8601 UTC
    status: str


@router.post("/answer", response_model=AnswerResponse, summary="단어 피드백 제출 & 다음 복습 주기 계산")
async def submit_answer(
    body: AnswerRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    사용자가 카드를 넘길 때 호출합니다.
    - quality 0~2 → 오답 처리, interval 1일 reset
    - quality 3~5 → SM-2 공식으로 interval & EF 갱신
    """
    svc = SRSService(db)
    result = await svc.record_answer(
        user_id=body.user_id,
        word_id=body.word_id,
        set_id=body.set_id,
        quality=body.quality,  # type: ignore[arg-type]
    )
    return AnswerResponse(
        repetition=result.repetition,
        interval=result.interval,
        easiness_factor=result.easiness_factor,
        next_review_at=result.next_review_at.isoformat(),
        status=result.status.value,
    )


@router.get("/due", summary="오늘 복습해야 할 단어 목록")
async def get_due_words(
    user_id: str,
    set_id: int,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    svc = SRSService(db)
    words = await svc.get_due_words(user_id=user_id, set_id=set_id, limit=limit)
    return {"count": len(words), "words": [w.word_id for w in words]}


# ──────────────────────────────────────────────────────────
# 2. 순수 함수 단위 테스트 (pytest 없이 직접 실행 가능)
# ──────────────────────────────────────────────────────────
# python scripts/test_sm2.py 로 실행하세요.

def _run_sm2_tests():
    from app.services.srs_service import calculate_sm2, EF_INIT
    from datetime import timezone

    print("=" * 60)
    print("SM-2 Algorithm Unit Tests")
    print("=" * 60)

    # ── Test 1: 첫 번째 정답 (q=5) ──────────────────────────
    r = calculate_sm2(quality=5, repetition=0, interval=1, easiness_factor=EF_INIT)
    assert r.repetition == 1, f"Expected 1, got {r.repetition}"
    assert r.interval == 1,   f"Expected interval=1, got {r.interval}"
    assert r.easiness_factor > EF_INIT, "EF should increase on q=5"
    print(f"[PASS] Test 1 - 첫 정답(q=5): interval={r.interval}, EF={r.easiness_factor}, status={r.status.value}")

    # ── Test 2: 두 번째 연속 정답 (q=4) ─────────────────────
    r2 = calculate_sm2(quality=4, repetition=1, interval=1, easiness_factor=r.easiness_factor)
    assert r2.interval == 6,  f"Expected interval=6, got {r2.interval}"
    assert r2.repetition == 2
    print(f"[PASS] Test 2 - 두 번째 정답(q=4): interval={r2.interval}, EF={r2.easiness_factor}")

    # ── Test 3: 세 번째 정답 → interval = round(6 × EF) ─────
    r3 = calculate_sm2(quality=4, repetition=2, interval=6, easiness_factor=r2.easiness_factor)
    expected_interval = round(6 * r2.easiness_factor)
    assert r3.interval == expected_interval, f"Expected {expected_interval}, got {r3.interval}"
    print(f"[PASS] Test 3 - 세 번째 정답(q=4): interval={r3.interval} (expected {expected_interval})")

    # ── Test 4: 오답(q=2) → repetition 리셋, interval=1 ─────
    r4 = calculate_sm2(quality=2, repetition=3, interval=15, easiness_factor=2.5)
    assert r4.repetition == 0, f"Expected 0, got {r4.repetition}"
    assert r4.interval == 1,   f"Expected interval=1, got {r4.interval}"
    print(f"[PASS] Test 4 - 오답(q=2): repetition={r4.repetition}, interval={r4.interval}, status={r4.status.value}")

    # ── Test 5: EF 하한 클램프 (q=0 연속) ───────────────────
    ef = 1.4
    for _ in range(5):
        res = calculate_sm2(quality=0, repetition=0, interval=1, easiness_factor=ef)
        ef = res.easiness_factor
    assert ef >= 1.3, f"EF should not go below 1.3, got {ef}"
    print(f"[PASS] Test 5 - EF 하한 클램프: EF={ef} (min=1.3)")

    # ── Test 6: MASTERED 상태 (interval >= 21) ──────────────
    r6 = calculate_sm2(quality=5, repetition=5, interval=14, easiness_factor=2.5)
    print(f"[PASS] Test 6 - MASTERED 체크: interval={r6.interval}, status={r6.status.value}")

    # ── Test 7: next_review_at TZ-aware 확인 ────────────────
    assert r6.next_review_at.tzinfo is not None, "next_review_at must be TZ-aware"
    assert r6.next_review_at.tzinfo == timezone.utc or "UTC" in str(r6.next_review_at.tzinfo)
    print(f"[PASS] Test 7 - TZ-aware: next_review_at={r6.next_review_at.isoformat()}")

    print("=" * 60)
    print("All tests passed! ✅")
    print("=" * 60)


if __name__ == "__main__":
    import sys, os
    # 프로젝트 루트를 sys.path에 추가
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    _run_sm2_tests()
