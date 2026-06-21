import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';

const env = {
	url:
		publicEnv.PUBLIC_SUPABASE_URL ??
		(typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : undefined) ??
		process.env.VITE_SUPABASE_URL,
	anonKey:
		publicEnv.PUBLIC_SUPABASE_ANON_KEY ??
		(typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_ANON_KEY : undefined) ??
		process.env.VITE_SUPABASE_ANON_KEY
};

if (!env.url) {
	throw new Error('Missing Supabase URL. Set PUBLIC_SUPABASE_URL in your environment.');
}

if (!env.anonKey) {
	throw new Error('Missing Supabase anon key. Set PUBLIC_SUPABASE_ANON_KEY in your environment.');
}

export type Rev2Client = SupabaseClient<any, any, 'arc_spirits_assets'>;

export const supabase: Rev2Client = createClient(env.url, env.anonKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true
	},
	db: {
		schema: 'arc_spirits_assets'
	}
});

export type { SupabaseClient };
