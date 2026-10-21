-- Keep the class ID so existing spirit associations remain intact.
UPDATE arc_spirits_assets.classes
SET name = 'Aegis Weaver', effect_schema = '[{"count":1,"effects":[{"type":"benefit","description":"Whenever your Max Barrier increases, restore an equal amount of Barrier, then gain 4 Initiative. For example, gaining 2 Max Barrier restores 2 Barrier. If your Max Barrier does not increase because it is already at its cap, this effect does not trigger."}]}]'::jsonb
WHERE id = '8015821c-08cd-4895-9b03-865ad09976aa';
