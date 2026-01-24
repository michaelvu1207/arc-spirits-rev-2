<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { env as publicEnv } from '$env/dynamic/public';

	let jsonData = $state<unknown>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	type EditionOption = { id: string; name: string; is_default?: boolean };
	type ScenarioOption = { id: string; name: string; order_num?: number };

	const ABYSS_SCENARIO_STORAGE_KEY = 'arc-spirits-rev2:selected_abyss_scenario_id_by_edition';

	let editions = $state<EditionOption[]>([]);
	let selectedEditionId = $state<string>('');

	let scenarios = $state<ScenarioOption[]>([]);
	let selectedScenarioId = $state<string>('');
	type ExportLanguage = 'base' | string;
	const BASE_LANGUAGE: ExportLanguage = 'base';
	const DEFAULT_LANGS: ExportLanguage[] = [
		BASE_LANGUAGE,
		'zh-hans',
		'zh-hant',
		'de',
		'fr',
		'es',
		'it',
		'ja',
		'pl',
		'ko'
	];
	let selectedLanguage = $state<ExportLanguage>(BASE_LANGUAGE);
	let expandedPaths = $state<SvelteSet<string>>(new SvelteSet());
	let searchQuery = $state('');
	let copySuccess = $state(false);

	const EDGE_FUNCTION_URL = 'https://gvxfokbptelmvvlxbigh.supabase.co/functions/v1/export-all-tts-json';

	const selectedEditionName = $derived(editions.find((e) => e.id === selectedEditionId)?.name ?? 'Base');
	const selectedScenarioName = $derived(scenarios.find((s) => s.id === selectedScenarioId)?.name ?? '');

	onMount(async () => {
		await loadEditions();
		await loadScenarios();
		await fetchJson();
	});

	async function loadEditions() {
		try {
			const { supabase } = await import('$lib/api/supabaseClient');
			const { data } = await supabase.from('editions').select('id, name, is_default').order('name');
			if (data) {
				editions = data as EditionOption[];
				const existing = editions.find((e) => e.id === selectedEditionId);
				if (!existing) {
					const base = editions.find((e) => e.name === 'Base');
					const fallback = editions.find((e) => e.is_default) ?? base ?? editions[0];
					selectedEditionId = fallback?.id ?? '';
				}
			}
		} catch (e) {
			console.warn('Failed to load editions', e);
		}
	}

	function getStoredScenarioId(editionId: string): string | null {
		if (!editionId) return null;
		try {
			const raw = localStorage.getItem(ABYSS_SCENARIO_STORAGE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
			const v = (parsed as Record<string, unknown>)[editionId];
			return typeof v === 'string' ? v : null;
		} catch {
			return null;
		}
	}

	function setStoredScenarioId(editionId: string, scenarioId: string | null) {
		if (!editionId) return;
		try {
			const raw = localStorage.getItem(ABYSS_SCENARIO_STORAGE_KEY);
			let parsed: Record<string, unknown> = {};
			if (raw) {
				const next = JSON.parse(raw);
				if (next && typeof next === 'object' && !Array.isArray(next)) parsed = next as Record<string, unknown>;
			}

			if (scenarioId) parsed[editionId] = scenarioId;
			else delete parsed[editionId];

			localStorage.setItem(ABYSS_SCENARIO_STORAGE_KEY, JSON.stringify(parsed));
		} catch {
			// ignore
		}
	}

	async function loadScenarios() {
		if (!selectedEditionId) {
			scenarios = [];
			selectedScenarioId = '';
			return;
		}
		try {
			const { supabase } = await import('$lib/api/supabaseClient');
			const { data } = await supabase
				.from('abyss_scenarios')
				.select('id, name, order_num')
				.eq('edition_id', selectedEditionId)
				.order('order_num')
				.order('name');
			scenarios = (data ?? []) as ScenarioOption[];

			const stillValid = selectedScenarioId && scenarios.some((s) => s.id === selectedScenarioId);
			if (stillValid) return;

			const stored = getStoredScenarioId(selectedEditionId);
			const storedValid = stored && scenarios.some((s) => s.id === stored);
			const defaultId = scenarios.find((s) => (s.order_num ?? 0) === 0)?.id ?? scenarios[0]?.id ?? '';
			const next = storedValid ? (stored as string) : defaultId;
			selectedScenarioId = next;
			if (next) setStoredScenarioId(selectedEditionId, next);
		} catch (e) {
			console.warn('Failed to load scenarios', e);
			scenarios = [];
			selectedScenarioId = '';
		}
	}

	async function handleEditionChange() {
		await loadScenarios();
		await fetchJson();
	}

	async function handleScenarioChange() {
		await fetchJson();
	}

	async function fetchJson() {
			loading = true;
			error = null;
			try {
				const anonKey = publicEnv.PUBLIC_SUPABASE_ANON_KEY;
				if (!anonKey) throw new Error('Missing PUBLIC_SUPABASE_ANON_KEY.');

				const langParam = selectedLanguage === BASE_LANGUAGE ? '' : `&lang=${encodeURIComponent(String(selectedLanguage))}`;
				const scenarioParam = selectedScenarioId ? `&scenario_id=${encodeURIComponent(selectedScenarioId)}` : '';
				const url = `${EDGE_FUNCTION_URL}?edition=${encodeURIComponent(selectedEditionName)}${scenarioParam}${langParam}`;
				const response = await fetch(url, {
					headers: {
						Authorization: `Bearer ${anonKey}`,
						apikey: anonKey
					}
				});
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${await response.text()}`);
				}
			jsonData = await response.json();
			// Auto-expand top level
			expandedPaths = new SvelteSet(['root']);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			jsonData = null;
		} finally {
			loading = false;
		}
	}

	function togglePath(path: string) {
		if (expandedPaths.has(path)) {
			expandedPaths.delete(path);
		} else {
			expandedPaths.add(path);
		}
	}

	function expandAll() {
		const paths = new SvelteSet<string>();
		function collectPaths(obj: unknown, path: string) {
			paths.add(path);
			if (obj && typeof obj === 'object') {
				if (Array.isArray(obj)) {
					obj.forEach((item, i) => collectPaths(item, `${path}[${i}]`));
				} else {
					Object.entries(obj).forEach(([key, value]) => collectPaths(value, `${path}.${key}`));
				}
			}
		}
		collectPaths(jsonData, 'root');
		expandedPaths = paths;
	}

	function collapseAll() {
		expandedPaths = new SvelteSet(['root']);
	}

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
			copySuccess = true;
			setTimeout(() => copySuccess = false, 2000);
		} catch (e) {
			console.error('Failed to copy', e);
		}
	}

	function downloadJson() {
		const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const langSuffix = selectedLanguage === BASE_LANGUAGE ? 'base' : String(selectedLanguage);
		const editionSlug = selectedEditionName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
		const scenarioSlug = selectedScenarioName
			? `-${selectedScenarioName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`
			: '';
		a.download = `tts-export-${editionSlug}${scenarioSlug}-${langSuffix}-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function getType(value: unknown): string {
		if (value === null) return 'null';
		if (Array.isArray(value)) return 'array';
		return typeof value;
	}

	function getPreview(value: unknown): string {
		if (value === null) return 'null';
		if (Array.isArray(value)) return `Array(${value.length})`;
		if (typeof value === 'object') return `Object(${Object.keys(value).length})`;
		if (typeof value === 'string') return value.length > 50 ? `"${value.slice(0, 50)}..."` : `"${value}"`;
		return String(value);
	}

	function matchesSearch(value: unknown, query: string): boolean {
		if (!query) return true;
		const lowerQuery = query.toLowerCase();
		if (typeof value === 'string') return value.toLowerCase().includes(lowerQuery);
		if (typeof value === 'number') return String(value).includes(query);
		if (value && typeof value === 'object') {
			return Object.entries(value).some(([k, v]) =>
				k.toLowerCase().includes(lowerQuery) || matchesSearch(v, query)
			);
		}
		return false;
	}
</script>

<svelte:head>
	<title>JSON Viewer - Arc Spirits</title>
</svelte:head>

<div class="min-h-screen bg-gray-900 text-gray-100 p-6">
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<div class="mb-6">
			<h1 class="text-3xl font-bold text-white mb-2">TTS Export JSON Viewer</h1>
			<p class="text-gray-400">View and explore the Tabletop Simulator export data</p>
		</div>

		<!-- Controls -->
			<div class="bg-gray-800 rounded-lg p-4 mb-6 flex flex-wrap gap-4 items-center">
				<div class="flex items-center gap-2">
					<label for="edition" class="text-sm text-gray-400">Edition:</label>
					<select
					id="edition"
					bind:value={selectedEditionId}
					onchange={handleEditionChange}
					class="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				>
					{#each editions as edition (edition.id)}
						<option value={edition.id}>{edition.name}</option>
					{/each}
					</select>
				</div>

				<div class="flex items-center gap-2">
					<label for="scenario" class="text-sm text-gray-400">Scenario:</label>
					<select
						id="scenario"
						bind:value={selectedScenarioId}
						onchange={handleScenarioChange}
						disabled={!selectedEditionId || scenarios.length === 0}
						class="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
					>
						{#each scenarios as scenario (scenario.id)}
							<option value={scenario.id}>{scenario.name}</option>
						{/each}
					</select>
				</div>

				<div class="flex items-center gap-2">
					<label for="lang" class="text-sm text-gray-400">Language:</label>
					<select
						id="lang"
						bind:value={selectedLanguage}
						onchange={fetchJson}
						class="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					>
						{#each DEFAULT_LANGS as lang (lang)}
							<option value={lang}>{lang === BASE_LANGUAGE ? 'base (Default)' : lang}</option>
						{/each}
					</select>
				</div>

				<div class="flex items-center gap-2 flex-1 max-w-md">
					<label for="search" class="text-sm text-gray-400">Search:</label>
					<input
					id="search"
					type="text"
					bind:value={searchQuery}
					placeholder="Filter JSON..."
					class="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
			</div>

			<div class="flex gap-2">
				<button
					onclick={expandAll}
					class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
				>
					Expand All
				</button>
				<button
					onclick={collapseAll}
					class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
				>
					Collapse All
				</button>
				<button
					onclick={copyToClipboard}
					class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm transition-colors flex items-center gap-1"
				>
					{#if copySuccess}
						<span class="text-green-300">✓ Copied!</span>
					{:else}
						📋 Copy
					{/if}
				</button>
				<button
					onclick={downloadJson}
					class="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm transition-colors"
				>
					⬇️ Download
				</button>
				<button
					onclick={fetchJson}
					class="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm transition-colors"
				>
					🔄 Refresh
				</button>
			</div>
		</div>

		<!-- JSON Display -->
		<div class="bg-gray-800 rounded-lg overflow-hidden">
			{#if loading}
				<div class="p-8 text-center">
					<div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
					<p class="mt-4 text-gray-400">Loading JSON data...</p>
				</div>
			{:else if error}
				<div class="p-8 text-center">
					<div class="text-red-400 text-xl mb-2">⚠️ Error</div>
					<p class="text-red-300">{error}</p>
					<button
						onclick={fetchJson}
						class="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 rounded transition-colors"
					>
						Retry
					</button>
				</div>
			{:else if jsonData}
				<div class="p-4 font-mono text-sm overflow-x-auto">
					{#snippet jsonNode(value: unknown, path: string, key: string | null, depth: number)}
						{@const type = getType(value)}
						{@const isExpanded = expandedPaths.has(path)}
						{@const isExpandable = type === 'object' || type === 'array'}
						{@const matches = matchesSearch(value, searchQuery)}

						{#if matches || !searchQuery}
							<div class="flex items-start" style="padding-left: {depth * 20}px">
								{#if isExpandable}
									<button
										onclick={() => togglePath(path)}
										class="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white transition-colors flex-shrink-0 mr-1"
									>
										{isExpanded ? '▼' : '▶'}
									</button>
								{:else}
									<span class="w-5 h-5 flex-shrink-0 mr-1"></span>
								{/if}

								<span class="flex-1">
									{#if key !== null}
										<span class="text-purple-400">"{key}"</span>
										<span class="text-gray-500">: </span>
									{/if}

									{#if type === 'string'}
										<span class="text-green-400">"{value}"</span>
									{:else if type === 'number'}
										<span class="text-yellow-400">{value}</span>
									{:else if type === 'boolean'}
										<span class="text-blue-400">{value}</span>
									{:else if type === 'null'}
										<span class="text-gray-500">null</span>
									{:else if isExpandable && !isExpanded}
										<span class="text-gray-400">{getPreview(value)}</span>
									{:else if type === 'array'}
										<span class="text-gray-500">[</span>
									{:else if type === 'object'}
										<span class="text-gray-500">{'{'}</span>
									{/if}
								</span>
							</div>

							{#if isExpandable && isExpanded}
								{#if type === 'array' && Array.isArray(value)}
									{#each value as item, i (i)}
										{@render jsonNode(item, `${path}[${i}]`, String(i), depth + 1)}
									{/each}
								{:else if type === 'object' && value && typeof value === 'object'}
									{#each Object.entries(value as Record<string, unknown>) as [k, v] (k)}
										{@render jsonNode(v, `${path}.${k}`, k, depth + 1)}
									{/each}
								{/if}
								<div style="padding-left: {depth * 20 + 24}px">
									<span class="text-gray-500">{type === 'array' ? ']' : '}'}</span>
								</div>
							{/if}
						{/if}
					{/snippet}

					{@render jsonNode(jsonData, 'root', null, 0)}
				</div>
			{/if}
		</div>

		<!-- Stats -->
		{#if jsonData && typeof jsonData === 'object' && jsonData !== null}
			{@const data = jsonData as Record<string, unknown>}
			<div class="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
				{#if 'origins' in data && Array.isArray(data.origins)}
					<div class="bg-gray-800 rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-violet-400">{data.origins.length}</div>
						<div class="text-sm text-gray-400">Origins</div>
					</div>
				{/if}
				{#if 'classes' in data && Array.isArray(data.classes)}
					<div class="bg-gray-800 rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-indigo-400">{data.classes.length}</div>
						<div class="text-sm text-gray-400">Classes</div>
					</div>
				{/if}
				{#if 'hex_spirits' in data && Array.isArray(data.hex_spirits)}
					<div class="bg-gray-800 rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-blue-400">{data.hex_spirits.length}</div>
						<div class="text-sm text-gray-400">Hex Spirits</div>
					</div>
				{/if}
				{#if 'artifacts' in data && Array.isArray(data.artifacts)}
					<div class="bg-gray-800 rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-purple-400">{data.artifacts.length}</div>
						<div class="text-sm text-gray-400">Artifacts</div>
					</div>
				{/if}
				{#if 'monsters' in data && Array.isArray(data.monsters)}
					<div class="bg-gray-800 rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-red-400">{data.monsters.length}</div>
						<div class="text-sm text-gray-400">Monsters</div>
					</div>
				{/if}
				{#if 'guardians' in data && Array.isArray(data.guardians)}
					<div class="bg-gray-800 rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-yellow-400">{data.guardians.length}</div>
						<div class="text-sm text-gray-400">Guardians</div>
					</div>
				{/if}
				{#if 'runes' in data && Array.isArray(data.runes)}
					<div class="bg-gray-800 rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-green-400">{data.runes.length}</div>
						<div class="text-sm text-gray-400">Runes</div>
					</div>
				{/if}
				{#if 'custom_dice' in data && Array.isArray(data.custom_dice)}
					<div class="bg-gray-800 rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-orange-400">{data.custom_dice.length}</div>
						<div class="text-sm text-gray-400">Custom Dice</div>
					</div>
				{/if}
				{#if 'boards' in data && Array.isArray(data.boards)}
					<div class="bg-gray-800 rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-cyan-400">{data.boards.length}</div>
						<div class="text-sm text-gray-400">Boards</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
