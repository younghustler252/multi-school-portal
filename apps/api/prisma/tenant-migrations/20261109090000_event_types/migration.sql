-- Events & Calendar, part 1: new event categories. ENUM VALUES ONLY: PostgreSQL cannot use a new enum value in the
-- transaction that added it, so nothing in this file (or the provisioning run that applies it) may use them.
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'meeting';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'sports';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'ceremony';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'graduation';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'resumption';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'pta';
