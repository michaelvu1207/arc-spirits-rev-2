import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

const VALID_VIEWS = new Set(['cards', 'grid', 'prints']);

export const load: PageLoad = ({ params, url }) => {
	const view = params.viewMode;
	if (!VALID_VIEWS.has(view)) {
		throw redirect(307, '/hex-spirits/cards');
	}

	return {
		viewMode: view as 'cards' | 'grid' | 'prints',
		initialSearch: url.search
	};
};
