-- Migration: Add percent_complete to projects
-- Created: 2026-01-30
-- Description: Adds percent complete field for tracking project progress

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "percent_complete" numeric(5, 2) DEFAULT '0';
