-- Stage Cards: allow traveler-backed cards
--
-- Adds an optional FK so a stage_cards row can reference a traveler.
-- Intended use: stage_cards.card_kind = 'traveler' with stage_cards.traveler_id pointing at travelers.id.

alter table if exists "arc-spirits-rev2".stage_cards
  add column if not exists traveler_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = '"arc-spirits-rev2".stage_cards'::regclass
      and conname = 'stage_cards_traveler_id_fkey'
  ) then
    alter table "arc-spirits-rev2".stage_cards
      add constraint stage_cards_traveler_id_fkey
      foreign key (traveler_id) references "arc-spirits-rev2".travelers(id) on delete set null;
  end if;
end $$;

comment on column "arc-spirits-rev2".stage_cards.traveler_id is
  'For traveler cards: FK to the underlying travelers row.';

create index if not exists stage_cards_traveler_id_idx
  on "arc-spirits-rev2".stage_cards (traveler_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = '"arc-spirits-rev2".stage_cards'::regclass
      and conname = 'stage_cards_traveler_id_kind_check'
  ) then
    alter table "arc-spirits-rev2".stage_cards
      add constraint stage_cards_traveler_id_kind_check
      check (
        (traveler_id is null or card_kind = 'traveler')
        and (card_kind <> 'traveler' or traveler_id is not null)
      );
  end if;
end $$;

