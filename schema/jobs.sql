-- schema/jobs.sql
-- Run this in Supabase SQL Editor to set up the jobs table.

create extension if not exists "pgcrypto";

create table if not exists jobs (
    id            uuid         primary key default gen_random_uuid(),
    source        text         not null,
    title         text         not null,
    company       text,
    location      text,
    tags          text[]       default '{}',
    cleaned_tags  text[]       default '{}',
    link          text         unique not null,
    description   text,
    created_at    timestamptz  default now(),
    scraped_at    timestamptz  default now()
);

-- Index on link for fast upsert conflict detection
create index if not exists idx_jobs_link on jobs (link);

-- Index on source for filtering
create index if not exists idx_jobs_source on jobs (source);

-- Index on scraped_at for time-based queries
create index if not exists idx_jobs_scraped_at on jobs (scraped_at desc);
