-- Consolidate the obsolete Strategist / Runic Bulwark identity into Soul Weaver.
-- Soul Weaver remains the canonical class record and description.
BEGIN;
UPDATE arc_spirits_assets.hex_spirits
SET traits = jsonb_set(
  traits,
  '{class_ids}',
  (SELECT jsonb_agg(DISTINCT CASE
    WHEN value = '4768cb25-60ac-4178-b9e3-25aca98f495a' THEN '17e08cde-f3d2-480b-8386-1e3047e2f85a'
    ELSE value
  END) FROM jsonb_array_elements_text(COALESCE(traits->'class_ids', '[]'::jsonb)) AS value)
)
WHERE traits->'class_ids' ? '4768cb25-60ac-4178-b9e3-25aca98f495a';
DELETE FROM arc_spirits_assets.classes WHERE id = '4768cb25-60ac-4178-b9e3-25aca98f495a';
COMMIT;
