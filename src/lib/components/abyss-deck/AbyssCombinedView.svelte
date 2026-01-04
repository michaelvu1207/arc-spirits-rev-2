<script lang="ts">
	import type { Monster, Event } from './types';
	import type { SpecialEffectRow } from '$lib/types/gameData';
	import { MonsterCardPreview, RewardRowsEditor } from '$lib/components/monsters';
	import EventCardPreview from './EventCardPreview.svelte';
	import { Button, FormField, Input, Select, Textarea } from '$lib/components/ui';
	import { SpecialEffectPicker } from '$lib/components/shared';

	export type DeckCard = {
		type: 'monster' | 'event';
		id: string;
		order: number;
		data: Monster | Event;
		/** For monsters with quantity > 1, which copy is this (1-based) */
		copyIndex?: number;
		/** Total copies for this monster (quantity) */
		totalCopies?: number;
	};

	export type MonsterFormData = {
		name: string;
		damage: number;
		barrier: number;
		state: 'tainted' | 'corrupt' | 'fallen' | 'arcane' | 'boss';
		icon: string | null;
		image_path: string | null;
		order_num: number;
		reward_rows: any[];
		special_conditions: string | null;
		special_effect_ids: string[];
		quantity: number;
	};

	export type EventFormData = {
		name: string;
		title: string;
		description: string | null;
		image_path: string | null;
		order_num: number;
	};

	interface Props {
		monsters: Monster[];
		events: Event[];
		specialEffects: SpecialEffectRow[];
		monsterSpecialEffects: Record<string, string[]>;
		onMonsterSave: (formData: MonsterFormData, id: string | null) => Promise<void>;
		onEventSave: (formData: EventFormData, id: string | null) => Promise<void>;
		onOrderChange: (cards: DeckCard[]) => void;
	}

	let { monsters, events, specialEffects, monsterSpecialEffects, onMonsterSave, onEventSave, onOrderChange }: Props = $props();

	// Deck state
	let deckCards = $state<DeckCard[]>([]);
	let draggedCard = $state<DeckCard | null>(null);
	let dragOverIndex = $state<number | null>(null);
	let viewMode = $state<'grid' | 'list'>('grid');
	let scalePercent = $state(100);
	let typeFilter = $state<'all' | 'monster' | 'event'>('all');

	// Monster editing state
	let showMonsterDrawer = $state(false);
	let editingMonsterId = $state<string | null>(null);
	let monsterFormData = $state<MonsterFormData>({
		name: '',
		damage: 0,
		barrier: 0,
		state: 'tainted',
		icon: null,
		image_path: null,
		order_num: 0,
		reward_rows: [],
		special_conditions: null,
		special_effect_ids: [],
		quantity: 1
	});

	// Event editing state
	let showEventDrawer = $state(false);
	let editingEventId = $state<string | null>(null);
	let eventFormData = $state<EventFormData>({
		name: '',
		title: '',
		description: null,
		image_path: null,
		order_num: 0
	});

	const isEditingMonster = $derived(editingMonsterId !== null);
	const isEditingEvent = $derived(editingEventId !== null);

	// Initialize deck cards when monsters/events change
	// Monsters with quantity > 1 are expanded to show multiple copies
	$effect(() => {
		const monsterCards: DeckCard[] = monsters.flatMap((m) => {
			const quantity = m.quantity ?? 1;
			const baseOrder = m.order_num ?? 999;
			return Array.from({ length: quantity }, (_, copyIndex) => ({
				type: 'monster' as const,
				id: m.id,
				// Add fractional offset to keep copies together in order
				order: baseOrder + (copyIndex * 0.001),
				data: m,
				copyIndex: copyIndex + 1,
				totalCopies: quantity
			}));
		});

		const eventCards: DeckCard[] = events.map((e) => ({
			type: 'event' as const,
			id: e.id,
			order: e.order_num ?? 999,
			data: e
		}));

		deckCards = [...monsterCards, ...eventCards].sort((a, b) => a.order - b.order);
	});

	// Filtered cards based on type filter
	const filteredDeckCards = $derived(
		typeFilter === 'all'
			? deckCards
			: deckCards.filter((c) => c.type === typeFilter)
	);

	// Drag and drop handlers
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

		const dragIndex = deckCards.findIndex((c) => c.id === draggedCard!.id && c.type === draggedCard!.type && c.copyIndex === draggedCard!.copyIndex);
		if (dragIndex === -1 || dragIndex === dropIndex) {
			draggedCard = null;
			dragOverIndex = null;
			return;
		}

		const newCards = [...deckCards];
		const [removed] = newCards.splice(dragIndex, 1);
		newCards.splice(dropIndex, 0, removed);

		deckCards = newCards.map((card, i) => ({ ...card, order: i }));
		draggedCard = null;
		dragOverIndex = null;
		onOrderChange(deckCards);
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
		onOrderChange(deckCards);
	}

	function moveToPosition(currentIndex: number, newPosition: number) {
		if (newPosition < 0 || newPosition >= deckCards.length || currentIndex === newPosition) return;

		const newCards = [...deckCards];
		const [removed] = newCards.splice(currentIndex, 1);
		newCards.splice(newPosition, 0, removed);

		deckCards = newCards.map((card, i) => ({ ...card, order: i }));
		onOrderChange(deckCards);
	}

	function insertAfter(currentIndex: number, afterPosition: number) {
		const targetIndex = afterPosition;
		if (targetIndex < 0 || targetIndex > deckCards.length || currentIndex === targetIndex) return;

		const adjustedTarget = currentIndex < targetIndex ? targetIndex - 1 : targetIndex;

		const newCards = [...deckCards];
		const [removed] = newCards.splice(currentIndex, 1);
		newCards.splice(adjustedTarget, 0, removed);

		deckCards = newCards.map((card, i) => ({ ...card, order: i }));
		onOrderChange(deckCards);
	}

	function renumberCards() {
		deckCards = deckCards.map((card, i) => ({ ...card, order: i }));
		onOrderChange(deckCards);
	}

	const hasOrderIssues = $derived(() => {
		const orders = deckCards.map((c) => c.order);
		const uniqueOrders = new Set(orders);
		if (uniqueOrders.size !== orders.length) return true;
		const maxOrder = Math.max(...orders);
		if (maxOrder !== orders.length - 1) return true;
		for (let i = 0; i < orders.length; i++) {
			if (!uniqueOrders.has(i)) return true;
		}
		return false;
	});

	// Monster form handlers
	function openMonsterForm() {
		editingMonsterId = null;
		monsterFormData = {
			name: '',
			damage: 0,
			barrier: 0,
			state: 'tainted',
			icon: null,
			image_path: null,
			order_num: deckCards.length,
			reward_rows: [],
			special_conditions: null,
			special_effect_ids: [],
			quantity: 1
		};
		showMonsterDrawer = true;
	}

	function openMonsterEditForm(card: DeckCard) {
		const monster = card.data as Monster;
		editingMonsterId = monster.id;
		monsterFormData = {
			name: monster.name,
			damage: monster.damage,
			barrier: monster.barrier,
			state: monster.state,
			icon: monster.icon,
			image_path: monster.image_path,
			order_num: monster.order_num,
			reward_rows: monster.reward_rows ?? [],
			special_conditions: monster.special_conditions,
			special_effect_ids: monsterSpecialEffects[monster.id] ?? [],
			quantity: monster.quantity ?? 1
		};
		showMonsterDrawer = true;
	}

	async function saveMonster() {
		if (!monsterFormData.name.trim()) {
			alert('Monster name is required.');
			return;
		}
		await onMonsterSave(monsterFormData, editingMonsterId);
		showMonsterDrawer = false;
		editingMonsterId = null;
	}

	function submitMonsterForm(e: SubmitEvent) {
		e.preventDefault();
		void saveMonster();
	}

	// Event form handlers
	function openEventForm() {
		editingEventId = null;
		eventFormData = {
			name: '',
			title: '',
			description: null,
			image_path: null,
			order_num: deckCards.length
		};
		showEventDrawer = true;
	}

	function openEventEditForm(card: DeckCard) {
		const event = card.data as Event;
		editingEventId = event.id;
		eventFormData = {
			name: event.name,
			title: event.title,
			description: event.description,
			image_path: event.image_path,
			order_num: event.order_num
		};
		showEventDrawer = true;
	}

	async function saveEvent() {
		if (!eventFormData.name.trim() || !eventFormData.title.trim()) {
			alert('Event name and title are required.');
			return;
		}
		await onEventSave(eventFormData, editingEventId);
		showEventDrawer = false;
		editingEventId = null;
	}

	function submitEventForm(e: SubmitEvent) {
		e.preventDefault();
		void saveEvent();
	}

	function openEditForm(card: DeckCard) {
		if (card.type === 'monster') {
			openMonsterEditForm(card);
		} else {
			openEventEditForm(card);
		}
	}

	function getCardName(card: DeckCard): string {
		if (card.type === 'monster') {
			return (card.data as Monster).name;
		}
		return (card.data as Event).title;
	}

	function getStateColor(state: string | null | undefined): string {
		switch (state) {
			case 'tainted': return '#c084fc';
			case 'corrupt': return '#6b21a8';
			case 'fallen': return '#065f46';
			case 'boss': return '#ef4444';
			default: return '#94a3b8';
		}
	}

	const cardScale = $derived(scalePercent / 100);
	const monsterCount = $derived(deckCards.filter((c) => c.type === 'monster').length);
	const eventCount = $derived(deckCards.filter((c) => c.type === 'event').length);
</script>

<div class="combined-view">
	<!-- Control Bar -->
	<div class="control-bar">
		<div class="control-row">
			<div class="create-buttons">
				<button class="create-btn monster" onclick={openMonsterForm}>
					+ Monster
				</button>
				<button class="create-btn event" onclick={openEventForm}>
					+ Event
				</button>
			</div>

			<div class="filter-control">
				<label class="filter-label">Type:</label>
				<select class="type-select" bind:value={typeFilter}>
					<option value="all">All Cards</option>
					<option value="monster">Monsters</option>
					<option value="event">Events</option>
				</select>
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
						onclick={() => (viewMode = 'grid')}
					>
						Grid
					</button>
					<button
						class="view-btn"
						class:active={viewMode === 'list'}
						onclick={() => (viewMode = 'list')}
					>
						List
					</button>
				</div>
			</div>
		</div>

		<div class="control-row">
			<div class="deck-info">
				<span class="count-badge monster">{monsterCount} Monsters</span>
				<span class="count-badge event">{eventCount} Events</span>
				<span class="count-badge total">{deckCards.length} Total</span>
				{#if typeFilter !== 'all'}
					<span class="count-badge filtered">Showing {filteredDeckCards.length}</span>
				{/if}
			</div>

			<div class="order-controls">
				{#if hasOrderIssues()}
					<button
						class="renumber-btn warning"
						onclick={renumberCards}
						title="Order numbers have gaps or duplicates - click to fix"
					>
						Renumber
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
		</div>
	</div>

	<!-- Cards Grid/List -->
	<div class="deck-cards" class:list-view={viewMode === 'list'}>
		{#each filteredDeckCards as card, index (card.type + '-' + card.id + '-' + (card.copyIndex ?? 0))}
			{@const isDragging = draggedCard?.id === card.id && draggedCard?.type === card.type && draggedCard?.copyIndex === card.copyIndex}
			{@const isDragOver = dragOverIndex === index}
			{@const actualIndex = deckCards.findIndex((c) => c.id === card.id && c.type === card.type && c.copyIndex === card.copyIndex)}

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
				ondragover={(e) => handleDragOver(e, actualIndex)}
				ondragleave={handleDragLeave}
				ondrop={(e) => handleDrop(e, actualIndex)}
				ondragend={handleDragEnd}
			>
				<div class="card-controls">
					<div class="position-info">
						<span class="position-badge">#{actualIndex + 1}</span>
						{#if card.totalCopies && card.totalCopies > 1}
							<span class="copy-badge">{card.copyIndex}/{card.totalCopies}</span>
						{/if}
						<input
							type="number"
							class="position-input"
							min="1"
							max={deckCards.length}
							value={actualIndex + 1}
							onchange={(e) => moveToPosition(actualIndex, parseInt(e.currentTarget.value) - 1)}
							onclick={(e) => e.stopPropagation()}
							title="Move to position"
						/>
					</div>
					<div class="move-buttons">
						<button
							class="move-btn"
							disabled={actualIndex === 0}
							onclick={() => moveCard(actualIndex, 'up')}
							title="Move up"
						>
							↑
						</button>
						<button
							class="move-btn"
							disabled={actualIndex === deckCards.length - 1}
							onclick={() => moveCard(actualIndex, 'down')}
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
										insertAfter(actualIndex, value);
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
									insertAfter(actualIndex, value);
									input.value = '';
								}
							}}
							title="Insert after card # (enter 0 to move to beginning)"
						>
							Insert
						</button>
					</div>
					<button class="edit-btn" onclick={() => openEditForm(card)} title="Edit card">
						Edit
					</button>
					<span class="card-type-badge">
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
							<span class="card-state" style="--state-color: {getStateColor(monster.state)}">
								{monster.state}
							</span>
						{/if}
					</div>
				{/if}

				<div class="drag-handle" title="Drag to reorder">⋮⋮</div>
			</div>
		{/each}
	</div>

	{#if filteredDeckCards.length === 0}
		<div class="empty-state">
			{#if typeFilter === 'all'}
				No cards in deck. Click "+ Monster" or "+ Event" to add cards.
			{:else}
				No {typeFilter}s in deck.
			{/if}
		</div>
	{/if}
</div>

<!-- Monster Drawer -->
{#if showMonsterDrawer}
	<div
		class="drawer-backdrop"
		role="button"
		tabindex="0"
		onclick={() => (showMonsterDrawer = false)}
		onkeydown={(e) => e.key === 'Escape' && (showMonsterDrawer = false)}
	>
		<div class="drawer" role="dialog" onclick={(e) => e.stopPropagation()}>
			<div class="drawer-header">
				<h2>{isEditingMonster ? 'Edit Monster' : 'Create Monster'}</h2>
				<button class="close-btn" onclick={() => (showMonsterDrawer = false)}>&times;</button>
			</div>
			<div class="drawer-content">
				<form id="monster-form" class="form-grid" onsubmit={submitMonsterForm}>
					<FormField label="Name" required>
						<Input type="text" bind:value={monsterFormData.name} required />
					</FormField>
					<FormField label="Damage">
						<Input type="number" min={0} bind:value={monsterFormData.damage} />
					</FormField>
					<FormField label="Barrier">
						<Input type="number" min={0} bind:value={monsterFormData.barrier} />
					</FormField>
					<FormField label="Quantity" helperText="Copies in deck">
						<Input type="number" min={1} bind:value={monsterFormData.quantity} />
					</FormField>
					<FormField label="State">
						<Select
							bind:value={monsterFormData.state}
							options={[
								{ value: 'tainted', label: 'Tainted' },
								{ value: 'corrupt', label: 'Corrupt' },
								{ value: 'fallen', label: 'Fallen' },
								{ value: 'arcane', label: 'Arcane' },
								{ value: 'boss', label: 'Boss' }
							]}
						/>
					</FormField>
					<FormField label="Icon (emoji)">
						<Input type="text" bind:value={monsterFormData.icon} placeholder="👹" />
					</FormField>
					<div class="full-width">
						<FormField label="Special Conditions">
							<Textarea rows={2} bind:value={monsterFormData.special_conditions} />
						</FormField>
					</div>
					<div class="full-width">
						<FormField label="Special Effects">
							<SpecialEffectPicker bind:selected={monsterFormData.special_effect_ids} maxSelection={4} />
						</FormField>
					</div>
					<div class="full-width">
						<RewardRowsEditor bind:rewardRows={monsterFormData.reward_rows} />
					</div>
				</form>
			</div>
			<div class="drawer-footer">
				<Button variant="primary" type="submit" form="monster-form">
					{isEditingMonster ? 'Update' : 'Create'}
				</Button>
				<Button onclick={() => (showMonsterDrawer = false)}>Cancel</Button>
			</div>
		</div>
	</div>
{/if}

<!-- Event Drawer -->
{#if showEventDrawer}
	<div
		class="drawer-backdrop"
		role="button"
		tabindex="0"
		onclick={() => (showEventDrawer = false)}
		onkeydown={(e) => e.key === 'Escape' && (showEventDrawer = false)}
	>
		<div class="drawer" role="dialog" onclick={(e) => e.stopPropagation()}>
			<div class="drawer-header">
				<h2>{isEditingEvent ? 'Edit Event' : 'Create Event'}</h2>
				<button class="close-btn" onclick={() => (showEventDrawer = false)}>&times;</button>
			</div>
			<div class="drawer-content">
				<form id="event-form" class="form-grid" onsubmit={submitEventForm}>
					<div class="full-width">
						<FormField label="Name (Internal)" required>
							<Input type="text" bind:value={eventFormData.name} required placeholder="Internal reference" />
						</FormField>
					</div>
					<div class="full-width">
						<FormField label="Title (Displayed)" required>
							<Input type="text" bind:value={eventFormData.title} required placeholder="Card title" />
						</FormField>
					</div>
					<div class="full-width">
						<FormField label="Description">
							<Textarea rows={4} bind:value={eventFormData.description} placeholder="Event description..." />
						</FormField>
					</div>
				</form>
			</div>
			<div class="drawer-footer">
				<Button variant="primary" type="submit" form="event-form">
					{isEditingEvent ? 'Update' : 'Create'}
				</Button>
				<Button onclick={() => (showEventDrawer = false)}>Cancel</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	.combined-view {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.control-bar {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
	}

	.control-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.create-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.create-btn {
		padding: 0.4rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.create-btn.monster {
		background: rgba(168, 85, 247, 0.2);
		border: 1px solid rgba(168, 85, 247, 0.4);
		color: #c084fc;
	}

	.create-btn.monster:hover {
		background: rgba(168, 85, 247, 0.3);
		border-color: rgba(168, 85, 247, 0.6);
	}

	.create-btn.event {
		background: rgba(59, 130, 246, 0.2);
		border: 1px solid rgba(59, 130, 246, 0.4);
		color: #60a5fa;
	}

	.create-btn.event:hover {
		background: rgba(59, 130, 246, 0.3);
		border-color: rgba(59, 130, 246, 0.6);
	}

	.filter-control {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.filter-label {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.type-select {
		padding: 0.35rem 0.5rem;
		font-size: 0.75rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 6px;
		color: #f8fafc;
		cursor: pointer;
	}

	.type-select:focus {
		outline: none;
		border-color: #a855f7;
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

	.scale-control input[type='range'] {
		width: 100px;
		height: 4px;
		-webkit-appearance: none;
		appearance: none;
		background: rgba(148, 163, 184, 0.3);
		border-radius: 2px;
		cursor: pointer;
	}

	.scale-control input[type='range']::-webkit-slider-thumb {
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

	.count-badge.filtered {
		background: rgba(34, 197, 94, 0.2);
		color: #4ade80;
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.order-controls {
		display: flex;
		gap: 0.5rem;
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

	.copy-badge {
		font-size: 0.6rem;
		font-weight: 600;
		color: #fbbf24;
		background: rgba(251, 191, 36, 0.15);
		border: 1px solid rgba(251, 191, 36, 0.3);
		padding: 0.15rem 0.35rem;
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

	.list-view .insert-after-control {
		margin-left: 0;
		padding-left: 0;
		border-left: none;
		margin-top: 0.25rem;
		padding-top: 0.25rem;
		border-top: 1px solid rgba(148, 163, 184, 0.2);
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

	.edit-btn {
		padding: 0.2rem 0.5rem;
		font-size: 0.65rem;
		font-weight: 600;
		background: rgba(59, 130, 246, 0.2);
		border: 1px solid rgba(59, 130, 246, 0.3);
		border-radius: 4px;
		color: #60a5fa;
		cursor: pointer;
		transition: all 0.15s;
	}

	.edit-btn:hover {
		background: rgba(59, 130, 246, 0.3);
		border-color: rgba(59, 130, 246, 0.5);
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

	/* Drawer Styles */
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.drawer {
		background: #0f172a;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		width: 90%;
		max-width: 600px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.drawer-header {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: rgba(15, 23, 42, 0.8);
	}

	.drawer-header h2 {
		margin: 0;
		font-size: 1rem;
		color: #f8fafc;
	}

	.close-btn {
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.15s;
	}

	.close-btn:hover {
		background: rgba(148, 163, 184, 0.1);
		color: #f8fafc;
	}

	.drawer-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}

	.drawer-footer {
		padding: 0.75rem 1rem;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		background: rgba(15, 23, 42, 0.8);
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.5rem;
	}

	.form-grid .full-width {
		grid-column: 1 / -1;
	}

	@media (max-width: 768px) {
		.control-row {
			flex-direction: column;
			align-items: stretch;
		}

		.create-buttons,
		.filter-control,
		.view-controls,
		.deck-info,
		.order-controls {
			justify-content: center;
		}

		.view-controls {
			flex-wrap: wrap;
		}
	}
</style>
