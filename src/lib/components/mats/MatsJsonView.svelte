<script lang="ts">
	import type { MatItemRow, LookupService } from '$lib/types/gameData';
	import { SvelteSet } from 'svelte/reactivity';

	type Props = {
		mats: MatItemRow[];
		originLookup: LookupService;
		publicUrl: (path: string) => string;
	};

	let { mats, originLookup, publicUrl }: Props = $props();

	let expandedPaths = $state<SvelteSet<string>>(new SvelteSet(['root']));
	let searchQuery = $state('');
	let copySuccess = $state(false);

	// Transform mats to TTS export format
	const matsJson = $derived(
		mats.map((m) => {
			const origin_name = m.origin_id ? originLookup.getLabel(m.origin_id) : null;
			const icon_url = m.icon_path ? publicUrl(m.icon_path) : null;
			return {
				id: m.id,
				name: m.name,
				kind: m.kind,
				origin_id: m.origin_id,
				origin_name,
				icon_url
			};
		})
	);

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
		collectPaths(matsJson, 'root');
		expandedPaths = paths;
	}

	function collapseAll() {
		expandedPaths = new SvelteSet(['root']);
	}

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(JSON.stringify(matsJson, null, 2));
			copySuccess = true;
			setTimeout(() => (copySuccess = false), 2000);
		} catch (e) {
			console.error('Failed to copy', e);
		}
	}

	function downloadJson() {
		const blob = new Blob([JSON.stringify(matsJson, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `mats-tts-export-${new Date().toISOString().slice(0, 10)}.json`;
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
		if (typeof value === 'string')
			return value.length > 50 ? `"${value.slice(0, 50)}..."` : `"${value}"`;
		return String(value);
	}

	function matchesSearch(value: unknown, query: string): boolean {
		if (!query) return true;
		const lowerQuery = query.toLowerCase();
		if (typeof value === 'string') return value.toLowerCase().includes(lowerQuery);
		if (typeof value === 'number') return String(value).includes(query);
		if (value && typeof value === 'object') {
			return Object.entries(value).some(
				([k, v]) => k.toLowerCase().includes(lowerQuery) || matchesSearch(v, query)
			);
		}
		return false;
	}
</script>

<div class="json-view">
	<!-- Controls -->
	<div class="controls">
		<div class="search-box">
			<label for="search">Search:</label>
			<input
				id="search"
				type="text"
				bind:value={searchQuery}
				placeholder="Filter JSON..."
			/>
		</div>

		<div class="btn-group">
			<button class="btn" onclick={expandAll}>Expand All</button>
			<button class="btn" onclick={collapseAll}>Collapse All</button>
			<button class="btn btn-primary" onclick={copyToClipboard}>
				{#if copySuccess}
					<span class="success">✓ Copied!</span>
				{:else}
					📋 Copy
				{/if}
			</button>
			<button class="btn btn-success" onclick={downloadJson}>
				⬇️ Download
			</button>
		</div>
	</div>

	<!-- Stats -->
	<div class="stats">
		<div class="stat">
			<span class="stat-value">{matsJson.length}</span>
			<span class="stat-label">Total Mats</span>
		</div>
		<div class="stat">
			<span class="stat-value rune">{matsJson.filter((m) => m.kind === 'rune').length}</span>
			<span class="stat-label">Runes</span>
		</div>
		<div class="stat">
			<span class="stat-value relic">{matsJson.filter((m) => m.kind === 'relic').length}</span>
			<span class="stat-label">Relics</span>
		</div>
	</div>

	<!-- JSON Display -->
	<div class="json-container">
		{#snippet jsonNode(value: unknown, path: string, key: string | null, depth: number)}
			{@const type = getType(value)}
			{@const isExpanded = expandedPaths.has(path)}
			{@const isExpandable = type === 'object' || type === 'array'}
			{@const matches = matchesSearch(value, searchQuery)}

			{#if matches || !searchQuery}
				<div class="json-line" style="padding-left: {depth * 16}px">
					{#if isExpandable}
						<button class="toggle-btn" onclick={() => togglePath(path)}>
							{isExpanded ? '▼' : '▶'}
						</button>
					{:else}
						<span class="toggle-placeholder"></span>
					{/if}

					<span class="json-content">
						{#if key !== null}
							<span class="json-key">"{key}"</span>
							<span class="json-colon">: </span>
						{/if}

						{#if type === 'string'}
							<span class="json-string">"{value}"</span>
						{:else if type === 'number'}
							<span class="json-number">{value}</span>
						{:else if type === 'boolean'}
							<span class="json-boolean">{value}</span>
						{:else if type === 'null'}
							<span class="json-null">null</span>
						{:else if isExpandable && !isExpanded}
							<span class="json-preview">{getPreview(value)}</span>
						{:else if type === 'array'}
							<span class="json-bracket">[</span>
						{:else if type === 'object'}
							<span class="json-bracket">{'{'}</span>
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
					<div class="json-line" style="padding-left: {depth * 16 + 20}px">
						<span class="json-bracket">{type === 'array' ? ']' : '}'}</span>
					</div>
				{/if}
			{/if}
		{/snippet}

		{@render jsonNode(matsJson, 'root', null, 0)}
	</div>
</div>

<style>
	.json-view {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 8px;
		padding: 0.75rem;
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 200px;
		max-width: 300px;
	}

	.search-box label {
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.search-box input {
		flex: 1;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 4px;
		padding: 0.4rem 0.6rem;
		color: #f1f5f9;
		font-size: 0.7rem;
	}

	.search-box input::placeholder {
		color: #64748b;
	}

	.search-box input:focus {
		outline: none;
		border-color: rgba(99, 102, 241, 0.5);
	}

	.btn-group {
		display: flex;
		gap: 0.35rem;
	}

	.btn {
		padding: 0.4rem 0.6rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 4px;
		color: #e2e8f0;
		font-size: 0.65rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn:hover {
		background: rgba(51, 65, 85, 0.7);
		border-color: rgba(148, 163, 184, 0.3);
	}

	.btn-primary {
		background: rgba(99, 102, 241, 0.3);
		border-color: rgba(99, 102, 241, 0.4);
	}

	.btn-primary:hover {
		background: rgba(99, 102, 241, 0.45);
	}

	.btn-success {
		background: rgba(34, 197, 94, 0.3);
		border-color: rgba(34, 197, 94, 0.4);
	}

	.btn-success:hover {
		background: rgba(34, 197, 94, 0.45);
	}

	.success {
		color: #4ade80;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: 0.5rem;
	}

	.stat {
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		text-align: center;
	}

	.stat-value {
		display: block;
		font-size: 1.25rem;
		font-weight: 700;
		color: #f1f5f9;
	}

	.stat-value.rune {
		color: #a5b4fc;
	}

	.stat-value.relic {
		color: #fbbf24;
	}

	.stat-label {
		font-size: 0.6rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.json-container {
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 8px;
		padding: 0.75rem;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 0.7rem;
		overflow-x: auto;
		max-height: 600px;
		overflow-y: auto;
	}

	.json-line {
		display: flex;
		align-items: flex-start;
		line-height: 1.5;
	}

	.toggle-btn {
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: #64748b;
		cursor: pointer;
		font-size: 0.55rem;
		flex-shrink: 0;
		margin-right: 4px;
		padding: 0;
	}

	.toggle-btn:hover {
		color: #f1f5f9;
	}

	.toggle-placeholder {
		width: 16px;
		flex-shrink: 0;
		margin-right: 4px;
	}

	.json-content {
		flex: 1;
	}

	.json-key {
		color: #c084fc;
	}

	.json-colon {
		color: #64748b;
	}

	.json-string {
		color: #4ade80;
	}

	.json-number {
		color: #fbbf24;
	}

	.json-boolean {
		color: #60a5fa;
	}

	.json-null {
		color: #64748b;
	}

	.json-bracket {
		color: #64748b;
	}

	.json-preview {
		color: #94a3b8;
		font-style: italic;
	}
</style>
