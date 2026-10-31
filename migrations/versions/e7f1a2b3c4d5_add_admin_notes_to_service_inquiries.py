"""add_admin_notes_to_service_inquiries

Revision ID: e7f1a2b3c4d5
Revises: d650ce9aa593
Create Date: 2026-04-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e7f1a2b3c4d5'
down_revision: Union[str, Sequence[str], None] = 'd650ce9aa593'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('service_inquiries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('admin_notes', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('service_inquiries', schema=None) as batch_op:
        batch_op.drop_column('admin_notes')

