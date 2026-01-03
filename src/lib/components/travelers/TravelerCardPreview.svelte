<script lang="ts">
	import type { TravelerRow } from '$lib/types/gameData';
	import { getIconPoolUrl } from '$lib/utils/iconPool';

	type Traveler = TravelerRow & {
		icon_url?: string | null;
		traveler_subtext?: string | null;
		traveler_description?: string | null;
		art_url?: string | null;
	};

	let { monster }: { monster: Traveler } = $props();

	const displayName = $derived.by(() => monster.name || 'Traveler');
	const displaySubtext = $derived.by(() => {
		const value = monster.traveler_subtext ?? '';
		return value.trim() || 'Subtext';
	});
	const displayDescription = $derived.by(() => {
		const value = monster.traveler_description ?? '';
		return value.trim() || 'Description';
	});
	const artUrl = $derived.by(() => monster.art_url ?? null);

	function normalizeGroups(groups: string[][] | null | undefined, fallback?: string[] | null): string[][] {
		if (Array.isArray(groups) && groups.length > 0) {
			return groups.map((group) => (Array.isArray(group) ? group : []));
		}
		if (Array.isArray(fallback) && fallback.length > 0) {
			return [fallback];
		}
		return [];
	}

	const tradeRows = $derived.by(() => {
		const fromRows = Array.isArray(monster.trade_rows) ? monster.trade_rows : [];
		const fallbackLeft = Array.isArray(monster.trade_left_icon_ids) ? monster.trade_left_icon_ids : [];
		const fallbackRight = Array.isArray(monster.trade_right_icon_ids) ? monster.trade_right_icon_ids : [];
		const rows = fromRows.length > 0 ? fromRows : fallbackLeft.length > 0 || fallbackRight.length > 0
			? [{ left_icon_ids: fallbackLeft, right_icon_ids: fallbackRight }]
			: [];

		return rows
			.map((row) => {
				const leftGroups = normalizeGroups(row.left_icon_groups, row.left_icon_ids);
				const rightGroups = normalizeGroups(row.right_icon_groups, row.right_icon_ids);
				const leftUrls = leftGroups
					.map((group) => group.map((id) => getIconPoolUrl(id)).filter((url): url is string => !!url))
					.filter((group) => group.length > 0);
				const rightUrls = rightGroups
					.map((group) => group.map((id) => getIconPoolUrl(id)).filter((url): url is string => !!url))
					.filter((group) => group.length > 0);

				if (leftUrls.length === 0 && rightUrls.length === 0) return null;

				return { leftGroups: leftUrls, rightGroups: rightUrls };
			})
			.filter((row): row is { leftGroups: string[][]; rightGroups: string[][] } => row !== null);
	});

	const gainRows = $derived.by(() => {
		const fromRows = Array.isArray(monster.gain_rows) ? monster.gain_rows : [];

		return fromRows
			.map((row) => {
				const groups = normalizeGroups(row.icon_groups, row.icon_ids);
				const urls = groups
					.map((group) => group.map((id) => getIconPoolUrl(id)).filter((url): url is string => !!url))
					.filter((group) => group.length > 0);
				return urls.length > 0 ? urls : null;
			})
			.filter((row): row is string[][] => row !== null);
	});
</script>

<div class="card v1-scroll">
	<div class="v1-flourish v1-flourish--tl"></div>
	<div class="v1-flourish v1-flourish--tr"></div>
	<div class="v1-flourish v1-flourish--bl"></div>
	<div class="v1-flourish v1-flourish--br"></div>

	<div class="v1-art-panel">
		{#if artUrl}
			<img src={artUrl} alt={displayName} class="v1-art" />
		{:else}
			<div class="v1-art-placeholder">✦</div>
		{/if}
		<div class="v1-art-vignette"></div>
	</div>

	<div class="v1-content">
		<div class="v1-header">
			<h2 class="v1-name">{displayName}</h2>
			<p class="v1-subtext">{displaySubtext}</p>
			<div class="v1-divider"></div>
		</div>

		<div class="v1-description">{displayDescription}</div>

		{#if gainRows.length > 0}
			<div class="v1-gain-label">Gain:</div>
			<div class="v1-gain-rows">
				{#each gainRows as groups, index (`gain-${index}`)}
					<div class="v1-gain">
						<div class="v1-gain-icons">
							{#each groups as group, groupIndex (`gain-group-${groupIndex}`)}
								<div class="v1-icon-group">
									{#each group.slice(0, 6) as iconUrl}
										<img src={iconUrl} alt="" class="v1-trade-icon" />
									{/each}
								</div>
								{#if groupIndex < groups.length - 1}
									<span class="v1-or">/</span>
								{/if}
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if tradeRows.length > 0}
			<div class="v1-trade-label">Trade:</div>
			<div class="v1-trade-rows">
				{#each tradeRows as row, index (`row-${index}`)}
					<div class="v1-trade">
						<div class="v1-trade-icons">
							{#each row.leftGroups as group, groupIndex (`left-${groupIndex}`)}
								<div class="v1-icon-group">
									{#each group.slice(0, 5) as iconUrl}
										<img src={iconUrl} alt="" class="v1-trade-icon" />
									{/each}
								</div>
								{#if groupIndex < row.leftGroups.length - 1}
									<span class="v1-or">/</span>
								{/if}
							{/each}
						</div>
						<div class="v1-trade-arrow">-&gt;</div>
						<div class="v1-trade-icons">
							{#each row.rightGroups as group, groupIndex (`right-${groupIndex}`)}
								<div class="v1-icon-group">
									{#each group.slice(0, 5) as iconUrl}
										<img src={iconUrl} alt="" class="v1-trade-icon" />
									{/each}
								</div>
								{#if groupIndex < row.rightGroups.length - 1}
									<span class="v1-or">/</span>
								{/if}
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.card {
		width: 600px;
		height: 437px;
		position: relative;
		border-radius: 16px;
		overflow: hidden;
		color: #f8fafc;
	}

	.v1-scroll {
		background:
			radial-gradient(ellipse at 30% 20%, rgba(212, 180, 131, 0.15) 0%, transparent 50%),
			linear-gradient(135deg, #2a2318 0%, #1a1610 50%, #0f0d0a 100%);
		border: 3px solid #8b7355;
		box-shadow:
			0 0 0 1px rgba(139, 115, 85, 0.3) inset,
			0 20px 40px rgba(0, 0, 0, 0.5);
		display: grid;
		grid-template-columns: 40% 60%;
		font-family: "Crimson Text", "Palatino Linotype", "Book Antiqua", serif;
	}

	.v1-flourish {
		position: absolute;
		width: 50px;
		height: 50px;
		opacity: 0.6;
		z-index: 10;
		pointer-events: none;
	}
	.v1-flourish::before,
	.v1-flourish::after {
		content: "";
		position: absolute;
		background: linear-gradient(45deg, #c9a86c, #8b7355);
	}
	.v1-flourish::before {
		width: 30px;
		height: 2px;
	}
	.v1-flourish::after {
		width: 2px;
		height: 30px;
	}
	.v1-flourish--tl { top: 12px; left: 12px; }
	.v1-flourish--tl::before { top: 0; left: 0; }
	.v1-flourish--tl::after { top: 0; left: 0; }
	.v1-flourish--tr { top: 12px; right: 12px; transform: scaleX(-1); }
	.v1-flourish--tr::before { top: 0; left: 0; }
	.v1-flourish--tr::after { top: 0; left: 0; }
	.v1-flourish--bl { bottom: 12px; left: 12px; transform: scaleY(-1); }
	.v1-flourish--bl::before { top: 0; left: 0; }
	.v1-flourish--bl::after { top: 0; left: 0; }
	.v1-flourish--br { bottom: 12px; right: 12px; transform: scale(-1); }
	.v1-flourish--br::before { top: 0; left: 0; }
	.v1-flourish--br::after { top: 0; left: 0; }

	.v1-art-panel {
		position: relative;
		background: #0a0908;
		border-right: 3px solid #6b5a47;
		overflow: hidden;
	}
	.v1-art {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: sepia(20%) saturate(0.9);
	}
	.v1-art-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		font-size: 4rem;
		color: rgba(201, 168, 108, 0.3);
	}
	.v1-art-vignette {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(to right, transparent 60%, rgba(26, 22, 16, 0.8)),
			linear-gradient(to bottom, rgba(26, 22, 16, 0.4), transparent 20%, transparent 80%, rgba(26, 22, 16, 0.4));
		pointer-events: none;
	}

	.v1-content {
		display: flex;
		flex-direction: column;
		padding: 28px 24px;
		gap: 16px;
	}

	.v1-header {
		text-align: right;
	}
	.v1-name {
		margin: 0;
		font-size: 1.7rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: #e8d5b5;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
	}
	.v1-subtext {
		margin: 6px 0 0;
		font-size: 0.75rem;
		font-style: italic;
		color: rgba(201, 168, 108, 0.8);
		letter-spacing: 0.03em;
	}
	.v1-divider {
		margin-top: 12px;
		height: 1px;
		background: linear-gradient(to left, #8b7355, transparent);
	}

	.v1-description {
		padding: 10px 12px;
		min-height: 64px;
		border-radius: 10px;
		background: rgba(20, 16, 12, 0.88);
		border: 1px solid rgba(139, 115, 85, 0.6);
		font-size: 0.8rem;
		line-height: 1.4;
		color: rgba(232, 213, 181, 0.9);
		text-align: left;
	}

	.v1-trade-label {
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(201, 168, 108, 0.75);
		text-align: left;
	}

	.v1-gain-label {
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(201, 168, 108, 0.75);
		text-align: left;
	}

	.v1-gain-rows {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.v1-gain {
		background: rgba(26, 22, 16, 0.72);
		border: 1px solid rgba(139, 115, 85, 0.45);
		border-radius: 10px;
		padding: 12px;
	}

	.v1-gain-icons {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		justify-content: center;
		min-height: 30px;
	}

	.v1-icon-group {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		align-items: center;
	}

	.v1-or {
		font-size: 1rem;
		font-weight: 700;
		color: rgba(201, 168, 108, 0.75);
	}

	.v1-trade-rows {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.v1-trade {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 12px;
		background: rgba(26, 22, 16, 0.8);
		border: 1px solid rgba(139, 115, 85, 0.5);
		border-radius: 10px;
		padding: 14px;
	}

	.v1-trade-icons {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		justify-content: center;
		min-height: 30px;
	}

	.v1-trade-icon {
		width: 42px;
		height: 42px;
		object-fit: contain;
		filter:
			drop-shadow(1px 0 0 #2b1a12)
			drop-shadow(-1px 0 0 #2b1a12)
			drop-shadow(0 1px 0 #2b1a12)
			drop-shadow(0 -1px 0 #2b1a12)
			drop-shadow(1px 1px 0 #2b1a12)
			drop-shadow(-1px 1px 0 #2b1a12)
			drop-shadow(1px -1px 0 #2b1a12)
			drop-shadow(-1px -1px 0 #2b1a12)
			drop-shadow(2px 0 0 #2b1a12)
			drop-shadow(-2px 0 0 #2b1a12)
			drop-shadow(0 2px 0 #2b1a12)
			drop-shadow(0 -2px 0 #2b1a12);
	}

	.v1-trade-arrow {
		font-size: 1.25rem;
		font-weight: 700;
		color: #e8d5b5;
	}
</style>
