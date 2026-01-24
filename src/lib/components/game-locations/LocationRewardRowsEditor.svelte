	<script lang="ts">
		import { onMount } from 'svelte';
		import type { GameLocationRewardRow, RewardIconToken } from '$lib/types/gameData';
		import { loadIconPool, getIconPoolUrl } from '$lib/utils/iconPool';
		import { clampRewardIconTokensBySlots, isRewardOrIconToken, rewardIconTokenSlotCost, rewardIconTokensSlotsUsed } from '$lib/utils/rewardIconTokens';
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
	type PickingState =
		| { rowIndex: number; list: 'gain' | 'cost'; mode: 'append' }
		| { rowIndex: number; list: 'gain' | 'cost'; mode: 'edit'; tokenIndex: number };
	let picking = $state<PickingState | null>(null);
	const slotLimits = { gain: 6, trade_cost: 3, trade_gain: 6 };

	onMount(() => {
		void (async () => {
			await loadIconPool();
			iconPoolLoaded = true;
		})();
	});

	function maxFor(row: GameLocationRewardRow, list: 'gain' | 'cost'): number {
		if (row.type === 'text') return 0;
		if (row.type === 'trade') {
			return list === 'cost' ? slotLimits.trade_cost : slotLimits.trade_gain;
		}
		return slotLimits.gain;
	}

	function getTokens(row: GameLocationRewardRow, list: 'gain' | 'cost'): RewardIconToken[] {
		if (row.type === 'text') return [];
		if (list === 'gain') return row.gain_icon_ids ?? [];
		if (row.type !== 'trade') return [];
		return row.cost_icon_ids ?? [];
	}

	function setTokens(index: number, list: 'gain' | 'cost', tokens: RewardIconToken[]) {
		const row = rewardRows[index];
		if (!row || row.type === 'text') return;

		if (list === 'gain') {
			updateRow(index, { ...row, gain_icon_ids: clampRewardIconTokensBySlots(tokens, maxFor(row, 'gain')) } as GameLocationRewardRow);
			return;
		}

		if (row.type !== 'trade') return;
		updateRow(index, { ...row, cost_icon_ids: clampRewardIconTokensBySlots(tokens, maxFor(row, 'cost')) } as GameLocationRewardRow);
	}

	function remainingSlots(row: GameLocationRewardRow, list: 'gain' | 'cost'): number {
		return Math.max(0, maxFor(row, list) - rewardIconTokensSlotsUsed(getTokens(row, list)));
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

	function appendIcons(index: number, list: 'gain' | 'cost', iconIds: string[]) {
		const row = rewardRows[index];
		if (!row || row.type === 'text') return;

		const existing = getTokens(row, list);
		const toAdd = iconIds.slice(0, remainingSlots(row, list)).map((id) => String(id));
		setTokens(index, list, [...existing, ...toAdd]);
	}

	function replaceTokenAt(index: number, list: 'gain' | 'cost', tokenIndex: number, next: RewardIconToken) {
		const row = rewardRows[index];
		if (!row || row.type === 'text') return;
		const tokens = getTokens(row, list);
		if (tokenIndex < 0 || tokenIndex >= tokens.length) return;
		const updated = tokens.map((t, i) => (i === tokenIndex ? next : t));
		setTokens(index, list, updated);
	}

	function addOrSlot(index: number, list: 'gain' | 'cost') {
		const row = rewardRows[index];
		if (!row || row.type === 'text') return;
		if (remainingSlots(row, list) < 2) return;

		const tokens = getTokens(row, list);
		const tokenIndex = tokens.length;
		setTokens(index, list, [...tokens, { kind: 'or', icon_ids: [] }]);
		picking = { rowIndex: index, list, mode: 'edit', tokenIndex };
	}

	function setText(index: number, text: string) {
		const row = rewardRows[index];
		if (row.type !== 'text') return;
		updateRow(index, { ...row, text });
	}

	function removeTokenAt(index: number, list: 'gain' | 'cost', tokenIndex: number) {
		const row = rewardRows[index];
		if (!row || row.type === 'text') return;
		const tokens = getTokens(row, list).filter((_, i) => i !== tokenIndex);
		setTokens(index, list, tokens);
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
					{@const gainTokens = row.gain_icon_ids ?? []}
					<div class="location-reward-rows__icons">
						<div class="location-reward-rows__section-title">Gain</div>
						{#if gainTokens.length === 0}
							<div class="location-reward-rows__add-actions">
								<button
									type="button"
									class="location-reward-rows__add-icon"
									onclick={() => (picking = { rowIndex: index, list: 'gain', mode: 'append' })}
								>
									+ Add Icons
								</button>
								<button
									type="button"
									class="location-reward-rows__add-or"
									onclick={() => addOrSlot(index, 'gain')}
									disabled={remainingSlots(row, 'gain') < 2}
								>
									+ OR Slot
								</button>
							</div>
						{:else}
							<div class="location-reward-rows__icon-list">
								{#each gainTokens as token, tokenIndex (tokenIndex)}
									<div class="location-reward-rows__icon">
										<button
											type="button"
											class="location-reward-rows__icon-edit"
											title="Edit slot"
											onclick={() => (picking = { rowIndex: index, list: 'gain', mode: 'edit', tokenIndex })}
										>
											✎
										</button>

										{#if typeof token === 'string'}
											{@const url = getIconPoolUrl(token)}
											{#if url}
												<img src={url} alt="Gain icon" />
											{:else}
												<span class="location-reward-rows__icon-placeholder">?</span>
											{/if}
										{:else if isRewardOrIconToken(token)}
											{#if token.icon_ids.length === 0}
												<span class="location-reward-rows__icon-placeholder">OR</span>
											{:else}
												<div class="location-reward-rows__or-group">
													{#each token.icon_ids.slice(0, 2) as iconId, iconIdx (iconIdx)}
														{@const url = getIconPoolUrl(iconId)}
														{#if url}
															<img src={url} alt="OR icon" />
														{:else}
															<span class="location-reward-rows__icon-placeholder">?</span>
														{/if}
														{#if iconIdx < Math.min(2, token.icon_ids.length) - 1}
															<span class="location-reward-rows__or-slash">/</span>
														{/if}
													{/each}
												</div>
											{/if}
										{/if}

										<button
											type="button"
											class="location-reward-rows__icon-remove"
											onclick={() => removeTokenAt(index, 'gain', tokenIndex)}
										>
											✕
										</button>
									</div>
								{/each}
								{#if remainingSlots(row, 'gain') > 0}
									<div class="location-reward-rows__add-more-group">
										<button
											type="button"
											class="location-reward-rows__add-more"
											onclick={() => (picking = { rowIndex: index, list: 'gain', mode: 'append' })}
										>
											+
										</button>
										<button
											type="button"
											class="location-reward-rows__add-or-mini"
											onclick={() => addOrSlot(index, 'gain')}
											disabled={remainingSlots(row, 'gain') < 2}
										>
											OR
										</button>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{:else if row.type === 'trade'}
					{@const costTokens = row.cost_icon_ids ?? []}
					{@const gainTokens = row.gain_icon_ids ?? []}
					<div class="location-reward-rows__trade">
						<div class="location-reward-rows__trade-col">
							<div class="location-reward-rows__section-title">Spend</div>
							{#if costTokens.length === 0}
								<div class="location-reward-rows__add-actions">
									<button
										type="button"
										class="location-reward-rows__add-icon"
										onclick={() => (picking = { rowIndex: index, list: 'cost', mode: 'append' })}
									>
										+ Add Cost Icons
									</button>
									<button
										type="button"
										class="location-reward-rows__add-or"
										onclick={() => addOrSlot(index, 'cost')}
										disabled={remainingSlots(row, 'cost') < 2}
									>
										+ OR Slot
									</button>
								</div>
							{:else}
								<div class="location-reward-rows__icon-list">
									{#each costTokens as token, tokenIndex (tokenIndex)}
										<div class="location-reward-rows__icon">
											<button
												type="button"
												class="location-reward-rows__icon-edit"
												title="Edit slot"
												onclick={() => (picking = { rowIndex: index, list: 'cost', mode: 'edit', tokenIndex })}
											>
												✎
											</button>

											{#if typeof token === 'string'}
												{@const url = getIconPoolUrl(token)}
												{#if url}
													<img src={url} alt="Cost icon" />
												{:else}
													<span class="location-reward-rows__icon-placeholder">?</span>
												{/if}
											{:else if isRewardOrIconToken(token)}
												{#if token.icon_ids.length === 0}
													<span class="location-reward-rows__icon-placeholder">OR</span>
												{:else}
													<div class="location-reward-rows__or-group">
														{#each token.icon_ids.slice(0, 2) as iconId, iconIdx (iconIdx)}
															{@const url = getIconPoolUrl(iconId)}
															{#if url}
																<img src={url} alt="OR icon" />
															{:else}
																<span class="location-reward-rows__icon-placeholder">?</span>
															{/if}
															{#if iconIdx < Math.min(2, token.icon_ids.length) - 1}
																<span class="location-reward-rows__or-slash">/</span>
															{/if}
														{/each}
													</div>
												{/if}
											{/if}

											<button
												type="button"
												class="location-reward-rows__icon-remove"
												onclick={() => removeTokenAt(index, 'cost', tokenIndex)}
											>
												✕
											</button>
										</div>
									{/each}
									{#if remainingSlots(row, 'cost') > 0}
										<div class="location-reward-rows__add-more-group">
											<button
												type="button"
												class="location-reward-rows__add-more"
												onclick={() => (picking = { rowIndex: index, list: 'cost', mode: 'append' })}
											>
												+
											</button>
											<button
												type="button"
												class="location-reward-rows__add-or-mini"
												onclick={() => addOrSlot(index, 'cost')}
												disabled={remainingSlots(row, 'cost') < 2}
											>
												OR
											</button>
										</div>
									{/if}
								</div>
							{/if}
						</div>

							<div class="location-reward-rows__trade-arrow">→</div>

						<div class="location-reward-rows__trade-col">
							<div class="location-reward-rows__section-title">Gain</div>
							{#if gainTokens.length === 0}
								<div class="location-reward-rows__add-actions">
									<button
										type="button"
										class="location-reward-rows__add-icon"
										onclick={() => (picking = { rowIndex: index, list: 'gain', mode: 'append' })}
									>
										+ Add Reward Icons
									</button>
									<button
										type="button"
										class="location-reward-rows__add-or"
										onclick={() => addOrSlot(index, 'gain')}
										disabled={remainingSlots(row, 'gain') < 2}
									>
										+ OR Slot
									</button>
								</div>
							{:else}
								<div class="location-reward-rows__icon-list">
									{#each gainTokens as token, tokenIndex (tokenIndex)}
										<div class="location-reward-rows__icon">
											<button
												type="button"
												class="location-reward-rows__icon-edit"
												title="Edit slot"
												onclick={() => (picking = { rowIndex: index, list: 'gain', mode: 'edit', tokenIndex })}
											>
												✎
											</button>

											{#if typeof token === 'string'}
												{@const url = getIconPoolUrl(token)}
												{#if url}
													<img src={url} alt="Reward icon" />
												{:else}
													<span class="location-reward-rows__icon-placeholder">?</span>
												{/if}
											{:else if isRewardOrIconToken(token)}
												{#if token.icon_ids.length === 0}
													<span class="location-reward-rows__icon-placeholder">OR</span>
												{:else}
													<div class="location-reward-rows__or-group">
														{#each token.icon_ids.slice(0, 2) as iconId, iconIdx (iconIdx)}
															{@const url = getIconPoolUrl(iconId)}
															{#if url}
																<img src={url} alt="OR icon" />
															{:else}
																<span class="location-reward-rows__icon-placeholder">?</span>
															{/if}
															{#if iconIdx < Math.min(2, token.icon_ids.length) - 1}
																<span class="location-reward-rows__or-slash">/</span>
															{/if}
														{/each}
													</div>
												{/if}
											{/if}

											<button
												type="button"
												class="location-reward-rows__icon-remove"
												onclick={() => removeTokenAt(index, 'gain', tokenIndex)}
											>
												✕
											</button>
										</div>
									{/each}
									{#if remainingSlots(row, 'gain') > 0}
										<div class="location-reward-rows__add-more-group">
											<button
												type="button"
												class="location-reward-rows__add-more"
												onclick={() => (picking = { rowIndex: index, list: 'gain', mode: 'append' })}
											>
												+
											</button>
											<button
												type="button"
												class="location-reward-rows__add-or-mini"
												onclick={() => addOrSlot(index, 'gain')}
												disabled={remainingSlots(row, 'gain') < 2}
											>
												OR
											</button>
										</div>
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
					{@const tokenList = getTokens(row, activePicking.list)}
					{@const activeToken = activePicking.mode === 'edit' ? tokenList[activePicking.tokenIndex] : null}
					{@const pickerSelected = activePicking.mode === 'edit'
						? (typeof activeToken === 'string'
							? [activeToken]
							: (activeToken && isRewardOrIconToken(activeToken) ? activeToken.icon_ids : []))
						: []}
					{@const pickerMax = (() => {
						if (activePicking.mode === 'append') return remainingSlots(row, activePicking.list);
						if (!activeToken || typeof activeToken === 'string' || !isRewardOrIconToken(activeToken)) return 1;

						const otherTokens = tokenList.filter((_, i) => i !== activePicking.tokenIndex);
						const usedElsewhere = rewardIconTokensSlotsUsed(otherTokens);
						const budget = Math.max(0, maxFor(row, activePicking.list) - usedElsewhere);
						const currentCost = rewardIconTokenSlotCost(activeToken);
						const maxPossible = Math.min(2, Math.max(budget, currentCost));
						return maxPossible;
					})()}
					{@const pickerMultiple = activePicking.mode === 'append' || (!!activeToken && isRewardOrIconToken(activeToken))}
					<div class="location-reward-rows__picker">
						<IconPicker
							selected={pickerSelected}
							onselect={(ids) => {
								if (activePicking.mode === 'append') {
									appendIcons(index, activePicking.list, ids);
									return;
								}

								const token = tokenList[activePicking.tokenIndex];
								if (typeof token === 'string') {
									const next = ids[0] ?? token;
									replaceTokenAt(index, activePicking.list, activePicking.tokenIndex, next);
									return;
								}

								if (token && isRewardOrIconToken(token)) {
									replaceTokenAt(index, activePicking.list, activePicking.tokenIndex, { kind: 'or', icon_ids: ids });
								}
							}}
							multiple={pickerMultiple}
							maxSelection={pickerMax}
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

	.location-reward-rows__add-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.location-reward-rows__add-or {
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

	.location-reward-rows__add-or:hover {
		border-color: rgba(96, 165, 250, 0.75);
		color: #93c5fd;
	}

	.location-reward-rows__add-or:disabled,
	.location-reward-rows__add-more:disabled,
	.location-reward-rows__add-or-mini:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.location-reward-rows__add-or:disabled:hover,
	.location-reward-rows__add-more:disabled:hover,
	.location-reward-rows__add-or-mini:disabled:hover {
		border-color: rgba(148, 163, 184, 0.3);
		color: #94a3b8;
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

	.location-reward-rows__icon > img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.location-reward-rows__or-group {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		gap: 0;
		padding: 0.1rem;
	}

	.location-reward-rows__or-group img {
		width: 12px;
		height: 12px;
		object-fit: contain;
	}

	.location-reward-rows__or-slash {
		color: rgba(226, 232, 240, 0.9);
		font-weight: 800;
		font-size: 1.1rem;
		line-height: 1;
		margin: 0 0.16rem;
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

	.location-reward-rows__icon-edit {
		position: absolute;
		top: -4px;
		left: -4px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: none;
		background: rgba(96, 165, 250, 0.9);
		color: white;
		font-size: 0.6rem;
		cursor: pointer;
		display: grid;
		place-items: center;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.location-reward-rows__icon:hover .location-reward-rows__icon-edit {
		opacity: 1;
	}

	.location-reward-rows__add-more-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.location-reward-rows__add-or-mini {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		background: transparent;
		color: #94a3b8;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 700;
		display: grid;
		place-items: center;
		transition: all 0.15s;
	}

	.location-reward-rows__add-or-mini:hover {
		border-color: rgba(96, 165, 250, 0.75);
		color: #93c5fd;
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
