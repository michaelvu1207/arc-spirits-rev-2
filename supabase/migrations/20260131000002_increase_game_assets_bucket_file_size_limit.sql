-- Increase Storage upload limit for game_assets to support larger location backgrounds.
-- Supabase Storage uses bytes; 20 MB = 20 * 1024 * 1024 = 20971520.

UPDATE storage.buckets
SET file_size_limit = 20971520
WHERE id = 'game_assets';

