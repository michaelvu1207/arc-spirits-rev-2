-- Fix the icon-sync trigger after the runes -> mat_items rename.
--
-- The previous sync_rune_icon() referenced NEW.class_id (dropped in 20260620000004)
-- and wrote the now-stale source_table = 'runes', so ANY insert/update on mat_items
-- would error. Rewrite it to use the current schema (origin_id + kind) and the new
-- table name, and pin search_path (fixes the "function search_path mutable" advisory
-- for this function). source_type stays 'rune' so existing icon_pool keys are stable.

create or replace function "arc-spirits-rev2".sync_rune_icon()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
        if new.icon_path is not null then
            insert into "arc-spirits-rev2".icon_pool
                (name, source_type, source_id, source_table, file_path, metadata, updated_at)
            values
                ('Rune: ' || new.name, 'rune', new.id, 'mat_items', new.icon_path,
                 jsonb_build_object('origin_id', new.origin_id, 'kind', new.kind),
                 now())
            on conflict (source_type, source_id)
            do update set
                name = excluded.name,
                file_path = excluded.file_path,
                metadata = excluded.metadata,
                updated_at = now();
        elsif tg_op = 'UPDATE' and old.icon_path is not null and new.icon_path is null then
            delete from "arc-spirits-rev2".icon_pool
            where source_type = 'rune' and source_id = new.id;
        end if;
        return new;
    end if;

    if tg_op = 'DELETE' then
        delete from "arc-spirits-rev2".icon_pool
        where source_type = 'rune' and source_id = old.id;
        return old;
    end if;

    return null;
end;
$function$;

-- Repoint the 12 existing icon_pool rows to the renamed source table.
update "arc-spirits-rev2".icon_pool
   set source_table = 'mat_items'
 where source_type = 'rune' and source_table = 'runes';
