-- Phase 1.1 — database-per-service bootstrap.
--
-- `talent_auth` is created by the postgres image through POSTGRES_DB. The
-- remaining service databases are created here so every bounded context owns a
-- separate schema namespace from day one.

\set ON_ERROR_STOP on

SELECT 'CREATE DATABASE talent_recruiter'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'talent_recruiter')\gexec

SELECT 'CREATE DATABASE talent_engagement'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'talent_engagement')\gexec

SELECT 'CREATE DATABASE talent_rewards'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'talent_rewards')\gexec

SELECT 'CREATE DATABASE talent_analytics'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'talent_analytics')\gexec

\connect talent_auth
CREATE EXTENSION IF NOT EXISTS pgcrypto;

\connect talent_recruiter
CREATE EXTENSION IF NOT EXISTS pgcrypto;

\connect talent_engagement
CREATE EXTENSION IF NOT EXISTS pgcrypto;

\connect talent_rewards
CREATE EXTENSION IF NOT EXISTS pgcrypto;

\connect talent_analytics
CREATE EXTENSION IF NOT EXISTS pgcrypto;
