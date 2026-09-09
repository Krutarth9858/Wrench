"""google sign-in identity, email verification flag and email OTP codes

Relaxes two NOT NULL constraints on `users`. Google returns neither a phone
number nor a password, so an account created that way has neither; both stay
UNIQUE where present. Existing rows are unaffected — nothing is dropped and no
existing value becomes invalid.

Revision ID: 0010
Revises: 0009
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0010'
down_revision: Union[str, None] = '0009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OTP_PURPOSE_VALUES = ('EMAIL_VERIFICATION', 'PASSWORD_RESET')
# Created once, explicitly, in upgrade(); the column reference below uses
# create_type=False so create_table does not try to create it again.
OTP_PURPOSE = postgresql.ENUM(*_OTP_PURPOSE_VALUES, name='otppurpose', create_type=False)


def upgrade() -> None:
    op.alter_column('users', 'phone_number', existing_type=sa.String(), nullable=True)
    op.alter_column('users', 'hashed_password', existing_type=sa.String(), nullable=True)

    op.add_column('users', sa.Column('google_sub', sa.String(), nullable=True))
    op.create_index(op.f('ix_users_google_sub'), 'users', ['google_sub'], unique=True)
    op.add_column('users', sa.Column(
        'is_email_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    postgresql.ENUM(*_OTP_PURPOSE_VALUES, name='otppurpose').create(
        op.get_bind(), checkfirst=True)
    op.create_table(
        'email_otps',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        # Argon2 hash of the code. The code itself is never stored.
        sa.Column('code_hash', sa.String(), nullable=False),
        sa.Column('purpose', OTP_PURPOSE, nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('superseded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_email_otps_user_id'), 'email_otps', ['user_id'])
    op.create_index(op.f('ix_email_otps_email'), 'email_otps', ['email'])
    op.create_index(op.f('ix_email_otps_purpose'), 'email_otps', ['purpose'])


def downgrade() -> None:
    op.drop_table('email_otps')
    postgresql.ENUM(name='otppurpose').drop(op.get_bind(), checkfirst=True)
    op.drop_column('users', 'is_email_verified')
    op.drop_index(op.f('ix_users_google_sub'), table_name='users')
    op.drop_column('users', 'google_sub')
    # Rows created through Google Sign-In have no phone number or password, so
    # restoring NOT NULL would fail against them. Left nullable deliberately.
