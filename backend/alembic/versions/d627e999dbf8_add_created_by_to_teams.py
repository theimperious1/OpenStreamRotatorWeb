"""add_created_by_to_teams

Revision ID: d627e999dbf8
Revises: 0f28ec5aefd7
Create Date: 2026-02-15 10:29:06.732422

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd627e999dbf8'
down_revision: Union[str, Sequence[str], None] = '0f28ec5aefd7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('teams') as batch_op:
        batch_op.add_column(sa.Column('created_by', sa.String(length=36), nullable=True))
        batch_op.create_foreign_key('fk_teams_created_by', 'users', ['created_by'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('teams') as batch_op:
        batch_op.drop_constraint('fk_teams_created_by', type_='foreignkey')
        batch_op.drop_column('created_by')
