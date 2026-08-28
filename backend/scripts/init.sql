-- Enable pgcrypto for gen_random_uuid() if not using PostgreSQL 13+
-- PostgreSQL 13+ has gen_random_uuid() built-in
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
