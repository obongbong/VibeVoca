"""add phonetic to voca_words

Revision ID: 3c8facec766a
Revises: 891a7c9dda4a
Create Date: 2026-03-08 19:44:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c8facec766a'
down_revision: Union[str, None] = '891a7c9dda4a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('voca_words', sa.Column('phonetic', sa.String(length=100), nullable=True, comment="발음 기호 (e.g. '/ˌæləˈkeɪt/')"))


def downgrade() -> None:
    op.drop_column('voca_words', 'phonetic')
