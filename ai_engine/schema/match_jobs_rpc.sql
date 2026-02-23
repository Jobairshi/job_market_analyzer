-- schema/match_jobs_rpc.sql
-- Run this in Supabase SQL Editor to create the vector similarity search function.
-- This enables fast server-side matching without pulling all embeddings.

create or replace function match_jobs_by_resume(
    query_embedding vector(384),
    match_count int default 10
)
returns table (
    id            uuid,
    title         text,
    company       text,
    location      text,
    link          text,
    cleaned_tags  text[],
    similarity    float
)
language plpgsql
as $$
begin
    return query
    select
        j.id,
        j.title,
        j.company,
        j.location,
        j.link,
        j.cleaned_tags,
        1 - (j.embedding <=> query_embedding) as similarity
    from jobs j
    where j.embedding is not null
    order by j.embedding <=> query_embedding
    limit match_count;
end;
$$;
