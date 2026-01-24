-- Events no longer need an "internal name" separate from their UUID.
-- Use the event UUID as the internal identifier (events.name).

-- Backfill existing rows.
update "arc-spirits-rev2".events
  set name = id::text
  where name is distinct from id::text;

-- Keep events.name in sync with events.id going forward.
create or replace function "arc-spirits-rev2".events_set_name_to_id()
returns trigger
language plpgsql
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;

  new.name := new.id::text;
  return new;
end;
$$;

drop trigger if exists events_set_name_to_id_trigger on "arc-spirits-rev2".events;

create trigger events_set_name_to_id_trigger
before insert or update on "arc-spirits-rev2".events
for each row
execute function "arc-spirits-rev2".events_set_name_to_id();

