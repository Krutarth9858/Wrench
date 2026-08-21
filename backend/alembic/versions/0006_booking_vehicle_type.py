"""booking carries vehicle_type; saved vehicle becomes optional

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-21 14:20:00.000000

A customer must be able to request roadside assistance without first registering
a vehicle. The booking now stores the canonical VehicleType directly, and
`vehicle_id` becomes an optional link rather than a prerequisite.

Existing rows are preserved: vehicle_type is backfilled from the linked vehicle
before the column is made NOT NULL. No data is destroyed.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0006'
down_revision: Union[str, None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add nullable so existing rows survive the add.
    op.add_column(
        'bookings',
        sa.Column('vehicle_type',
                  sa.Enum('BIKE', 'CAR', name='vehicletype', create_type=False),
                  nullable=True),
    )
    # 2. Backfill from the vehicle each booking already referenced.
    op.execute(
        """
        UPDATE bookings b
        SET vehicle_type = v.vehicle_type
        FROM vehicles v
        WHERE b.vehicle_id = v.id
        """
    )
    # 3. Any orphan (should not exist: vehicle_id was NOT NULL) defaults to CAR.
    op.execute("UPDATE bookings SET vehicle_type = 'CAR' WHERE vehicle_type IS NULL")
    op.alter_column('bookings', 'vehicle_type', nullable=False)
    op.create_index(op.f('ix_bookings_vehicle_type'), 'bookings', ['vehicle_type'])

    # 4. The saved-vehicle link is now optional.
    op.alter_column('bookings', 'vehicle_id', existing_type=sa.UUID(), nullable=True)
    op.drop_constraint('bookings_vehicle_id_fkey', 'bookings', type_='foreignkey')
    op.create_foreign_key('bookings_vehicle_id_fkey', 'bookings', 'vehicles',
                          ['vehicle_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('bookings_vehicle_id_fkey', 'bookings', type_='foreignkey')
    op.create_foreign_key('bookings_vehicle_id_fkey', 'bookings', 'vehicles',
                          ['vehicle_id'], ['id'], ondelete='RESTRICT')
    # Rows created without a saved vehicle cannot satisfy the old NOT NULL.
    op.execute("DELETE FROM bookings WHERE vehicle_id IS NULL")
    op.alter_column('bookings', 'vehicle_id', existing_type=sa.UUID(), nullable=False)
    op.drop_index(op.f('ix_bookings_vehicle_type'), table_name='bookings')
    op.drop_column('bookings', 'vehicle_type')
