"""create vehicle table

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-04 14:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enum Types
    vehicle_type_enum = postgresql.ENUM('BIKE', 'CAR', name='vehicletype')
    vehicle_type_enum.create(op.get_bind())
    
    fuel_type_enum = postgresql.ENUM('PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID', name='fueltype')
    fuel_type_enum.create(op.get_bind())

    # Vehicles Table
    op.create_table(
        'vehicles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('vehicle_type', postgresql.ENUM('BIKE', 'CAR', name='vehicletype', create_type=False), nullable=False),
        sa.Column('brand', sa.String(), nullable=False),
        sa.Column('model', sa.String(), nullable=False),
        sa.Column('fuel_type', postgresql.ENUM('PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID', name='fueltype', create_type=False), nullable=False),
        sa.Column('registration_number', sa.String(length=20), nullable=True),
        sa.Column('nickname', sa.String(length=50), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vehicles_user_id'), 'vehicles', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_vehicles_user_id'), table_name='vehicles')
    op.drop_table('vehicles')
    
    vehicle_type_enum = postgresql.ENUM('BIKE', 'CAR', name='vehicletype')
    vehicle_type_enum.drop(op.get_bind())
    
    fuel_type_enum = postgresql.ENUM('PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID', name='fueltype')
    fuel_type_enum.drop(op.get_bind())
