-- Retain fractional projector production without repricing or resetting existing wallets.
ALTER TABLE mg_cinema_pets ADD COLUMN IF NOT EXISTS production_carry integer NOT NULL DEFAULT 0;
DO $wallet_constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='mg_cinema_pets'::regclass AND conname='mg_pet_carry_valid') THEN
    ALTER TABLE mg_cinema_pets ADD CONSTRAINT mg_pet_carry_valid CHECK (production_carry BETWEEN 0 AND 3599999);
  END IF;
END
$wallet_constraints$;
-- Weekly/milestone payouts reuse the existing atomic, unique-source ledger.
-- The ledger source index and RLS from virtual-pet.sql remain in force.
