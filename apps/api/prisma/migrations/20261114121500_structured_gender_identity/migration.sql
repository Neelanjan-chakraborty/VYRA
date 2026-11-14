-- Structured gender identity replaces free-text gender, and explicit
-- "show me" choices replace free-text "interested in" labels.
-- Expand → migrate data → contract, in one migration (pre-launch, no live readers).

CREATE TYPE "GenderIdentity" AS ENUM ('WOMAN', 'MAN', 'NON_BINARY', 'SELF_DESCRIBE', 'PREFER_NOT_TO_SAY');

ALTER TABLE "user_profiles"
  ADD COLUMN "gender_identity" "GenderIdentity",
  ADD COLUMN "gender_self_description" VARCHAR(40),
  ADD COLUMN "gender_visible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "discoverable_as" "GenderIdentity"[] NOT NULL DEFAULT ARRAY[]::"GenderIdentity"[];

ALTER TABLE "discovery_preferences"
  ADD COLUMN "show_genders" "GenderIdentity"[] NOT NULL DEFAULT ARRAY[]::"GenderIdentity"[],
  ADD COLUMN "include_unlisted_genders" BOOLEAN NOT NULL DEFAULT true;

-- Existing free text: exact well-known words map to an identity; anything else
-- the person wrote is kept as their own self-description. Nothing is guessed.
UPDATE "user_profiles" SET "gender_identity" = CASE
    WHEN lower(trim("gender")) IN ('woman', 'female', 'f') THEN 'WOMAN'::"GenderIdentity"
    WHEN lower(trim("gender")) IN ('man', 'male', 'm') THEN 'MAN'::"GenderIdentity"
    WHEN lower(trim("gender")) IN ('non-binary', 'nonbinary', 'nb', 'enby') THEN 'NON_BINARY'::"GenderIdentity"
    ELSE 'SELF_DESCRIBE'::"GenderIdentity"
  END,
  "gender_self_description" = CASE
    WHEN lower(trim("gender")) IN ('woman', 'female', 'f', 'man', 'male', 'm', 'non-binary', 'nonbinary', 'nb', 'enby') THEN NULL
    ELSE left(trim("gender"), 40)
  END
WHERE "gender" IS NOT NULL AND trim("gender") <> '';

UPDATE "discovery_preferences" SET "show_genders" = ARRAY(
  SELECT DISTINCT CASE lower(trim(label))
      WHEN 'women' THEN 'WOMAN'::"GenderIdentity"
      WHEN 'men' THEN 'MAN'::"GenderIdentity"
      WHEN 'non-binary people' THEN 'NON_BINARY'::"GenderIdentity"
    END
  FROM unnest("interested_in") AS label
  WHERE lower(trim(label)) IN ('women', 'men', 'non-binary people')
);

ALTER TABLE "user_profiles" DROP COLUMN "gender";
ALTER TABLE "discovery_preferences" DROP COLUMN "interested_in";

-- A self-description only exists with SELF_DESCRIBE; searches to appear in likewise.
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_self_description_consistent"
  CHECK ("gender_self_description" IS NULL OR "gender_identity" = 'SELF_DESCRIBE');
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_discoverable_as_consistent"
  CHECK (cardinality("discoverable_as") = 0 OR "gender_identity" = 'SELF_DESCRIBE');
-- Only concrete identities can be searched for or appeared in.
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_discoverable_as_categories"
  CHECK (NOT ("discoverable_as" && ARRAY['SELF_DESCRIBE', 'PREFER_NOT_TO_SAY']::"GenderIdentity"[]));
ALTER TABLE "discovery_preferences" ADD CONSTRAINT "discovery_preferences_show_genders_categories"
  CHECK (NOT ("show_genders" && ARRAY['SELF_DESCRIBE', 'PREFER_NOT_TO_SAY']::"GenderIdentity"[]));
