<script lang="ts">
	import type { HexSpiritRow, OriginRow, ClassRow, MatItemRow } from '$lib/types/gameData';
	import { isAwakenOrRuneToken } from '$lib/utils/awakenRuneTokens';

	type TTSSpiritData = {
		name: string;
		cost: number;
		origin: string;
		class: string;
		origins: string[];
		classes: string[];
		runes: string[];
		image_url: string | null;
		back_image_url: string | null;
		combined_image_url: string | null;
		asset_source: 'primary' | 'variation' | 'variation_with_primary_fallback';
	};

	type TTSExportData = {
		spirits: TTSSpiritData[];
		metadata: {
			total: number;
			source: 'primary' | 'variation';
			variation_front_count: number;
			variation_back_count: number;
			variation_combined_count: number;
			primary_fallback_count: number;
			exported_at: string;
		};
	};

	type Spirit = HexSpiritRow & {
		game_print_image_url: string | null;
		back_side_export_url: string | null;
		tts_combined_image_url: string | null;
	};

	type TTSVariationCandidate = {
		frontUrl: string | null;
		backUrl: string | null;
		ttsCombinedUrl: string | null;
	};

	type Props = {
		spirits: Spirit[];
		origins: Pick<OriginRow, 'id' | 'name'>[];
		classes: Pick<ClassRow, 'id' | 'name'>[];
		runes: Pick<MatItemRow, 'id' | 'name'>[];
		variationBySpiritId?: Map<string, TTSVariationCandidate>;
		source?: 'primary' | 'variation';
	};

	let {
		spirits,
		origins,
		classes,
		runes,
		variationBySpiritId = new Map(),
		source = $bindable('primary')
	}: Props = $props();

	let showSuccessMessage = $state(false);

	const originLookup = $derived(
		new Map(origins.map((o) => [o.id, o.name]))
	);

	const classLookup = $derived(
		new Map(classes.map((c) => [c.id, c.name]))
	);

	const runeLookup = $derived(
		new Map(runes.map((r) => [r.id, r.name]))
	);

	const ttsData = $derived.by(() => {
		let variationFrontCount = 0;
		let variationBackCount = 0;
		let variationCombinedCount = 0;
		let primaryFallbackCount = 0;

		const spiritData: TTSSpiritData[] = spirits.map((spirit) => {
			const originNames = (spirit.traits?.origin_ids ?? [])
				.map((id) => originLookup.get(id) ?? 'Unknown')
				.filter((name) => name !== 'Unknown');

			const classNames = (spirit.traits?.class_ids ?? [])
				.map((id) => classLookup.get(id) ?? 'Unknown')
				.filter((name) => name !== 'Unknown');

			const runeNames = spirit.awaken_condition?.type === 'rune_cost'
				? (spirit.awaken_condition.rune_ids ?? []).map((token) => {
						if (typeof token === 'string') return runeLookup.get(token) ?? 'Unknown';
						if (isAwakenOrRuneToken(token)) {
							const names = (token.rune_ids ?? []).map((id) => runeLookup.get(id) ?? '?');
							return names.join('/');
						}
						return 'Unknown';
					}).filter((name) => name !== 'Unknown')
				: [];

			const primaryOrigin = originNames[0] ?? 'Unassigned';
			const primaryClass = classNames[0] ?? 'None';
			const variation = source === 'variation' ? variationBySpiritId.get(spirit.id) : null;
			const imageUrl = variation?.frontUrl ?? spirit.game_print_image_url ?? null;
			const backImageUrl = variation?.backUrl ?? spirit.back_side_export_url ?? null;
			const combinedImageUrl = variation?.ttsCombinedUrl ?? spirit.tts_combined_image_url ?? null;
			const usedVariation = Boolean(variation?.frontUrl || variation?.backUrl || variation?.ttsCombinedUrl);
			if (variation?.frontUrl) variationFrontCount += 1;
			if (variation?.backUrl) variationBackCount += 1;
			if (variation?.ttsCombinedUrl) variationCombinedCount += 1;
			if (source === 'variation' && !usedVariation) primaryFallbackCount += 1;

			return {
				name: spirit.name,
				cost: spirit.cost,
				origin: primaryOrigin,
				class: primaryClass,
				origins: originNames,
				classes: classNames,
				runes: runeNames,
				image_url: imageUrl,
				back_image_url: backImageUrl,
				combined_image_url: combinedImageUrl,
				asset_source:
					source === 'variation' && usedVariation
						? 'variation'
						: source === 'variation'
							? 'variation_with_primary_fallback'
							: 'primary'
			};
		});

		const exportData: TTSExportData = {
			spirits: spiritData,
			metadata: {
				total: spiritData.length,
				source,
				variation_front_count: variationFrontCount,
				variation_back_count: variationBackCount,
				variation_combined_count: variationCombinedCount,
				primary_fallback_count: primaryFallbackCount,
				exported_at: new Date().toISOString()
			}
		};

		return exportData;
	});

	const jsonString = $derived(JSON.stringify(ttsData, null, 2));

	const stats = $derived.by(() => {
		const total = spirits.length;
		const withImages = ttsData.spirits.filter((s) => s.image_url).length;
		const variationFront = ttsData.metadata.variation_front_count;
		const variationBack = ttsData.metadata.variation_back_count;
		const variationCombined = ttsData.metadata.variation_combined_count;
		const primaryFallback = ttsData.metadata.primary_fallback_count;
		const uniqueOrigins = new Set(
			spirits.flatMap((s) => s.traits?.origin_ids ?? [])
		).size;
		const uniqueClasses = new Set(
			spirits.flatMap((s) => s.traits?.class_ids ?? [])
		).size;

		return {
			total,
			withImages,
			variationFront,
			variationBack,
			variationCombined,
			primaryFallback,
			uniqueOrigins,
			uniqueClasses
		};
	});

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(jsonString);
			showSuccessMessage = true;
			setTimeout(() => {
				showSuccessMessage = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy to clipboard:', err);
			alert('Failed to copy to clipboard');
		}
	}

	function downloadJSON() {
		const blob = new Blob([jsonString], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'hex_spirits_tts.json';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
</script>

<div class="tts-view">
	<div class="tts-view__header">
		<div class="header-content">
			<h2>TTS Export</h2>
			<div class="source-toggle">
				<button
					type="button"
					class:active={source === 'primary'}
					onclick={() => (source = 'primary')}
				>
					Primary
				</button>
				<button
					type="button"
					class:active={source === 'variation'}
					onclick={() => (source = 'variation')}
				>
					Variation
				</button>
			</div>
			<div class="stats">
				<span>{stats.total} spirits</span>
				<span>{stats.withImages} images</span>
				<span>{stats.uniqueOrigins} origins</span>
				<span>{stats.uniqueClasses} classes</span>
				{#if source === 'variation'}
					<span>{stats.variationFront} variation fronts</span>
					<span>{stats.variationBack} variation backs</span>
					<span>{stats.variationCombined} variation TTS</span>
					<span>{stats.primaryFallback} primary fallback</span>
				{/if}
			</div>
		</div>
		<div class="actions">
			<button class="btn btn--primary" type="button" onclick={copyToClipboard}>
				Copy
			</button>
			<button class="btn btn--secondary" type="button" onclick={downloadJSON}>
				Download
			</button>
			{#if showSuccessMessage}
				<span class="success-message">Copied!</span>
			{/if}
		</div>
	</div>

	<div class="tts-view__code-block">
		<pre class="code-content"><code>{jsonString}</code></pre>
	</div>
</div>

<style>
	.tts-view {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		background: rgba(15, 23, 42, 0.4);
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.tts-view__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.tts-view__header h2 {
		margin: 0;
		color: #f8fafc;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.stats {
		display: flex;
		gap: 0.75rem;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.stats span {
		white-space: nowrap;
	}

	.source-toggle {
		display: inline-flex;
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 6px;
		overflow: hidden;
	}

	.source-toggle button {
		border: 0;
		background: rgba(15, 23, 42, 0.55);
		color: #cbd5e1;
		padding: 0.35rem 0.65rem;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.source-toggle button.active {
		background: rgba(99, 102, 241, 0.28);
		color: #f8fafc;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.success-message {
		color: #86efac;
		font-size: 0.75rem;
	}

	.tts-view__code-block {
		position: relative;
		flex: 1;
		min-height: 400px;
		max-height: calc(100vh - 200px);
		overflow: auto;
		background: rgba(15, 23, 42, 0.8);
		border-radius: 4px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		padding: 0.5rem;
	}

	.code-content {
		margin: 0;
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace;
		font-size: 0.75rem;
		line-height: 1.4;
		color: #e2e8f0;
		white-space: pre;
		overflow-x: auto;
		word-wrap: normal;
	}

	.code-content code {
		font-family: inherit;
		color: inherit;
	}

	.tts-view__code-block::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.tts-view__code-block::-webkit-scrollbar-track {
		background: rgba(15, 23, 42, 0.4);
	}

	.tts-view__code-block::-webkit-scrollbar-thumb {
		background: rgba(148, 163, 184, 0.3);
	}

	.tts-view__code-block::-webkit-scrollbar-thumb:hover {
		background: rgba(148, 163, 184, 0.5);
	}

	.btn {
		padding: 0.375rem 0.75rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
		border: 1px solid transparent;
		background: transparent;
		color: inherit;
	}

	.btn--primary {
		background: rgba(99, 102, 241, 0.2);
		border-color: rgba(99, 102, 241, 0.4);
		color: #a5b4fc;
	}

	.btn--primary:hover {
		background: rgba(99, 102, 241, 0.3);
		border-color: rgba(99, 102, 241, 0.6);
	}

	.btn--secondary {
		background: rgba(148, 163, 184, 0.15);
		border-color: rgba(148, 163, 184, 0.25);
		color: #cbd5e1;
	}

	.btn--secondary:hover {
		background: rgba(148, 163, 184, 0.25);
		border-color: rgba(148, 163, 184, 0.4);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
