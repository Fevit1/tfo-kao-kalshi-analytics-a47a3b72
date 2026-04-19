-- Rollback for KAO initial_schema migration
-- Since no tables were created (Phase 1 is localStorage-only),
-- rollback only needs to handle the uuid-ossp extension.
-- WARNING: Only drop uuid-ossp if no other extensions or functions depend on it.
-- On a shared Supabase project, leave uuid-ossp in place.

-- DROP EXTENSION IF EXISTS "uuid-ossp";
-- (Commented out intentionally — uuid-ossp is safe to leave and
--  may be required by Supabase internals. Uncomment only on a
--  dedicated isolated database where you are certain no other
--  feature depends on it.)

SELECT 'KAO rollback: no tables to drop. uuid-ossp extension left in place (safe).' AS rollback_status;
