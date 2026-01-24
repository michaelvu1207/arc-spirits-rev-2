<script lang="ts">
	import type { Monster, Event } from './types';
	import { MonsterCardPreview } from '$lib/components/monsters';
	import EventCardPreview from './EventCardPreview.svelte';
	import { getMonsterStageLabel } from '$lib/utils/monsterStageLabels';

	export type DeckCard = {
		type: 'monster' | 'event';
		id: string;
		order: number;
		data: Monster | Event;
	};

	interface Props {
		monsters: Monster[];
		events: Event[];
		onOrderChange?: (cards: DeckCard[]) => void;
	}

	let { monsters, events, onOrderChange }: Props = $props();

	// Build combined deck from monsters and events
	let deckCards = $state<DeckCard[]>([]);
	let draggedCard = $state<DeckCard | null>(null);
	let dragOverIndex = $state<number | null>(null);
	let viewMode = $state<'grid' | 'list'>('grid');
	let scalePercent = $state(100);

	// Initialize deck cards when monsters/events change
	// Using $effect because we need to allow local reordering after initial load
	$effect(() => {
		const monsterCards: DeckCard[] = monsters.map((m) => ({
			type: 'monster' as const,
			id: m.id,
			order: m.order_num ?? 999,
			data: m
		}));

		const eventCards: DeckCard[] = events.map((e) => ({
			type: 'event' as const,
			id: e.id,
			order: e.order_num ?? 999,
			data: e
		}));

		// Combine and sort by order
		deckCards = [...monsterCards, ...eventCards].sort((a, b) => a.order - b.order);
	});

	function handleDragStart(e: DragEvent, card: DeckCard) {
		draggedCard = card;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', '');
		}
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dragOverIndex = index;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleDrop(e: DragEvent, dropIndex: number) {
		e.preventDefault();

		if (!draggedCard) return;

		const dragIndex = deckCards.findIndex((c) => c.id === draggedCard!.id && c.type === draggedCard!.type);
		if (dragIndex === -1 || dragIndex === dropIndex) {
			draggedCard = null;
			dragOverIndex = null;
			return;
		}

		// Reorder the cards
		const newCards = [...deckCards];
		const [removed] = newCards.splice(dragIndex, 1);
		newCards.splice(dropIndex, 0, removed);

		// Update order numbers
		deckCards = newCards.map((card, i) => ({ ...card, order: i }));

		draggedCard = null;
		dragOverIndex = null;

		onOrderChange?.(deckCards);
	}

	function handleDragEnd() {
		draggedCard = null;
		dragOverIndex = null;
	}

	function moveCard(currentIndex: number, direction: 'up' | 'down') {
		const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
		if (newIndex < 0 || newIndex >= deckCards.length) return;

		const newCards = [...deckCards];
		const [removed] = newCards.splice(currentIndex, 1);
		newCards.splice(newIndex, 0, removed);

		deckCards = newCards.map((card, i) => ({ ...card, order: i }));
		onOrderChange?.(deckCards);
	}

	function moveToPosition(currentIndex: number, newPosition: number) {
		if (newPosition < 0 || newPosition >= deckCards.length || currentIndex === newPosition) return;

		const newCards = [...deckCards];
		const [removed] = newCards.splice(currentIndex, 1);
		newCards.splice(newPosition, 0, removed);

		deckCards = newCards.map((card, i) => ({ ...card, order: i }));
		onOrderChange?.(deckCards);
	}

	// Insert a card after a specific position (pushing subsequent cards down)
	function insertAfter(currentIndex: number, afterPosition: number) {
		// afterPosition is 1-indexed (insert after card #X)
		// If afterPosition is 0, insert at the beginning
		const targetIndex = afterPosition;

		if (targetIndex < 0 || targetIndex > deckCards.length || currentIndex === targetIndex) return;

		// Adjust target if we're moving from before the target position
		const adjustedTarget = currentIndex < targetIndex ? targetIndex - 1 : targetIndex;

		const newCards = [...deckCards];
		const [removed] = newCards.splice(currentIndex, 1);
		newCards.splice(adjustedTarget, 0, removed);

		deckCards = newCards.map((card, i) => ({ ...card, order: i }));
		onOrderChange?.(deckCards);
	}

	// Renumber all cards sequentially (fixes gaps and duplicates)
	function renumberCards() {
		deckCards = deckCards.map((card, i) => ({ ...card, order: i }));
		onOrderChange?.(deckCards);
	}

	// Check if there are gaps or duplicates in the order
	const hasOrderIssues = $derived(() => {
		const orders = deckCards.map(c => c.order);
		const uniqueOrders = new Set(orders);
		// Has duplicates if unique count differs from total
		if (uniqueOrders.size !== orders.length) return true;
		// Has gaps if max order doesn't match expected
		const maxOrder = Math.max(...orders);
		if (maxOrder !== orders.length - 1) return true;
		// Check if not sequential starting from 0
		for (let i = 0; i < orders.length; i++) {
			if (!uniqueOrders.has(i)) return true;
		}
		return false;
	});

	function getCardName(card: DeckCard): string {
		if (card.type === 'monster') {
			return (card.data as Monster).name;
		}
		return (card.data as Event).title;
	}

	function getStageColor(stage: string | null | undefined): string {
		switch (stage) {
			case 'stage_1':
				return '#c084fc';
			case 'stage_2':
				return '#6b21a8';
			case 'stage_3':
				return '#065f46';
			case 'final_stage':
				return '#a855f7';
			case 'inactive':
				return '#64748b';
			default:
				return '#94a3b8';
		}
	}

	const cardScale = $derived(scalePercent / 100);
	const monsterCount = $derived(deckCards.filter((c) => c.type === 'monster').length);
	const eventCount = $derived(deckCards.filter((c) => c.type === 'event').length);
</script>

<div class="deck-view">
	<div class="deck-controls">
		<div class="deck-info">
			<span class="count-badge monster">{monsterCount} Monsters</span>
			<span class="count-badge event">{eventCount} Events</span>
			<span class="count-badge total">{deckCards.length} Total</span>
			{#if hasOrderIssues()}
				<button
					class="renumber-btn warning"
					onclick={renumberCards}
					title="Order numbers have gaps or duplicates - click to fix"
				>
					⚠ Renumber
				</button>
			{:else}
				<button
					class="renumber-btn"
					onclick={renumberCards}
					title="Reassign sequential order numbers to all cards"
				>
					Renumber
				</button>
			{/if}
		</div>

		<div class="view-controls">
			<label class="scale-control">
				<span>Scale:</span>
				<input
					type="range"
					min="25"
					max="100"
					step="5"
					bind:value={scalePercent}
				/>
				<span class="scale-value">{scalePercent}%</span>
			</label>

			<div class="view-toggle">
				<button
					class="view-btn"
					class:active={viewMode === 'grid'}
					onclick={() => viewMode = 'grid'}
				>
					Grid
				</button>
				<button
					class="view-btn"
					class:active={viewMode === 'list'}
					onclick={() => viewMode = 'list'}
				>
					List
				</button>
			</div>
		</div>
	</div>

	<div class="deck-cards" class:list-view={viewMode === 'list'}>
		{#each deckCards as card, index (card.type + '-' + card.id)}
			{@const isDragging = draggedCard?.id === card.id && draggedCard?.type === card.type}
			{@const isDragOver = dragOverIndex === index}

			<div
				class="deck-card-wrapper"
				class:dragging={isDragging}
				class:drag-over={isDragOver}
				class:monster={card.type === 'monster'}
				class:event={card.type === 'event'}
				style="--card-scale: {cardScale}"
				draggable="true"
				role="listitem"
				ondragstart={(e) => handleDragStart(e, card)}
				ondragover={(e) => handleDragOver(e, index)}
				ondragleave={handleDragLeave}
				ondrop={(e) => handleDrop(e, index)}
				ondragend={handleDragEnd}
			>
				<div class="card-controls">
					<div class="position-info">
						<span class="position-badge">#{index + 1}</span>
						<input
							type="number"
							class="position-input"
							min="1"
							max={deckCards.length}
							value={index + 1}
							onchange={(e) => moveToPosition(index, parseInt(e.currentTarget.value) - 1)}
							onclick={(e) => e.stopPropagation()}
							title="Move to position"
						/>
					</div>
					<div class="move-buttons">
						<button
							class="move-btn"
							disabled={index === 0}
							onclick={() => moveCard(index, 'up')}
							title="Move up"
						>
							↑
						</button>
						<button
							class="move-btn"
							disabled={index === deckCards.length - 1}
							onclick={() => moveCard(index, 'down')}
							title="Move down"
						>
							↓
						</button>
					</div>
					<div class="insert-after-control">
						<span class="insert-label">After #</span>
						<input
							type="number"
							class="insert-input"
							min="0"
							max={deckCards.length}
							placeholder="0"
							onclick={(e) => e.stopPropagation()}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									const target = e.currentTarget;
									const value = parseInt(target.value);
									if (!isNaN(value)) {
										insertAfter(index, value);
										target.value = '';
									}
								}
							}}
						/>
						<button
							class="insert-btn"
							onclick={(e) => {
								const input = (e.currentTarget as HTMLButtonElement).previousElementSibling as HTMLInputElement;
								const value = parseInt(input.value);
								if (!isNaN(value)) {
									insertAfter(index, value);
									input.value = '';
								}
							}}
							title="Insert after card # (enter 0 to move to beginning)"
						>
							Insert
						</button>
					</div>
					<span class="card-type-badge" class:monster={card.type === 'monster'} class:event={card.type === 'event'}>
						{card.type === 'monster' ? '👹' : '⚡'}
					</span>
				</div>

				<div class="card-preview-container">
					{#if card.type === 'monster'}
						<MonsterCardPreview monster={card.data as Monster} />
					{:else}
						<EventCardPreview event={card.data as Event} />
					{/if}
				</div>

					{#if viewMode === 'list'}
						<div class="card-list-info">
							<h3 class="card-name">{getCardName(card)}</h3>
							{#if card.type === 'monster'}
								{@const monster = card.data as Monster}
								<span class="card-state" style="--state-color: {getStageColor(monster.stage)}">
									{getMonsterStageLabel(monster.stage)}
								</span>
							{/if}
						</div>
					{/if}

				<div class="drag-handle" title="Drag to reorder">
					⋮⋮
				</div>
			</div>
		{/each}
	</div>

	{#if deckCards.length === 0}
		<div class="empty-state">
			No cards in deck. Add monsters and events from their respective tabs.
		</div>
	{/if}
</div>

<style>
	.deck-view {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.deck-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
		padding: 0.75rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
	}

	.deck-info {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.count-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 600;
	}

	.count-badge.monster {
		background: rgba(168, 85, 247, 0.2);
		color: #c084fc;
		border: 1px solid rgba(168, 85, 247, 0.3);
	}

	.count-badge.event {
		background: rgba(59, 130, 246, 0.2);
		color: #60a5fa;
		border: 1px solid rgba(59, 130, 246, 0.3);
	}

	.count-badge.total {
		background: rgba(148, 163, 184, 0.2);
		color: #94a3b8;
		border: 1px solid rgba(148, 163, 184, 0.3);
	}

	.renumber-btn {
		padding: 0.25rem 0.5rem;
		font-size: 0.7rem;
		font-weight: 600;
		background: rgba(148, 163, 184, 0.15);
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 4px;
		color: #94a3b8;
		cursor: pointer;
		transition: all 0.15s;
	}

	.renumber-btn:hover {
		background: rgba(148, 163, 184, 0.25);
		border-color: rgba(148, 163, 184, 0.5);
		color: #cbd5e1;
	}

	.renumber-btn.warning {
		background: rgba(251, 191, 36, 0.2);
		border-color: rgba(251, 191, 36, 0.4);
		color: #fbbf24;
	}

	.renumber-btn.warning:hover {
		background: rgba(251, 191, 36, 0.3);
		border-color: rgba(251, 191, 36, 0.6);
	}

	.view-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.scale-control {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.scale-control input[type="range"] {
		width: 100px;
		height: 4px;
		-webkit-appearance: none;
		appearance: none;
		background: rgba(148, 163, 184, 0.3);
		border-radius: 2px;
		cursor: pointer;
	}

	.scale-control input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #a855f7;
		cursor: pointer;
	}

	.scale-value {
		min-width: 40px;
		text-align: right;
	}

	.view-toggle {
		display: flex;
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 6px;
		overflow: hidden;
	}

	.view-btn {
		padding: 0.35rem 0.75rem;
		border: none;
		background: transparent;
		color: #94a3b8;
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.view-btn:hover {
		background: rgba(148, 163, 184, 0.1);
	}

	.view-btn.active {
		background: rgba(168, 85, 247, 0.2);
		color: #c084fc;
	}

	.deck-cards {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.deck-cards.list-view {
		flex-direction: column;
	}

	.deck-card-wrapper {
		position: relative;
		background: rgba(30, 41, 59, 0.4);
		border: 2px solid rgba(148, 163, 184, 0.2);
		border-radius: 12px;
		padding: 0.5rem;
		transition: all 0.2s;
		cursor: grab;
		transform-origin: top left;
	}

	.deck-card-wrapper:hover {
		border-color: rgba(168, 85, 247, 0.5);
		background: rgba(30, 41, 59, 0.6);
	}

	.deck-card-wrapper.monster {
		border-color: rgba(168, 85, 247, 0.3);
	}

	.deck-card-wrapper.event {
		border-color: rgba(59, 130, 246, 0.3);
	}

	.deck-card-wrapper.dragging {
		opacity: 0.5;
		cursor: grabbing;
	}

	.deck-card-wrapper.drag-over {
		border-color: #22c55e;
		background: rgba(34, 197, 94, 0.1);
		box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
	}

	.list-view .deck-card-wrapper {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.card-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
	}

	.list-view .card-controls {
		flex-direction: column;
		margin-bottom: 0;
		padding-bottom: 0;
		border-bottom: none;
		border-right: 1px solid rgba(148, 163, 184, 0.1);
		padding-right: 0.5rem;
	}

	.list-view .insert-after-control {
		margin-left: 0;
		padding-left: 0;
		border-left: none;
		margin-top: 0.25rem;
		padding-top: 0.25rem;
		border-top: 1px solid rgba(148, 163, 184, 0.2);
	}

	.position-info {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.position-badge {
		font-size: 0.7rem;
		font-weight: 600;
		color: #f8fafc;
		background: rgba(15, 23, 42, 0.8);
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
	}

	.position-input {
		width: 45px;
		padding: 0.2rem 0.35rem;
		font-size: 0.7rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 4px;
		color: #f8fafc;
		text-align: center;
	}

	.position-input:focus {
		outline: none;
		border-color: #a855f7;
	}

	.move-buttons {
		display: flex;
		gap: 0.25rem;
	}

	.move-btn {
		width: 24px;
		height: 24px;
		padding: 0;
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 4px;
		background: rgba(15, 23, 42, 0.6);
		color: #94a3b8;
		font-size: 0.75rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
	}

	.move-btn:hover:not(:disabled) {
		background: rgba(168, 85, 247, 0.2);
		border-color: rgba(168, 85, 247, 0.4);
		color: #c084fc;
	}

	.move-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.insert-after-control {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-left: 0.5rem;
		padding-left: 0.5rem;
		border-left: 1px solid rgba(148, 163, 184, 0.2);
	}

	.insert-label {
		font-size: 0.65rem;
		color: #64748b;
		white-space: nowrap;
	}

	.insert-input {
		width: 40px;
		padding: 0.2rem 0.25rem;
		font-size: 0.7rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 4px;
		color: #f8fafc;
		text-align: center;
	}

	.insert-input:focus {
		outline: none;
		border-color: #22c55e;
	}

	.insert-input::placeholder {
		color: #475569;
	}

	.insert-btn {
		padding: 0.2rem 0.4rem;
		font-size: 0.65rem;
		font-weight: 600;
		background: rgba(34, 197, 94, 0.2);
		border: 1px solid rgba(34, 197, 94, 0.3);
		border-radius: 4px;
		color: #4ade80;
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.insert-btn:hover {
		background: rgba(34, 197, 94, 0.3);
		border-color: rgba(34, 197, 94, 0.5);
	}

	.card-type-badge {
		font-size: 1rem;
		margin-left: auto;
	}

	.card-preview-container {
		transform: scale(var(--card-scale));
		transform-origin: top left;
		width: fit-content;
	}

	.list-view .card-preview-container {
		flex-shrink: 0;
	}

	.card-list-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.card-name {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #f8fafc;
	}

	.card-state {
		display: inline-block;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: capitalize;
		background: color-mix(in srgb, var(--state-color) 20%, transparent);
		color: var(--state-color);
		border: 1px solid color-mix(in srgb, var(--state-color) 30%, transparent);
		width: fit-content;
	}

	.drag-handle {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		font-size: 1rem;
		color: #64748b;
		cursor: grab;
		padding: 0.25rem;
		border-radius: 4px;
		transition: all 0.15s;
	}

	.drag-handle:hover {
		background: rgba(148, 163, 184, 0.1);
		color: #94a3b8;
	}

	.empty-state {
		padding: 3rem;
		text-align: center;
		color: #64748b;
		font-size: 0.85rem;
		background: rgba(30, 41, 59, 0.3);
		border: 1px dashed rgba(148, 163, 184, 0.2);
		border-radius: 8px;
	}

	@media (max-width: 768px) {
		.deck-controls {
			flex-direction: column;
			align-items: stretch;
		}

		.view-controls {
			flex-wrap: wrap;
		}
	}
</style>
