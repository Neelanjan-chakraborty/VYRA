-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "username" VARCHAR(30),
ADD COLUMN     "username_changed_at" TIMESTAMPTZ(3);

-- Fuzzy matching for people search. Both extensions are contrib and "trusted", so
-- the application role can create them.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() is only STABLE; with the dictionary named it never changes, so an
-- IMMUTABLE wrapper is safe and lets the fold be indexed.
CREATE FUNCTION vyra_fold(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, $1)) $$;

-- Usernames are unique among people who have chosen one.
CREATE UNIQUE INDEX user_profiles_username_key ON user_profiles (username) WHERE username IS NOT NULL;

-- Shape: lower-case, 3-30 characters, letters/digits/dot/underscore, starting and
-- ending with a letter or digit, no two separators in a row. The API applies the same
-- rules (and the reserved-name list); this keeps the table honest on its own.
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_username_shape CHECK (
  username IS NULL OR (
    username = lower(username)
    AND char_length(username) BETWEEN 3 AND 30
    AND username ~ '^[a-z0-9]([a-z0-9._]*[a-z0-9])$'
    AND username !~ '[._]{2}'
  )
);

-- Trigram indexes behind prefix, contains and typo-tolerant search.
CREATE INDEX user_profiles_username_trgm ON user_profiles USING gin (username gin_trgm_ops) WHERE username IS NOT NULL;
CREATE INDEX user_profiles_display_name_trgm ON user_profiles USING gin (vyra_fold(display_name) gin_trgm_ops);
