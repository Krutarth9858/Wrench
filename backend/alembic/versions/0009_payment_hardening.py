"""refund states, refund ids and webhook event idempotency

Extends the Scheduled Service payment tables. Nothing about emergency
roadside assistance is touched.

Revision ID: 0009
Revises: 0008
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0009'
down_revision: Union[str, None] = '0008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# A refund that the gateway has accepted but not yet settled, and one it
# rejected, are distinct from "we owe a refund" and from "the money is back".
NEW_PAYMENT_STATUSES = ('REFUND_INITIATED', 'REFUND_FAILED')


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block on older
    # PostgreSQL; COMMIT first so this works on 12 and up.
    op.execute('COMMIT')
    for value in NEW_PAYMENT_STATUSES:
        op.execute(f"ALTER TYPE paymentstatus ADD VALUE IF NOT EXISTS '{value}'")

    op.add_column('appointment_payments',
                  sa.Column('provider_refund_id', sa.String(), nullable=True))
    op.add_column('appointment_payments',
                  sa.Column('refunded_amount_minor', sa.Integer(), nullable=True))
    # Same guarantee as provider_payment_id: one refund per payment, ever.
    op.create_unique_constraint('uq_payment_provider_refund_id', 'appointment_payments',
                                ['provider_refund_id'])

    op.create_table(
        'webhook_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('event_id', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        # The idempotency guarantee for repeated webhook delivery.
        sa.UniqueConstraint('event_id', name='uq_webhook_event_id'),
    )


def downgrade() -> None:
    op.drop_table('webhook_events')
    op.drop_constraint('uq_payment_provider_refund_id', 'appointment_payments',
                       type_='unique')
    op.drop_column('appointment_payments', 'refunded_amount_minor')
    op.drop_column('appointment_payments', 'provider_refund_id')
    # The added enum labels are intentionally left in place: PostgreSQL cannot
    # drop a value from an enum type, and re-creating it would require rewriting
    # every dependent column.
