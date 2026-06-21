<script lang="ts">
	import type { GameLocationRewardRow } from '$lib/types/gameData';
	import { getIconPoolUrl } from '$lib/utils/iconPool';
	import { isRewardOrIconToken, rewardIconTokensHaveAnyIcons } from '$lib/utils/rewardIconTokens';

	interface Props {
		row: GameLocationRewardRow;
		iconSize?: number;
	}

	let { row, iconSize = 32 }: Props = $props();

	const hasContent = $derived.by(() => {
		if (row.type === 'text') return row.text.trim().length > 0;
		if (row.type === 'trade') {
			return (
				rewardIconTokensHaveAnyIcons(row.cost_icon_ids) ||
				rewardIconTokensHaveAnyIcons(row.gain_icon_ids)
			);
		}
		return rewardIconTokensHaveAnyIcons(row.gain_icon_ids);
	});
</script>

<div
	class="reward-row-preview"
	style={`--reward-icon-size:${iconSize}px;--reward-icon-gap:${Math.round(iconSize * 0.3)}px;`}
>
	{#if hasContent}
		<div
			class="reward-row-preview__row"
			class:is-trade={row.type === 'trade'}
			class:is-text={row.type === 'text'}
		>
			{#if row.type === 'trade'}
				<div class="reward-row-preview__icons">
					{#each row.cost_icon_ids as token, i (i)}
						<div class="reward-row-preview__icon">
							{#if typeof token === 'string'}
								{@const url = getIconPoolUrl(token)}
								{#if url}
									<img src={url} alt="Cost icon" draggable="false" />
								{/if}
							{:else if isRewardOrIconToken(token)}
								{#each token.icon_ids as iconId, j (j)}
									{@const url = getIconPoolUrl(iconId)}
									{#if url}
										<img src={url} alt="OR icon" draggable="false" />
									{/if}
									{#if j < token.icon_ids.length - 1}
										<span class="reward-row-preview__or-slash">/</span>
									{/if}
								{/each}
							{/if}
						</div>
					{/each}
				</div>
				<span class="reward-row-preview__arrow">&rarr;</span>
				<div class="reward-row-preview__icons">
					{#each row.gain_icon_ids as token, i (i)}
						<div class="reward-row-preview__icon">
							{#if typeof token === 'string'}
								{@const url = getIconPoolUrl(token)}
								{#if url}
									<img src={url} alt="Gain icon" draggable="false" />
								{/if}
							{:else if isRewardOrIconToken(token)}
								{#each token.icon_ids as iconId, j (j)}
									{@const url = getIconPoolUrl(iconId)}
									{#if url}
										<img src={url} alt="OR icon" draggable="false" />
									{/if}
									{#if j < token.icon_ids.length - 1}
										<span class="reward-row-preview__or-slash">/</span>
									{/if}
								{/each}
							{/if}
						</div>
					{/each}
				</div>
			{:else if row.type === 'gain'}
				<div class="reward-row-preview__icons">
					{#each row.gain_icon_ids as token, i (i)}
						<div class="reward-row-preview__icon">
							{#if typeof token === 'string'}
								{@const url = getIconPoolUrl(token)}
								{#if url}
									<img src={url} alt="Reward icon" draggable="false" />
								{/if}
							{:else if isRewardOrIconToken(token)}
								{#each token.icon_ids as iconId, j (j)}
									{@const url = getIconPoolUrl(iconId)}
									{#if url}
										<img src={url} alt="OR icon" draggable="false" />
									{/if}
									{#if j < token.icon_ids.length - 1}
										<span class="reward-row-preview__or-slash">/</span>
									{/if}
								{/each}
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div class="reward-row-preview__text">{row.text}</div>
			{/if}
		</div>
	{:else}
		<div class="reward-row-preview__fallback">No reward content</div>
	{/if}
</div>

<style>
	.reward-row-preview {
		display: flex;
		flex-direction: column;
		filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.55));
		align-items: flex-start;
	}

	.reward-row-preview__fallback {
		padding: 0.5rem 0.6rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.75);
		color: #e2e8f0;
		font-size: 0.85rem;
		font-weight: 700;
		pointer-events: none;
	}

	.reward-row-preview__row {
		display: flex;
		align-items: center;
		gap: var(--reward-icon-gap);
		min-width: 0;
		padding: 0.35rem 0.45rem;
		border-radius: 12px;
		position: relative;
		background: rgba(56, 35, 20, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.5);
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.4);
	}

	.reward-row-preview__row > * {
		filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.55));
	}

	.reward-row-preview__icons {
		display: flex;
		align-items: center;
		gap: var(--reward-icon-gap);
		min-width: 0;
		flex-wrap: nowrap;
	}

	.reward-row-preview__icon {
		display: flex;
		align-items: center;
		gap: var(--reward-icon-gap);
	}

	.reward-row-preview__icon img {
		height: var(--reward-icon-size);
		width: auto;
		max-width: calc(var(--reward-icon-size) * 1.8);
		display: block;
		pointer-events: none;
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.55));
	}

	.reward-row-preview__arrow {
		font-size: calc(var(--reward-icon-size) * 0.7);
		font-weight: 800;
		color: rgba(226, 232, 240, 0.9);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
		pointer-events: none;
	}

	.reward-row-preview__or-slash {
		font-size: calc(var(--reward-icon-size) * 0.65);
		font-weight: 900;
		color: rgba(226, 232, 240, 0.9);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
		pointer-events: none;
	}

	.reward-row-preview__text {
		font-size: inherit;
		color: inherit;
		line-height: inherit;
		overflow: hidden;
		white-space: normal;
		overflow-wrap: anywhere;
		display: block;
		min-width: 0;
	}

	.reward-row-preview__row.is-text {
		display: block;
		box-sizing: border-box;
		overflow: hidden;
		font-size: 0.72rem;
		color: rgba(226, 232, 240, 0.85);
		line-height: 1.05;
		text-align: left;
		max-width: 420px;
	}
</style>
