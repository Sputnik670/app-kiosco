-- Migration already applied: Add owner_id to organizations
-- This file exists only to satisfy the migration history
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
