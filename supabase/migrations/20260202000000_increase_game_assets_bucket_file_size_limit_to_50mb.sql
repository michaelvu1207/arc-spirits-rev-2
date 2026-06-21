-- Increase Storage upload limit for game_assets to support large Spirit World exports.
-- Supabase Storage uses bytes; 50 MB = 50 * 1024 * 1024 = 52428800.

UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'game_assets';

