-- Add delegated co-admin role for limited admin access.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole'
      AND e.enumlabel = 'CO_ADMIN'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'CO_ADMIN';
  END IF;
END
$$;
