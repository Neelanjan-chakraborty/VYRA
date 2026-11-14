-- Deal-breakers (exclude-lists) become relationship criteria with three modes:
-- must (strict), prefer (ranking only) and open. Existing exclude-lists convert
-- to "must" with the accepted values being every option not excluded.
ALTER TABLE "discovery_preferences" RENAME COLUMN "deal_breakers" TO "relationship_criteria";

UPDATE "discovery_preferences" dp
SET "relationship_criteria" = COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
    'criterion', rule->>'attribute',
    'mode', 'must',
    'accepted', COALESCE((
      SELECT jsonb_agg(opt)
      FROM jsonb_array_elements_text(CASE rule->>'attribute'
        WHEN 'lifestylePace' THEN '["homebody","balanced","outgoing"]'::jsonb
        WHEN 'weekendRhythm' THEN '["restful","social","adventurous","productive"]'::jsonb
        WHEN 'communicationStyle' THEN '["concise","expansive","playful","reflective"]'::jsonb
        ELSE '[]'::jsonb
      END) AS opt
      WHERE NOT (rule->'exclude' ? opt)
    ), '[]'::jsonb)
  ))
  FROM jsonb_array_elements(dp."relationship_criteria") AS rule
), '[]'::jsonb)
WHERE jsonb_typeof(dp."relationship_criteria") = 'array' AND jsonb_array_length(dp."relationship_criteria") > 0;

ALTER TABLE "discovery_preferences" ADD CONSTRAINT "discovery_preferences_criteria_is_array"
  CHECK (jsonb_typeof("relationship_criteria") = 'array');
