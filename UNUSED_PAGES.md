# Unused / non-sidebar pages

Source of truth for "allowed pages" is the sidebar nav in `src/routes/+layout.svelte` (`navSections`).

## Pages currently in the sidebar

- `/traits`
- `/dice`
- `/editions`
- `/artifacts`
- `/hex-spirits`
- `/guardians`
- `/arcane-abyss`
- `/arcane-abyss/events`
- `/travelers`
- `/vengeance-cards`
- `/game-locations`
- `/spirit-world`
- `/icons`
- `/assets`
- `/screenshot-upload`
- `/json-viewer`
- `/analysis`
- `/tts-menu`
- `/schema`
- `/settings`

## Pages removed from routing (archived)

These were SvelteKit routes (had `+page.svelte`) but were not present in the sidebar and had no in-repo link/reference to their route path. They were moved out of `src/routes` so they no longer register as pages.

- `/alternative-dice` -> `_archived_routes/routes/alternative-dice`
- `/analysis/fighter-scratch` -> `_archived_routes/routes/analysis-fighter-scratch`
- `/artifact-cards-preview` -> `_archived_routes/routes/artifact-cards-preview`
- `/class-analysis` -> `_archived_routes/routes/class-analysis`
- `/curve-fitting` -> `_archived_routes/routes/curve-fitting`
- `/custom-dice` -> `_archived_routes/routes/custom-dice`
- `/dice-gallery` -> `_archived_routes/routes/dice-gallery`
- `/dice-simulator` -> `_archived_routes/routes/dice-simulator`
- `/events-monsters-preview` -> `_archived_routes/routes/events-monsters-preview`
- `/hex-spirits-analysis` -> `_archived_routes/routes/hex-spirits-analysis`
- `/hex-spirits/[viewMode]` -> `_archived_routes/routes/hex-spirits/[viewMode]`
- `/monster-editor` -> `_archived_routes/routes/monster-editor`
- `/shop-analysis` -> `_archived_routes/routes/shop-analysis`
- `/travelers/quest-preview` -> `_archived_routes/routes/travelers-quest-preview`
- `/event-card-preview` -> `_archived_routes/routes/event-card-preview`

## Notes

- API endpoints under `src/routes/api/*` were not changed (they are not sidebar “pages”).
- If you want these archived pages fully deleted instead of kept for reference, delete the corresponding folders under `_archived_routes/routes`.

## Other dead code (archived)

These feature modules had no imports anywhere in `src/` (besides their own files), so they were moved out of `src/lib/features`.

- `src/lib/features/events` -> `_archived_features/features/events`
- `src/lib/features/monsters` -> `_archived_features/features/monsters`
