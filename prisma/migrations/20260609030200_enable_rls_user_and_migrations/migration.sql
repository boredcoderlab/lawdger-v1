-- Enable RLS on User: no policies, default-deny.
-- Prisma uses the service-role connection which bypasses RLS.
-- This locks out anon key holders from reading hashed passwords.
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on _prisma_migrations: no policies, default-deny.
-- Internal infrastructure — no app code reads this table.
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
