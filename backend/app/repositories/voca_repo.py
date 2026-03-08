"""
VibeVoca — VocaRepository
AsyncSession 기반 단어/세트 데이터 접근 레이어.
"""
from __future__ import annotations

from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.voca import VocaSet, VocaSetMapping, VocaWord, UserWordProgress


class VocaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ── 세트 목록 (단어 수 포함) ─────────────────────────────

    async def get_all_sets(self) -> list[dict]:
        """
        모든 VocaSet과 각 세트의 단어 수를 반환합니다.
        실행 계획: voca_sets + COUNT on voca_set_mappings (Group By)
        """
        stmt = (
            select(
                VocaSet,
                func.count(VocaSetMapping.id).label("word_count"),
            )
            .outerjoin(VocaSetMapping, VocaSet.id == VocaSetMapping.set_id)
            .group_by(VocaSet.id)
            .order_by(VocaSet.display_order.asc())
        )
        result = await self._session.execute(stmt)
        rows = result.all()

        out = []
        for voca_set, word_count in rows:
            item = {
                "id": voca_set.id,
                "title": voca_set.title,
                "description": voca_set.description,
                "level": voca_set.level,
                "display_order": voca_set.display_order,
                "is_premium": voca_set.is_premium,
                "word_count": word_count,
            }
            out.append(item)
        return out

    # ── 세트 단건 조회 ────────────────────────────────────────

    async def get_set_by_id(self, set_id: int) -> VocaSet | None:
        stmt = select(VocaSet).where(VocaSet.id == set_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    # ── 오늘의 단어: UserWordProgress JOIN VocaWord ──────────

    async def get_due_words_with_detail(
        self,
        user_id: str,
        set_id: int,
        limit: int = 20,
        mode: str = "default"
    ) -> list[dict]:
        """
        오늘 학습할 단어 목록을 상세 정보와 함께 가져옵니다.
        
        mode:
          - default: 복습 대상(due) + 빈자리는 신규 단어
          - errors_only: 틀린 적이 있는 단어만 (total_reviews > correct_reviews)
          - struggled: 한번이라도 틀렸거나(total > correct) 아직 한번도 안 본(total == 0) 단어
        """
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)

        # 1. 메인 쿼리 구성
        stmt = select(UserWordProgress, VocaWord).join(VocaWord, UserWordProgress.word_id == VocaWord.id)
        stmt = stmt.where(
            UserWordProgress.user_id == user_id,
            UserWordProgress.set_id == set_id,
        )

        if mode == "errors_only":
            # 틀린 적이 있는 단어 (오답이 하나라도 있음)
            stmt = stmt.where(UserWordProgress.total_reviews > UserWordProgress.correct_reviews)
        elif mode == "struggled":
            # 한번이라도 틀렸거나 아예 맞춘 적이 없는 단어
            # (total > correct) OR (correct == 0)
            stmt = stmt.where(
                or_(
                    UserWordProgress.total_reviews > UserWordProgress.correct_reviews,
                    UserWordProgress.correct_reviews == 0
                )
            )
        else: # mode == "default"
            # default: 복습 기한이 지났거나 도달한 단어
            stmt = stmt.where(UserWordProgress.next_review_at <= now)

        # 공통 정렬 및 제한
        stmt = stmt.order_by(
            (UserWordProgress.total_reviews - UserWordProgress.correct_reviews).desc(),
            func.random()
        ).limit(limit)

        result = await self._session.execute(stmt)
        rows = result.all()

        out = []
        for progress, word in rows:
            out.append({
                "id": word.id,
                "word": word.word,
                "meaning": word.meaning,
                "phonetic": word.phonetic,
                "pos": word.pos.value,
                "difficulty": word.difficulty,
                "example_sentence": word.example_sentence,
                "repetition": progress.repetition,
                "interval": progress.interval,
                "easiness_factor": progress.easiness_factor,
                "next_review_at": progress.next_review_at,
                "status": progress.status.value,
            })

        print(f"DEBUG: Found {len(out)} words for mode={mode}, limit={limit}")

        # 2. 'default' 또는 'struggled' 모드에서 자리가 남으면 신규 단어(Unseen)를 채움
        # 'errors_only'는 명확히 틀린 것만 보기로 했으므로 신규는 안 채움 (사용자 의도)
        remaining = limit - len(out)
        if remaining > 0 and mode != "errors_only":
            # 이미 UserWordProgress에 있는 단어들(학습 중인 것들) 제외
            subquery = select(UserWordProgress.word_id).where(
                UserWordProgress.user_id == user_id,
                UserWordProgress.set_id == set_id
            )
            
            new_stmt = (
                select(VocaWord)
                .join(VocaSetMapping, VocaWord.id == VocaSetMapping.word_id)
                .where(
                    VocaSetMapping.set_id == set_id,
                    VocaWord.id.notin_(subquery)
                )
                # 신규 단어도 랜덤하게 섞어서 제공
                .order_by(func.random())
                .limit(remaining)
            )
            new_result = await self._session.execute(new_stmt)
            new_words = new_result.scalars().all()

            print(f"DEBUG: Found {len(new_words)} new words to fill. Remaining space: {remaining}")

            for word in new_words:
                out.append({
                    "id": word.id,
                    "word": word.word,
                    "meaning": word.meaning,
                    "phonetic": word.phonetic,
                    "pos": word.pos.value,
                    "difficulty": word.difficulty,
                    "example_sentence": word.example_sentence,
                    "repetition": 0,
                    "interval": 0,
                    "easiness_factor": 2.5,
                    "next_review_at": None,
                    "status": "new",
                })

        return out

    # ── 통계 대시보드 (학습 현황 / 일일 달성도) ─────────────────────────

    async def get_user_statistics(self, user_id: str) -> dict:
        """
        사용자의 학습 통계를 집계하여 반환합니다. (오늘 학습 수, 전체 학습 수, 마스터 수, 7일 차트)
        - DB 인덱스(user_id, last_reviewed_at)를 활용한 COUNT / GROUP BY 최적화
        """
        from datetime import datetime, timezone, timedelta
        from sqlalchemy import cast, Date
        from app.models.voca import ProgressStatus
        
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        seven_days_ago = today_start - timedelta(days=6)

        # 금일 학습 수 (성공한 학습만 포함: repetition > 0)
        stmt_today = select(func.count(UserWordProgress.id)).where(
            UserWordProgress.user_id == user_id,
            UserWordProgress.last_reviewed_at >= today_start,
            UserWordProgress.repetition > 0
        )
        today_studied = await self._session.scalar(stmt_today) or 0

        # 전체 누적 학습 수 (실제로 습득 중인 단어만: repetition > 0)
        stmt_total = select(func.count(UserWordProgress.id)).where(
            UserWordProgress.user_id == user_id,
            UserWordProgress.status != ProgressStatus.NEW,
            UserWordProgress.repetition > 0
        )
        total_studied = await self._session.scalar(stmt_total) or 0

        # 마스터 수 (학습을 완료하여 복습 단계 이상에 진입한 단어: REVIEW, MASTERED)
        stmt_mastered = select(func.count(UserWordProgress.id)).where(
            UserWordProgress.user_id == user_id,
            UserWordProgress.status.in_([ProgressStatus.REVIEW, ProgressStatus.MASTERED])
        )
        mastered_count = await self._session.scalar(stmt_mastered) or 0

        # 복습 필요 (Due) 수 + 현재 학습 중(LEARNING)인 수
        stmt_due = select(func.count(UserWordProgress.id)).where(
            UserWordProgress.user_id == user_id,
            or_(
                UserWordProgress.next_review_at <= now,
                UserWordProgress.status == ProgressStatus.LEARNING
            )
        )
        due_count = await self._session.scalar(stmt_due) or 0

        # 7일간 일일 학습 트렌드
        stmt_daily = (
            select(
                cast(UserWordProgress.last_reviewed_at, Date).label('review_date'),
                func.count(UserWordProgress.id).label('studied_count')
            )
            .where(
                UserWordProgress.user_id == user_id,
                UserWordProgress.last_reviewed_at >= seven_days_ago
            )
            .group_by(cast(UserWordProgress.last_reviewed_at, Date))
            .order_by(cast(UserWordProgress.last_reviewed_at, Date).desc()) # 최신순으로 정렬
        )
        daily_res = await self._session.execute(stmt_daily)
        daily_rows = daily_res.all()
        
        # DB 결과 파싱
        daily_map = {row.review_date.strftime("%Y-%m-%d"): row.studied_count for row in daily_rows}
        
        # Streak 계산 (오늘 또는 어제부터 시작해서 연속된 날짜 찾기)
        streak = 0
        check_date = today_start.date()
        
        # 어제부터 시작하더라도 유효 (오늘 아직 안 했어도 스트릭 유지)
        if (today_start.date().strftime("%Y-%m-%d") not in daily_map and 
            (today_start - timedelta(days=1)).date().strftime("%Y-%m-%d") not in daily_map):
            streak = 0
        else:
            # 어제 했거나 오늘 했으면 스트릭 계산 시작
            # (오늘 안 했어도 어제 했으면 어제까지의 스트릭이 유효)
            if today_start.date().strftime("%Y-%m-%d") not in daily_map:
                check_date = (today_start - timedelta(days=1)).date()
            
            while True:
                d_str = check_date.strftime("%Y-%m-%d")
                if d_str in daily_map:
                    streak += 1
                    check_date -= timedelta(days=1)
                else:
                    break

        # 7일 차트 데이터 채우기 (정순으로)
        daily_stats = []
        for i in range(7):
            d = (seven_days_ago + timedelta(days=i)).date()
            d_str = d.strftime("%Y-%m-%d")
            daily_stats.append(
                {"date": d_str, "studied_count": daily_map.get(d_str, 0)}
            )

        return {
            "today_studied": today_studied,
            "total_studied": total_studied,
            "mastered_count": mastered_count,
            "due_count": due_count,
            "streak": streak,
            "daily_stats": daily_stats
        }
