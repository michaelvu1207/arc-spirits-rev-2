	<script lang="ts">
		import { onMount } from 'svelte';
		import type { GameLocationRewardRow } from '$lib/types/gameData';
		import { loadLocationIconPlacementConfig } from '$lib/generators/locations/locationIconPlacer';
		import { loadIconPool, getIconPoolUrl } from '$lib/utils/iconPool';
		import { IconPicker } from '$lib/components/shared';
		import { Button, Select, Textarea } from '$lib/components/ui';

	interface Props {
		rewardRows?: GameLocationRewardRow[];
		onchange?: (rows: GameLocationRewardRow[]) => void;
		maxIconsPerList?: number;
	}

	let {
		rewardRows = $bindable<GameLocationRewardRow[]>([]),
		onchange,
		maxIconsPerList = 5
	}: Props = $props();

	const MAX_REWARD_ROWS = 3;

	let iconPoolLoaded = $state(false);
	let picking = $state<{ rowIndex: number; list: 'gain' | 'cost' } | null>(null);
	let slotLimits = $state({ gain: 4, trade_cost: 3, trade_gain: 3 });

	function refreshSlotLimits() {
		const cfg = loadLocationIconPlacementConfig();
		const tpl = cfg.rows?.[0];
		slotLimits = {
			gain: Math.max(0, tpl?.gain_slots?.length ?? 4),
			trade_cost: Math.max(0, tpl?.trade_cost_slots?.length ?? 3),
			trade_gain: Math.max(0, tpl?.trade_gain_slots?.length ?? 3)
		};
	}

	onMount(() => {
		refreshSlotLimits();
		const handler = () => refreshSlotLimits();
		window.addEventListener('location-icon-template-updated', handler);

		void (async () => {
			await loadIconPool();
			iconPoolLoaded = true;
		})();

		return () => window.removeEventListener('location-icon-template-updated', handler);
	});

	function maxFor(row: GameLocationRewardRow, list: 'gain' | 'cost'): number {
		if (row.type === 'text') return 0;
		if (row.type === 'trade') {
			return list === 'cost' ? slotLimits.trade_cost : slotLimits.trade_gain;
		}
		return slotLimits.gain;
	}

	function addGainRow() {
		if (rewardRows.length >= MAX_REWARD_ROWS) return;
		rewardRows = [...rewardRows, { type: 'gain', gain_icon_ids: [] }];
		onchange?.(rewardRows);
	}

	function addTradeRow() {
		if (rewardRows.length >= MAX_REWARD_ROWS) return;
		rewardRows = [...rewardRows, { type: 'trade', cost_icon_ids: [], gain_icon_ids: [] }];
		onchange?.(rewardRows);
	}

	function addTextRow() {
		if (rewardRows.length >= MAX_REWARD_ROWS) return;
		rewardRows = [...rewardRows, { type: 'text', text: '' }];
		onchange?.(rewardRows);
	}

	function updateRow(index: number, row: GameLocationRewardRow) {
		rewardRows = rewardRows.map((r, i) => (i === index ? row : r));
		onchange?.(rewardRows);
	}

	function removeRow(index: number) {
		rewardRows = rewardRows.filter((_, i) => i !== index);
		onchange?.(rewardRows);
		if (picking?.rowIndex === index) picking = null;
	}

	function moveRow(index: number, direction: 'up' | 'down') {
		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= rewardRows.length) return;

		const newRows = [...rewardRows];
		[newRows[index], newRows[newIndex]] = [newRows[newIndex], newRows[index]];
		rewardRows = newRows;
		onchange?.(rewardRows);

		if (picking?.rowIndex === index) picking = { ...picking, rowIndex: newIndex };
		else if (picking?.rowIndex === newIndex) picking = { ...picking, rowIndex: index };
	}

	function setGainIcons(index: number, iconIds: string[]) {
		const row = rewardRows[index];
		if (row.type === 'text') return;
		updateRow(index, { ...row, gain_icon_ids: iconIds.slice(0, maxFor(row, 'gain')) } as GameLocationRewardRow);
	}

	function setCostIcons(index: number, iconIds: string[]) {
		const row = rewardRows[index];
		if (row.type !== 'trade') return;
		updateRow(index, { ...row, cost_icon_ids: iconIds.slice(0, maxFor(row, 'cost')) });
	}

	function setText(index: number, text: string) {
		const row = rewardRows[index];
		if (row.type !== 'text') return;
		updateRow(index, { ...row, text });
	}

	function removeGainIconAt(index: number, iconIndex: number) {
		const row = rewardRows[index];
		if (row.type === 'text') return;
		const next = row.gain_icon_ids.filter((_, i) => i !== iconIndex);
		setGainIcons(index, next);
	}

	function removeCostIconAt(index: number, iconIndex: number) {
		const row = rewardRows[index];
		if (row.type !== 'trade') return;
		const next = row.cost_icon_ids.filter((_, i) => i !== iconIndex);
		setCostIcons(index, next);
	}

	function setRowType(index: number, type: 'gain' | 'trade' | 'text') {
		const row = rewardRows[index];
		if (row.type === type) return;

		if (type === 'gain') {
			updateRow(index, { type: 'gain', gain_icon_ids: row.type === 'trade' ? row.gain_icon_ids ?? [] : [] });
			picking = null;
			return;
		}

		if (type === 'trade') {
			updateRow(index, {
				type: 'trade',
				cost_icon_ids: [],
				gain_icon_ids: row.type === 'gain' ? row.gain_icon_ids ?? [] : []
			});
			picking = null;
			return;
		}

		updateRow(index, { type: 'text', text: '' });
		picking = null;
	}
</script>

<div class="location-reward-rows">
	<div class="location-reward-rows__header">
		<h4>Rewards ({rewardRows.length}/{MAX_REWARD_ROWS})</h4>
		<div class="location-reward-rows__header-actions">
			<Button variant="secondary" onclick={addGainRow} disabled={rewardRows.length >= MAX_REWARD_ROWS}>+ Gain Row</Button>
			<Button variant="secondary" onclick={addTradeRow} disabled={rewardRows.length >= MAX_REWARD_ROWS}>+ Trade Row</Button>
			<Button variant="secondary" onclick={addTextRow} disabled={rewardRows.length >= MAX_REWARD_ROWS}>+ Text Row</Button>
		</div>
	</div>

	{#if !iconPoolLoaded}
		<div class="location-reward-rows__loading">Loading icons…</div>
	{:else if rewardRows.length === 0}
		<div class="location-reward-rows__empty">
			<p>No reward rows yet.</p>
		</div>
	{:else}
		<div class="location-reward-rows__list">
			{#each rewardRows as row, index (index)}
				<div class="location-reward-rows__item">
					<div class="location-reward-rows__controls">
						<div class="location-reward-rows__label-group">
							<span class="location-reward-rows__label">Reward row {index + 1}</span>
							<Select
								value={row.type}
								options={[
									{ value: 'gain', label: 'Gain' },
									{ value: 'trade', label: 'Trade' },
									{ value: 'text', label: 'Text' }
								]}
								onchange={(e) =>
									setRowType(index, (e.target as HTMLSelectElement).value as 'gain' | 'trade' | 'text')}
							/>
						</div>
						<div class="location-reward-rows__buttons">
							<button
								type="button"
								class="location-reward-rows__move"
								disabled={index === 0}
								onclick={() => moveRow(index, 'up')}
								title="Move up"
							>
								↑
							</button>
							<button
								type="button"
								class="location-reward-rows__move"
								disabled={index === rewardRows.length - 1}
								onclick={() => moveRow(index, 'down')}
								title="Move down"
							>
								↓
							</button>
							<Button variant="ghost" onclick={() => removeRow(index)} class="location-reward-rows__remove">
								✕
							</Button>
						</div>
					</div>

					{#if row.type === 'gain'}
						<div class="location-reward-rows__icons">
							<div class="location-reward-rows__section-title">Gain</div>
							{#if row.gain_icon_ids.length === 0}
								<button
									type="button"
									class="location-reward-rows__add-icon"
									onclick={() => (picking = { rowIndex: index, list: 'gain' })}
								>
									+ Add Icons
								</button>
							{:else}
								<div class="location-reward-rows__icon-list">
									{#each row.gain_icon_ids as iconId, iconIndex (iconIndex)}
										{@const url = getIconPoolUrl(iconId)}
										<div class="location-reward-rows__icon">
											{#if url}
												<img src={url} alt="Gain icon" />
											{:else}
												<span class="location-reward-rows__icon-placeholder">?</span>
											{/if}
											<button
												type="button"
												class="location-reward-rows__icon-remove"
												onclick={() => removeGainIconAt(index, iconIndex)}
											>
												✕
											</button>
										</div>
									{/each}
									{#if row.gain_icon_ids.length < maxFor(row, 'gain')}
										<button
											type="button"
											class="location-reward-rows__add-more"
											onclick={() => (picking = { rowIndex: index, list: 'gain' })}
										>
											+
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{:else if row.type === 'trade'}
						<div class="location-reward-rows__trade">
							<div class="location-reward-rows__trade-col">
								<div class="location-reward-rows__section-title">Spend</div>
								{#if row.cost_icon_ids.length === 0}
									<button
										type="button"
										class="location-reward-rows__add-icon"
										onclick={() => (picking = { rowIndex: index, list: 'cost' })}
									>
										+ Add Cost Icons
									</button>
								{:else}
									<div class="location-reward-rows__icon-list">
										{#each row.cost_icon_ids as iconId, iconIndex (iconIndex)}
											{@const url = getIconPoolUrl(iconId)}
											<div class="location-reward-rows__icon">
												{#if url}
													<img src={url} alt="Cost icon" />
												{:else}
													<span class="location-reward-rows__icon-placeholder">?</span>
												{/if}
												<button
													type="button"
													class="location-reward-rows__icon-remove"
													onclick={() => removeCostIconAt(index, iconIndex)}
												>
													✕
												</button>
											</div>
										{/each}
										{#if row.cost_icon_ids.length < maxFor(row, 'cost')}
											<button
												type="button"
												class="location-reward-rows__add-more"
												onclick={() => (picking = { rowIndex: index, list: 'cost' })}
											>
												+
											</button>
										{/if}
									</div>
								{/if}
							</div>

							<div class="location-reward-rows__trade-arrow">→</div>

							<div class="location-reward-rows__trade-col">
								<div class="location-reward-rows__section-title">Gain</div>
								{#if row.gain_icon_ids.length === 0}
									<button
										type="button"
										class="location-reward-rows__add-icon"
										onclick={() => (picking = { rowIndex: index, list: 'gain' })}
									>
										+ Add Reward Icons
									</button>
								{:else}
									<div class="location-reward-rows__icon-list">
										{#each row.gain_icon_ids as iconId, iconIndex (iconIndex)}
											{@const url = getIconPoolUrl(iconId)}
											<div class="location-reward-rows__icon">
												{#if url}
													<img src={url} alt="Reward icon" />
												{:else}
													<span class="location-reward-rows__icon-placeholder">?</span>
												{/if}
												<button
													type="button"
													class="location-reward-rows__icon-remove"
													onclick={() => removeGainIconAt(index, iconIndex)}
												>
													✕
												</button>
											</div>
										{/each}
										{#if row.gain_icon_ids.length < maxFor(row, 'gain')}
											<button
												type="button"
												class="location-reward-rows__add-more"
												onclick={() => (picking = { rowIndex: index, list: 'gain' })}
											>
												+
											</button>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					{:else}
						<div class="location-reward-rows__text">
							<div class="location-reward-rows__section-title">Text</div>
							<Textarea
								rows={2}
								value={row.text}
								placeholder="Enter row text…"
								oninput={(e) => setText(index, (e.currentTarget as HTMLTextAreaElement).value)}
							/>
						</div>
					{/if}

					{#if picking?.rowIndex === index && row.type !== 'text'}
						{@const activePicking = picking as NonNullable<typeof picking>}
						<div class="location-reward-rows__picker">
							<IconPicker
								selected={activePicking.list === 'cost' && row.type === 'trade' ? row.cost_icon_ids : row.gain_icon_ids}
								onselect={(ids) => (activePicking.list === 'cost' ? setCostIcons(index, ids) : setGainIcons(index, ids))}
								multiple={true}
								maxSelection={maxFor(row, activePicking.list)}
								allowDuplicates={true}
							/>
							<Button variant="secondary" onclick={() => (picking = null)}>Done</Button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.location-reward-rows {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.location-reward-rows__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.location-reward-rows__header h4 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.location-reward-rows__header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.location-reward-rows__loading {
		padding: 1rem;
		text-align: center;
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.location-reward-rows__empty {
		padding: 1.25rem;
		border: 2px dashed rgba(148, 163, 184, 0.2);
		border-radius: 10px;
		text-align: center;
	}

	.location-reward-rows__empty p {
		margin: 0;
		color: #64748b;
		font-size: 0.875rem;
	}

	.location-reward-rows__list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.location-reward-rows__item {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.75rem;
		border-radius: 10px;
		background: rgba(15, 23, 42, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.location-reward-rows__controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.location-reward-rows__label-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.location-reward-rows__label-group :global(select) {
		font-size: 0.8rem;
	}

	.location-reward-rows__label {
		font-size: 0.8rem;
		font-weight: 700;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.location-reward-rows__buttons {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.location-reward-rows__move {
		width: 24px;
		height: 24px;
		padding: 0;
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 6px;
		background: rgba(30, 41, 59, 0.5);
		color: #94a3b8;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.15s;
		display: grid;
		place-items: center;
	}

	.location-reward-rows__move:hover:not(:disabled) {
		background: rgba(51, 65, 85, 0.6);
		border-color: rgba(148, 163, 184, 0.5);
		color: #e2e8f0;
	}

	.location-reward-rows__move:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	:global(.location-reward-rows__remove) {
		padding: 0.25rem 0.5rem;
		min-width: auto;
	}

	.location-reward-rows__section-title {
		font-size: 0.75rem;
		font-weight: 700;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.location-reward-rows__icons {
		min-height: 48px;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.location-reward-rows__text {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.location-reward-rows__add-icon {
		width: 100%;
		padding: 0.75rem;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		border-radius: 8px;
		background: transparent;
		color: #94a3b8;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.15s ease;
	}

	.location-reward-rows__add-icon:hover {
		border-color: rgba(96, 165, 250, 0.75);
		color: #93c5fd;
	}

	.location-reward-rows__icon-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.location-reward-rows__icon {
		position: relative;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		background: rgba(15, 23, 42, 0.5);
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.location-reward-rows__icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.location-reward-rows__icon-placeholder {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		color: #64748b;
	}

	.location-reward-rows__icon-remove {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: none;
		background: rgba(248, 113, 113, 0.9);
		color: white;
		font-size: 0.6rem;
		cursor: pointer;
		display: grid;
		place-items: center;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.location-reward-rows__icon:hover .location-reward-rows__icon-remove {
		opacity: 1;
	}

	.location-reward-rows__add-more {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		background: transparent;
		color: #94a3b8;
		cursor: pointer;
		font-size: 1.25rem;
		display: grid;
		place-items: center;
		transition: all 0.15s;
	}

	.location-reward-rows__add-more:hover {
		border-color: rgba(96, 165, 250, 0.75);
		color: #93c5fd;
	}

	.location-reward-rows__trade {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 0.75rem;
		align-items: start;
	}

	.location-reward-rows__trade-col {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.location-reward-rows__trade-arrow {
		color: #94a3b8;
		font-weight: 700;
		padding-top: 1.6rem;
	}

	.location-reward-rows__picker {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(148, 163, 184, 0.15);
	}

	@media (max-width: 720px) {
		.location-reward-rows__trade {
			grid-template-columns: 1fr;
		}

		.location-reward-rows__trade-arrow {
			display: none;
		}
	}
</style>
