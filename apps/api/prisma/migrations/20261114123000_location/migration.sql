-- Optional, coarse location for distance-based discovery.
CREATE TYPE "LocationSource" AS ENUM ('DEVICE_APPROXIMATE', 'MANUAL');

ALTER TABLE "user_profiles"
  ADD COLUMN "location_source" "LocationSource",
  ADD COLUMN "place_id" VARCHAR(40),
  ADD COLUMN "region" VARCHAR(80),
  ADD COLUMN "area" VARCHAR(80);

-- No location was ever collected before this migration; clear any stray values.
UPDATE "user_profiles" SET "latitude" = NULL, "longitude" = NULL WHERE "location_source" IS NULL;

-- Coordinates only exist with a source. A device location always has them;
-- a manual one has them only when it came from a listed place.
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_location_source_consistent"
  CHECK (
    ("location_source" IS NULL AND "latitude" IS NULL AND "place_id" IS NULL AND "area" IS NULL AND "region" IS NULL)
    OR ("location_source" = 'DEVICE_APPROXIMATE' AND "latitude" IS NOT NULL AND "place_id" IS NULL)
    OR ("location_source" = 'MANUAL' AND (("place_id" IS NULL) = ("latitude" IS NULL)))
  );

-- Stored on a 0.02° grid (about 2 km): never finer.
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_coordinates_coarse"
  CHECK (
    "latitude" IS NULL
    OR (abs("latitude" * 50 - round("latitude" * 50)) < 1e-6 AND abs("longitude" * 50 - round("longitude" * 50)) < 1e-6)
  );

-- Supports the bounding-box prefilter for distance-limited discovery.
CREATE INDEX "user_profiles_lat_lon_idx" ON "user_profiles" ("latitude", "longitude") WHERE "latitude" IS NOT NULL;
