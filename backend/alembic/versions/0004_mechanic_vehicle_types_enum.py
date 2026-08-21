"""normalise mechanic supported_vehicle_types to the canonical VehicleType enum

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-21 02:10:00.000000

The column was ARRAY(String) validated against an ad-hoc whitelist
{Bike, Car, EV, Truck, Scooter}, which disagreed with the VehicleType enum
(BIKE | CAR) and admitted `Truck`, outside the RAD's two/four-wheeler scope.
This aligns the database with the canonical enum.

Legacy values are folded into scope before the type change:
  Bike, Scooter -> BIKE      Car, EV -> CAR      Truck -> dropped
A profile left with no types falls back to CAR, since the schema requires at
least one supported type.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Fold legacy strings into the supported scope, de-duplicating as we go.
    op.execute(
        """
        UPDATE mechanic_profiles
        SET supported_vehicle_types = COALESCE(
            (
                SELECT ARRAY(
                    SELECT DISTINCT CASE
                        WHEN upper(t) IN ('BIKE', 'SCOOTER') THEN 'BIKE'
                        WHEN upper(t) IN ('CAR', 'EV')       THEN 'CAR'
                    END
                    FROM unnest(supported_vehicle_types) AS t
                    WHERE upper(t) IN ('BIKE', 'SCOOTER', 'CAR', 'EV')
                )
            ),
            ARRAY[]::text[]
        )
        """
    )
    op.execute(
        """
        UPDATE mechanic_profiles
        SET supported_vehicle_types = ARRAY['CAR']
        WHERE supported_vehicle_types IS NULL
           OR cardinality(supported_vehicle_types) = 0
        """
    )
    # `vehicletype` already exists (created in 0003 for the vehicles table).
    op.execute(
        "ALTER TABLE mechanic_profiles "
        "ALTER COLUMN supported_vehicle_types TYPE vehicletype[] "
        "USING supported_vehicle_types::vehicletype[]"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE mechanic_profiles "
        "ALTER COLUMN supported_vehicle_types TYPE varchar[] "
        "USING supported_vehicle_types::varchar[]"
    )
