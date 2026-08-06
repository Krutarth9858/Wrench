"""create profile tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-04 13:58:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Customer Profiles Table
    op.create_table(
        'customer_profiles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=False),
        sa.Column('phone_number', sa.String(), nullable=False),
        sa.Column('profile_image', sa.String(), nullable=True),
        sa.Column('date_of_birth', sa.String(), nullable=True),
        sa.Column('gender', sa.String(), nullable=True),
        sa.Column('emergency_contact_name', sa.String(), nullable=False),
        sa.Column('emergency_contact_number', sa.String(), nullable=False),
        sa.Column('address', sa.String(), nullable=False),
        sa.Column('city', sa.String(), nullable=False),
        sa.Column('state', sa.String(), nullable=False),
        sa.Column('country', sa.String(), nullable=False),
        sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_customer_profiles_user_id'), 'customer_profiles', ['user_id'], unique=True)

    # Mechanic Profiles Table
    op.create_table(
        'mechanic_profiles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('garage_name', sa.String(), nullable=False),
        sa.Column('owner_name', sa.String(), nullable=False),
        sa.Column('experience_years', sa.Integer(), nullable=False),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('specialization', sa.String(), nullable=False),
        sa.Column('supported_vehicle_types', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('address', sa.String(), nullable=False),
        sa.Column('city', sa.String(), nullable=False),
        sa.Column('state', sa.String(), nullable=False),
        sa.Column('country', sa.String(), nullable=False),
        sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column('service_radius_km', sa.Float(), nullable=False),
        sa.Column('working_start_time', sa.String(), nullable=False),
        sa.Column('working_end_time', sa.String(), nullable=False),
        sa.Column('is_available', sa.Boolean(), nullable=True),
        sa.Column('is_verified', sa.Boolean(), nullable=True),
        sa.Column('average_rating', sa.Float(), nullable=True),
        sa.Column('total_reviews', sa.Integer(), nullable=True),
        sa.Column('completed_jobs', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_mechanic_profiles_user_id'), 'mechanic_profiles', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_mechanic_profiles_user_id'), table_name='mechanic_profiles')
    op.drop_table('mechanic_profiles')
    
    op.drop_index(op.f('ix_customer_profiles_user_id'), table_name='customer_profiles')
    op.drop_table('customer_profiles')
