"""create scheduled service tables and seed the service catalogue

Adds Scheduled Service alongside — never replacing — emergency roadside
assistance. The `bookings` table and `bookingstatus` enum are untouched.

Revision ID: 0008
Revises: 0007
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0008'
down_revision: Union[str, None] = '0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Types are created once, explicitly, in upgrade(). The column definitions below
# reference them with create_type=False so create_table does not try again.
_SERVICE_TYPE_VALUES = ('BASIC', 'FULL', 'ENGINE_CHECKUP', 'CUSTOM')
_APPOINTMENT_STATUS_VALUES = (
    'REQUESTED', 'QUOTED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'CONFIRMED',
    'IN_SERVICE', 'COMPLETED', 'DECLINED', 'CANCELLED',
)
_PAYMENT_STATUS_VALUES = (
    'NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED', 'REFUND_PENDING', 'REFUNDED',
)

SERVICE_TYPE = postgresql.ENUM(*_SERVICE_TYPE_VALUES, name='servicetype', create_type=False)
APPOINTMENT_STATUS = postgresql.ENUM(*_APPOINTMENT_STATUS_VALUES,
                                     name='appointmentstatus', create_type=False)
PAYMENT_STATUS = postgresql.ENUM(*_PAYMENT_STATUS_VALUES,
                                 name='paymentstatus', create_type=False)
# Already created by migration 0004; reused, never redefined.
VEHICLE_TYPE = postgresql.ENUM('BIKE', 'CAR', name='vehicletype', create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    postgresql.ENUM(*_SERVICE_TYPE_VALUES, name='servicetype').create(bind, checkfirst=True)
    postgresql.ENUM(*_APPOINTMENT_STATUS_VALUES,
                    name='appointmentstatus').create(bind, checkfirst=True)
    postgresql.ENUM(*_PAYMENT_STATUS_VALUES,
                    name='paymentstatus').create(bind, checkfirst=True)

    op.create_table(
        'service_packages',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('service_type', SERVICE_TYPE, nullable=False),
        sa.Column('vehicle_type', VEHICLE_TYPE, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('included_items', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('best_for', sa.Text(), nullable=False),
        sa.Column('price_minor', sa.Integer(), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('service_type', 'vehicle_type',
                            name='uq_service_package_type_vehicle'),
    )
    op.create_index(op.f('ix_service_packages_service_type'), 'service_packages',
                    ['service_type'])
    op.create_index(op.f('ix_service_packages_vehicle_type'), 'service_packages',
                    ['vehicle_type'])
    op.create_index(op.f('ix_service_packages_is_active'), 'service_packages', ['is_active'])

    op.create_table(
        'appointments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('mechanic_id', sa.UUID(), nullable=False),
        sa.Column('service_package_id', sa.UUID(), nullable=True),
        sa.Column('service_type', SERVICE_TYPE, nullable=False),
        sa.Column('vehicle_type', VEHICLE_TYPE, nullable=False),
        sa.Column('scheduled_date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('service_latitude', sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column('service_longitude', sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column('service_address', sa.String(), nullable=True),
        sa.Column('status', APPOINTMENT_STATUS, nullable=False),
        sa.Column('payment_status', PAYMENT_STATUS, nullable=False),
        sa.Column('price_minor', sa.Integer(), nullable=True),
        sa.Column('quoted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['mechanic_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['service_package_id'], ['service_packages.id'],
                                ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    for column in ('customer_id', 'mechanic_id', 'service_package_id', 'service_type',
                   'vehicle_type', 'scheduled_date', 'status', 'payment_status'):
        op.create_index(op.f(f'ix_appointments_{column}'), 'appointments', [column])

    # The actual double-booking guarantee. Two customers racing for the same
    # mechanic and slot cannot both win: the loser's INSERT violates this index
    # and the service layer turns it into a 409. Terminal appointments are
    # excluded so a cancelled or declined slot is genuinely free again.
    op.execute(
        """
        CREATE UNIQUE INDEX uq_appointment_active_slot
        ON appointments (mechanic_id, scheduled_date, start_time)
        WHERE status IN ('REQUESTED', 'QUOTED', 'PAYMENT_PENDING',
                         'PAYMENT_CONFIRMED', 'CONFIRMED', 'IN_SERVICE')
        """
    )

    op.create_table(
        'appointment_payments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('appointment_id', sa.UUID(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('provider_order_id', sa.String(), nullable=False),
        sa.Column('provider_payment_id', sa.String(), nullable=True),
        sa.Column('amount_minor', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(), nullable=False, server_default='INR'),
        sa.Column('status', PAYMENT_STATUS, nullable=False),
        sa.Column('failure_reason', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        # Idempotency: one gateway payment id can only ever be applied once.
        sa.UniqueConstraint('provider_payment_id', name='uq_payment_provider_payment_id'),
    )
    op.create_index(op.f('ix_appointment_payments_appointment_id'),
                    'appointment_payments', ['appointment_id'])
    op.create_index(op.f('ix_appointment_payments_provider_order_id'),
                    'appointment_payments', ['provider_order_id'])
    op.create_index(op.f('ix_appointment_payments_status'), 'appointment_payments', ['status'])

    _seed_catalogue()


def _seed_catalogue() -> None:
    """Seed the catalogue from the single price authority.

    Imported here rather than at module scope so the migration file stays
    importable by Alembic's own tooling without the app package configured.
    """
    from app.services.service_catalog import seed_rows

    packages = sa.table(
        'service_packages',
        sa.column('id', sa.UUID()),
        sa.column('service_type', SERVICE_TYPE),
        sa.column('vehicle_type', VEHICLE_TYPE),
        sa.column('name', sa.String()),
        sa.column('description', sa.Text()),
        sa.column('included_items', postgresql.ARRAY(sa.String())),
        sa.column('best_for', sa.Text()),
        sa.column('price_minor', sa.Integer()),
        sa.column('duration_minutes', sa.Integer()),
    )
    import uuid as _uuid
    op.bulk_insert(packages, [{**row, 'id': _uuid.uuid4()} for row in seed_rows()])


def downgrade() -> None:
    op.drop_table('appointment_payments')
    op.execute('DROP INDEX IF EXISTS uq_appointment_active_slot')
    op.drop_table('appointments')
    op.drop_table('service_packages')
    bind = op.get_bind()
    for name in ('paymentstatus', 'appointmentstatus', 'servicetype'):
        postgresql.ENUM(name=name).drop(bind, checkfirst=True)
