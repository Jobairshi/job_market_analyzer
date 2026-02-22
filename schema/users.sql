-- schema/users.sql
-- Run this in Supabase SQL Editor to set up the users table.

create table if not exists users (
    id            uuid         primary key default gen_random_uuid(),
    email         text         unique not null,
    password_hash text         not null,
    name          text,
    role          text         not null default 'user'
                               check (role in ('admin', 'user')),
    created_at    timestamptz  default now()
);

-- Index for fast email lookups during login
create index if not exists idx_users_email on users (email);
