-- Reordering photos needs temporary positions outside the visible slots, because
-- the partial unique index on (user_id, position) is checked row by row.
-- The slot limit itself is enforced by the application (MAX_PHOTOS).
ALTER TABLE "user_photos" DROP CONSTRAINT "user_photos_position_range";
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_position_nonnegative"
  CHECK ("position" >= 0);

-- Initial interest catalogue for onboarding. Editable later from the admin console.
INSERT INTO "interests" ("id", "slug", "label", "category") VALUES
  (gen_random_uuid(), 'indie-music', 'Indie music', 'music'),
  (gen_random_uuid(), 'hip-hop', 'Hip-hop', 'music'),
  (gen_random_uuid(), 'classical-indian', 'Indian classical', 'music'),
  (gen_random_uuid(), 'live-gigs', 'Live gigs', 'music'),
  (gen_random_uuid(), 'electronic', 'Electronic', 'music'),
  (gen_random_uuid(), 'arthouse-film', 'Arthouse film', 'screen'),
  (gen_random_uuid(), 'anime', 'Anime', 'screen'),
  (gen_random_uuid(), 'documentaries', 'Documentaries', 'screen'),
  (gen_random_uuid(), 'stand-up', 'Stand-up comedy', 'screen'),
  (gen_random_uuid(), 'literary-fiction', 'Literary fiction', 'ideas'),
  (gen_random_uuid(), 'poetry', 'Poetry', 'ideas'),
  (gen_random_uuid(), 'philosophy', 'Philosophy', 'ideas'),
  (gen_random_uuid(), 'startups', 'Startups', 'ideas'),
  (gen_random_uuid(), 'science', 'Science', 'ideas'),
  (gen_random_uuid(), 'politics-society', 'Society and politics', 'ideas'),
  (gen_random_uuid(), 'street-food', 'Street food', 'food'),
  (gen_random_uuid(), 'home-cooking', 'Home cooking', 'food'),
  (gen_random_uuid(), 'specialty-coffee', 'Specialty coffee', 'food'),
  (gen_random_uuid(), 'baking', 'Baking', 'food'),
  (gen_random_uuid(), 'trekking', 'Trekking', 'outdoors'),
  (gen_random_uuid(), 'road-trips', 'Road trips', 'outdoors'),
  (gen_random_uuid(), 'beaches', 'Beaches', 'outdoors'),
  (gen_random_uuid(), 'solo-travel', 'Solo travel', 'outdoors'),
  (gen_random_uuid(), 'running', 'Running', 'movement'),
  (gen_random_uuid(), 'yoga', 'Yoga', 'movement'),
  (gen_random_uuid(), 'strength-training', 'Strength training', 'movement'),
  (gen_random_uuid(), 'cricket', 'Cricket', 'movement'),
  (gen_random_uuid(), 'football', 'Football', 'movement'),
  (gen_random_uuid(), 'dance', 'Dance', 'movement'),
  (gen_random_uuid(), 'photography', 'Photography', 'making'),
  (gen_random_uuid(), 'illustration', 'Illustration', 'making'),
  (gen_random_uuid(), 'writing', 'Writing', 'making'),
  (gen_random_uuid(), 'thrifting', 'Thrifting', 'making'),
  (gen_random_uuid(), 'gaming', 'Gaming', 'play'),
  (gen_random_uuid(), 'board-games', 'Board games', 'play'),
  (gen_random_uuid(), 'quizzing', 'Quizzing', 'play');
