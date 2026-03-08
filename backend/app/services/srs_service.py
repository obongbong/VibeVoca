"""
VibeVoca - SRS Service (SM-2 Algorithm)
========================================
SuperMemo-2 알고리즘을 기반으로 사용자의 복습 주기와
난이도 계수(Easiness Factor)를 계산하고 DB에 반영합니다.

Quality (q) 척도 정의
─────────────────────
  5 : 완벽히 기억함 (Perfect response)
  4 : 조금 주저했지만 기억함
  3 : 어렵게 기억함 (Correct, serious difficulty)
  2 : 틀렸지만 답을 보니 기억남
  1 : 틀렸고 답을 봐도 생소함
  0 : 아예 모름 (Complete blackout)

Interval 계산 규칙
──────────────────
  q < 3 (오답) → repetition 리셋, interval = 1
  q ≥ 3 (정답)
    n=1 → I = 1
    n=2 → I = 6
    n>2 → I = round(I_prev × EF)

EF 업데이트 공식
────────────────
  EF_new = EF_old + (0.1 - (5-q)×(0.08 + (5-q)×0.02))
  EF_min  = 1.3  (하한 클램프)
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.voca import ProgressStatus, UserWordProgress

# ─────────────────────────────────────────────
# 상수
# ─────────────────────────────────────────────
EF_MIN: float = 1.3          # 난이도 계수 최솟값
EF_INIT: float = 2.5         # 초기 난이도 계수
MASTERED_INTERVAL: int = 21  # interval ≥ 21일 → MASTERED 상태

Quality = Literal[0, 1, 2, 3, 4, 5]


# ─────────────────────────────────────────────
# 순수 함수: SM-2 계산 로직 (DB 불필요, 단위 테스트 가능)
# ─────────────────────────────────────────────

@dataclass(frozen=True)
class SM2Result:
    """SM-2 계산 결과 (불변 값 객체)."""
    repetition: int       # 업데이트된 연속 정답 수
    interval: int         # 업데이트된 복습 간격 (days)
    easiness_factor: float  # 업데이트된 EF
    next_review_at: datetime  # 다음 복습 예정 시각 (UTC, TZ-aware)
    status: ProgressStatus


def calculate_sm2(
    *,
    quality: Quality,
    repetition: int,
    interval: int,
    easiness_factor: float,
    now: datetime | None = None,
) -> SM2Result:
    """
    SM-2 알고리즘을 적용하여 다음 복습 파라미터를 계산합니다.

    Parameters
    ----------
    quality         : 사용자 피드백 (0~5)
    repetition      : 현재 연속 정답 횟수
    interval        : 현재 복습 간격 (days)
    easiness_factor : 현재 EF 값
    now             : 기준 시각 (None이면 UTC 현재 시각 사용)

    Returns
    -------
    SM2Result : 업데이트된 SRS 파라미터 전체
    """
    if now is None:
        now = datetime.now(timezone.utc)

    # ── EF 업데이트 (정답/오답 무관하게 항상 적용) ──
    ef_delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    new_ef = max(EF_MIN, easiness_factor + ef_delta)

    # ── Interval & Repetition 업데이트 ──
    if quality < 3:
        # 오답: 처음부터 다시
        new_repetition = 0
        new_interval = 1
    else:
        # 정답
        new_repetition = repetition + 1
        if new_repetition == 1:
            new_interval = 1
        elif new_repetition == 2:
            new_interval = 6
        else:
            new_interval = round(interval * new_ef)

    # ── ProgressStatus 결정 ──
    if new_repetition == 0:
        new_status = ProgressStatus.LEARNING
    elif new_interval >= MASTERED_INTERVAL:
        new_status = ProgressStatus.MASTERED
    else:
        new_status = ProgressStatus.REVIEW

    next_review_at = now + timedelta(days=new_interval)

    return SM2Result(
        repetition=new_repetition,
        interval=new_interval,
        easiness_factor=round(new_ef, 4),
        next_review_at=next_review_at,
        status=new_status,
    )


# ─────────────────────────────────────────────
# SRSService: DB 연동 서비스 클래스
# ─────────────────────────────────────────────

class SRSService:
    """
    SM-2 알고리즘과 AsyncSession을 결합한 SRS 서비스.

    FastAPI 엔드포인트에서 `get_db()` 의존성으로 주입받은
    AsyncSession을 전달하여 사용합니다.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ── 오늘의 복습 단어 조회 ────────────────────────────────
    async def get_due_words(
        self,
        user_id: str,
        set_id: int,
        limit: int = 20,
    ) -> list[UserWordProgress]:
        """
        (user_id, next_review_at) 복합 인덱스(idx_user_next_review)를
        활용하여 오늘 복습해야 할 단어를 가져옵니다.

        실행 계획 예상:
          → Index Range Scan on idx_user_next_review
            (user_id = :uid AND next_review_at <= NOW())
        """
        now = datetime.now(timezone.utc)
        stmt = (
            select(UserWordProgress)
            .where(
                UserWordProgress.user_id == user_id,
                UserWordProgress.set_id == set_id,
                UserWordProgress.next_review_at <= now,
            )
            .order_by(UserWordProgress.next_review_at.asc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    # ── 신규 단어 조회 (NEW 상태) ────────────────────────────
    async def get_new_words(
        self,
        user_id: str,
        set_id: int,
        limit: int = 10,
    ) -> list[UserWordProgress]:
        """학습을 한 번도 시작하지 않은 NEW 상태 단어를 반환합니다."""
        stmt = (
            select(UserWordProgress)
            .where(
                UserWordProgress.user_id == user_id,
                UserWordProgress.set_id == set_id,
                UserWordProgress.status == ProgressStatus.NEW,
            )
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    # ── 핵심: 피드백 처리 및 SRS 업데이트 ───────────────────
    async def record_answer(
        self,
        user_id: str,
        word_id: int,
        set_id: int,
        quality: Quality,
    ) -> SM2Result:
        """
        사용자의 답변 품질(quality)을 받아 SM-2 알고리즘을 적용하고
        UserWordProgress를 업데이트합니다.

        progress 행이 없으면 자동으로 생성(upsert 패턴)합니다.

        Parameters
        ----------
        user_id : 사용자 UUID 문자열
        word_id : 학습한 단어 ID
        set_id  : 학습 중인 세트 ID
        quality : 사용자 피드백 (0~5)

        Returns
        -------
        SM2Result : 계산된 새 SRS 파라미터
        """
        now = datetime.now(timezone.utc)

        # 기존 progress 조회 또는 신규 생성
        stmt = select(UserWordProgress).where(
            UserWordProgress.user_id == user_id,
            UserWordProgress.word_id == word_id,
            UserWordProgress.set_id == set_id,
        )
        result = await self._session.execute(stmt)
        progress: UserWordProgress | None = result.scalar_one_or_none()

        if progress is None:
            # 첫 학습: 기본값으로 새 행 생성
            progress = UserWordProgress(
                user_id=user_id,
                word_id=word_id,
                set_id=set_id,
                repetition=0,
                interval=1,
                easiness_factor=EF_INIT,
                next_review_at=now,
                status=ProgressStatus.NEW,
                total_reviews=0,
                correct_reviews=0,
            )
            self._session.add(progress)

        # SM-2 계산
        sm2 = calculate_sm2(
            quality=quality,
            repetition=progress.repetition,
            interval=progress.interval,
            easiness_factor=progress.easiness_factor,
            now=now,
        )

        # DB 반영
        progress.repetition = sm2.repetition
        progress.interval = sm2.interval
        progress.easiness_factor = sm2.easiness_factor
        progress.next_review_at = sm2.next_review_at
        progress.last_reviewed_at = now
        progress.status = sm2.status
        progress.total_reviews = (progress.total_reviews or 0) + 1
        if quality >= 3:
            progress.correct_reviews = (progress.correct_reviews or 0) + 1

        # 세션 flush (commit은 get_db() 의존성에서 처리)
        await self._session.flush()

        return sm2

    async def undo_review(
        self,
        user_id: str,
        word_id: int,
        set_id: int,
        quality: int,
        repetition: int,
        interval: int,
        easiness_factor: float,
        next_review_at: datetime | None,
        last_reviewed_at: datetime | None,
        status: str,
    ) -> None:
        """
        리뷰 결과를 취소하고 이전 상태로 복구합니다.
        """
        stmt = select(UserWordProgress).where(
            UserWordProgress.user_id == user_id,
            UserWordProgress.word_id == word_id,
            UserWordProgress.set_id == set_id,
        )
        result = await self._session.execute(stmt)
        progress: UserWordProgress | None = result.scalar_one_or_none()

        if progress:
            # 상태 복구
            progress.repetition = repetition
            progress.interval = interval
            progress.easiness_factor = easiness_factor
            # next_review_at은 nullable=False이므로 None인 경우 현재 시각으로 대체
            progress.next_review_at = next_review_at or datetime.now(timezone.utc)
            progress.last_reviewed_at = last_reviewed_at
            progress.status = ProgressStatus(status)
            
            # 통계 차감
            progress.total_reviews = max(0, (progress.total_reviews or 0) - 1)
            if quality >= 3:
                progress.correct_reviews = max(0, (progress.correct_reviews or 0) - 1)
            
            # 만약 total_review가 0이 되었는데 last_reviewed_at이 여전히 있다면 강제 초기화 (안전장치)
            if progress.total_reviews == 0:
                progress.last_reviewed_at = None

            await self._session.flush()

    # ── 사용자 세트 진척도 요약 ──────────────────────────────
    async def get_set_progress_summary(
        self,
        user_id: str,
        set_id: int,
    ) -> dict:
        """
        Stats 화면용: 세트별 학습 상태 카운트를 반환합니다.
        """
        from sqlalchemy import func as sa_func
        from app.models.voca import VocaSetMapping

        # 1. 해당 세트의 전체 단어 수 조회
        stmt_total = select(sa_func.count(VocaSetMapping.id)).where(VocaSetMapping.set_id == set_id)
        set_total = await self._session.scalar(stmt_total) or 0

        # 2. 사용자 진행 상태별 카운트 조회
        stmt = (
            select(
                UserWordProgress.status,
                sa_func.count().label("cnt"),
            )
            .where(
                UserWordProgress.user_id == user_id,
                UserWordProgress.set_id == set_id,
            )
            .group_by(UserWordProgress.status)
        )
        result = await self._session.execute(stmt)
        rows = result.all()

        counts = {s.value: 0 for s in ProgressStatus}
        for status, cnt in rows:
            counts[status.value] = cnt

        # user_total = sum(counts.values())  # 기존: 사용자가 한 번이라도 본 단어 수
        learned_count = counts["review"] + counts["mastered"]
        
        return {
            "set_id": set_id,
            "total": set_total,  # 실제 세트 전체 단어 수 반환
            "counts": counts,
            "mastery_rate": round(learned_count / set_total * 100, 1) if set_total else 0.0,
        }
