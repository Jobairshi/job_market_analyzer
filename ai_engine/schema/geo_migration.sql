-- schema/geo_migration.sql
-- Adds PostGIS geo support + location caching to the jobs database.
-- Run this in Supabase SQL Editor.

-- ─── 1. Enable PostGIS extension ────────────────────────────────────
create extension if not exists postgis;

-- ─── 2. Add geo columns to jobs table ──────────────────────────────
alter table jobs add column if not exists latitude double precision;
alter table jobs add column if not exists longitude double precision;
alter table jobs add column if not exists geo_location geography(Point, 4326);

-- ─── 3. Spatial index for fast geo queries ─────────────────────────
create index if not exists jobs_geo_idx
on jobs using gist (geo_location);

-- ─── 4. Location cache table (prevents duplicate Nominatim calls) ──
create table if not exists location_cache (
    id              uuid            default gen_random_uuid() primary key,
    location_text   text            unique not null,
    latitude        double precision not null,
    longitude       double precision not null,
    geo_location    geography(Point, 4326),
    created_at      timestamptz     default now()
);

create index if not exists location_cache_text_idx
on location_cache (location_text);

create index if not exists location_cache_geo_idx
on location_cache using gist (geo_location);

-- ─── 5. Auto-populate geo_location on jobs when lat/lng are set ────
-- Trigger keeps geo_location in sync any time latitude/longitude change.
create or replace function jobs_update_geo_location()
returns trigger as $$
begin
    if NEW.latitude is not null and NEW.longitude is not null then
        NEW.geo_location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    else
        NEW.geo_location := null;
    end if;
    return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_jobs_geo on jobs;
create trigger trg_jobs_geo
before insert or update of latitude, longitude on jobs
for each row execute function jobs_update_geo_location();

-- ─── 6. Same trigger for location_cache ────────────────────────────
create or replace function location_cache_update_geo()
returns trigger as $$
begin
    NEW.geo_location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_location_cache_geo on location_cache;
create trigger trg_location_cache_geo
before insert or update of latitude, longitude on location_cache
for each row execute function location_cache_update_geo();

-- ─── 7. Helper: find jobs within a radius (meters) ─────────────────
-- Example: select * from nearby_jobs(40.7128, -74.0060, 50000);
create or replace function nearby_jobs(
    lat double precision,
    lng double precision,
    radius_meters double precision default 50000
)
returns setof jobs as $$
    select *
    from jobs
    where geo_location is not null
      and ST_DWithin(
            geo_location,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
            radius_meters
          )
    order by geo_location <-> ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;
$$ language sql stable;
