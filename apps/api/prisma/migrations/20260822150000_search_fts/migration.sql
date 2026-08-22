-- Full-text + fuzzy property search (Phase 7). Behind SearchService so OpenSearch
-- can replace it later. Prisma can't emit CREATE EXTENSION / functional GIN, so
-- this migration is hand-written.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- FTS over name + city + description (IMMUTABLE two-arg to_tsvector with explicit config).
CREATE INDEX IF NOT EXISTS "Property_fts_idx" ON "Property"
  USING GIN (
    to_tsvector(
      'english',
      coalesce(name, '') || ' ' || coalesce(city, '') || ' ' || coalesce(description, '')
    )
  );

-- Trigram indexes for fuzzy destination matching (typos, partials).
CREATE INDEX IF NOT EXISTS "Property_name_trgm_idx" ON "Property" USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Property_city_trgm_idx" ON "Property" USING GIN (city gin_trgm_ops);
