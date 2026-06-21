alter table "arc-spirits-rev2".scenario_deck_entries
drop constraint if exists scenario_deck_entries_monster_id_fkey;

alter table "arc-spirits-rev2".scenario_deck_entries
add constraint scenario_deck_entries_monster_id_fkey
foreign key (monster_id)
references "arc-spirits-rev2".monsters (id)
on delete cascade;
