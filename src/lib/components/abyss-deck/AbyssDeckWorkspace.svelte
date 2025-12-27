<script lang="ts">
	import type { SpecialEffectRow } from '$lib/types/gameData';
	import { getIconPoolUrl } from '$lib/utils/iconPool';
	import { getErrorMessage } from '$lib/utils';
	import { MonsterCardPreview, RewardRowsEditor } from '$lib/components/monsters';
	import { Button, FormField, Input, Select, Textarea } from '$lib/components/ui';
	import { ConfirmDialog, SpecialEffectPicker } from '$lib/components/shared';
	import EventCardPreview from './EventCardPreview.svelte';
	import type { Event, Monster, ResolvedRewardRow } from './types';

	export type DeckOrderItem = {
		type: 'monster' | 'event';
		id: string;
	};

	export type MonsterFormData = {
		name: string;
		damage: number;
		barrier: number;
		state: 'tainted' | 'corrupt' | 'fallen' | 'boss';
		icon: string | null;
		image_path: string | null;
		invade_location_id: string | null;
		order_num: number;
		reward_rows: any[];
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
		locations: { id: string; name: string }[];
		specialEffects: SpecialEffectRow[];
		monsterSpecialEffects: Record<string, string[]>;
		onMonsterSave: (formData: MonsterFormData, id: string | null) => Promise<string>;
		onEventSave: (formData: EventFormData, id: string | null) => Promise<string>;
		onMonsterDelete: (id: string) => Promise<void>;
		onEventDelete: (id: string) => Promise<void>;
		onSaveDeckOrder: (order: DeckOrderItem[]) => Promise<void>;
	}

	let {
		monsters,
		events,
		locations,
		specialEffects,
		monsterSpecialEffects,
		onMonsterSave,
		onEventSave,
		onMonsterDelete,
		onEventDelete,
		onSaveDeckOrder
	}: Props = $props();

	function keyToString(k: DeckOrderItem) {
		return `${k.type}:${k.id}`;
	}

	function buildCanonicalOrder(m: Monster[], e: Event[]): DeckOrderItem[] {
		return [
			...m.map((monster) => ({ type: 'monster' as const, id: monster.id, order_num: monster.order_num ?? 0 })),
			...e.map((event) => ({ type: 'event' as const, id: event.id, order_num: event.order_num ?? 0 }))
		]
			.sort((a, b) => a.order_num - b.order_num)
			.map(({ type, id }) => ({ type, id }));
	}

	function isSameOrder(a: DeckOrderItem[], b: DeckOrderItem[]) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i].type !== b[i].type) return false;
			if (a[i].id !== b[i].id) return false;
		}
		return true;
	}

	let deckOrder = $state<DeckOrderItem[]>([]);
	let orderChanged = $state(false);
	let savingOrder = $state(false);

	$effect(() => {
		const canonical = buildCanonicalOrder(monsters, events);

		if (deckOrder.length === 0) {
			deckOrder = canonical;
			orderChanged = false;
			return;
		}

		if (!orderChanged) {
			if (!isSameOrder(deckOrder, canonical)) {
				deckOrder = canonical;
			}
			return;
		}

		const canonicalSet = new Set(canonical.map(keyToString));
		const kept = deckOrder.filter((k) => canonicalSet.has(keyToString(k)));
		const keptSet = new Set(kept.map(keyToString));
		const appended = canonical.filter((k) => !keptSet.has(keyToString(k)));
		const reconciled = [...kept, ...appended];

		if (!isSameOrder(deckOrder, reconciled)) {
			deckOrder = reconciled;
		}
	});

	const monsterById = $derived.by(() => new Map(monsters.map((m) => [m.id, m])));
	const eventById = $derived.by(() => new Map(events.map((e) => [e.id, e])));

	// UI state
	let typeFilter = $state<'all' | 'monster' | 'event'>('all');
	let searchQuery = $state('');
	let scalePercent = $state(55);

	// Editor selection/state
	let editorType = $state<'monster' | 'event' | null>(null);
	let editingId = $state<string | null>(null);

	// Delete confirm
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<{ type: 'monster' | 'event'; id: string; label: string } | null>(null);
	let deleting = $state(false);

	// Drag state (full-order indices)
	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	// Forms
	let monsterFormData = $state<MonsterFormData>({
		name: '',
		damage: 0,
		barrier: 0,
		state: 'tainted',
		icon: null,
		image_path: null,
		invade_location_id: null,
		order_num: 0,
		reward_rows: [],
		special_effect_ids: [],
		quantity: 1
	});

	let eventFormData = $state<EventFormData>({
		name: '',
		title: '',
		description: null,
		image_path: null,
		order_num: 0
	});

	const selectedKey = $derived(editorType && editingId ? `${editorType}:${editingId}` : null);

	function getGroupLabel(type: 'monster' | 'event', id: string): string {
		if (type === 'monster') {
			return monsterById.get(id)?.name ?? 'Unknown Monster';
		}
		const event = eventById.get(id);
		return event?.title ?? event?.name ?? 'Unknown Event';
	}

	function openNewMonster() {
		editorType = 'monster';
		editingId = null;
		monsterFormData = {
			name: '',
			damage: 0,
			barrier: 0,
			state: 'tainted',
			icon: null,
			image_path: null,
			invade_location_id: null,
			order_num: deckOrder.length,
			reward_rows: [],
			special_effect_ids: [],
			quantity: 1
		};
	}

	function openNewEvent() {
		editorType = 'event';
		editingId = null;
		eventFormData = {
			name: '',
			title: '',
			description: null,
			image_path: null,
			order_num: deckOrder.length
		};
	}

	function openEdit(type: 'monster' | 'event', id: string) {
		editorType = type;
		editingId = id;

		if (type === 'monster') {
			const monster = monsterById.get(id);
			if (!monster) return;
			monsterFormData = {
				name: monster.name,
				damage: monster.damage,
				barrier: monster.barrier,
				state: monster.state,
				icon: monster.icon,
				image_path: monster.image_path,
				invade_location_id: monster.invade_location_id ?? null,
				order_num: monster.order_num,
				reward_rows: monster.reward_rows ?? [],
				special_effect_ids: monsterSpecialEffects[monster.id] ?? [],
				quantity: monster.quantity ?? 1
			};
		} else {
			const event = eventById.get(id);
			if (!event) return;
			eventFormData = {
				name: event.name,
				title: event.title,
				description: event.description,
				image_path: event.image_path,
				order_num: event.order_num
			};
		}
	}

	function closeEditor() {
		editorType = null;
		editingId = null;
	}

	function requestDelete(type: 'monster' | 'event', id: string) {
		deleteTarget = { type, id, label: getGroupLabel(type, id) };
		showDeleteConfirm = true;
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			if (deleteTarget.type === 'monster') {
				await onMonsterDelete(deleteTarget.id);
			} else {
				await onEventDelete(deleteTarget.id);
			}

			// Remove from local order and immediately normalize order numbers in DB.
			deckOrder = deckOrder.filter((k) => !(k.type === deleteTarget!.type && k.id === deleteTarget!.id));
			orderChanged = true;
			await saveDeckOrder();

			if (editorType === deleteTarget.type && editingId === deleteTarget.id) {
				closeEditor();
			}
		} catch (err) {
			alert(`Failed to delete: ${getErrorMessage(err)}`);
		} finally {
			deleting = false;
			deleteTarget = null;
			showDeleteConfirm = false;
		}
	}

	function handleDragStart(e: DragEvent, fullIndex: number) {
		draggedIndex = fullIndex;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', '');
		}
	}

	function handleDragOver(e: DragEvent, fullIndex: number) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dragOverIndex = fullIndex;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleDrop(e: DragEvent, dropIndex: number) {
		e.preventDefault();
		if (draggedIndex === null) return;
		if (draggedIndex === dropIndex) {
			draggedIndex = null;
			dragOverIndex = null;
			return;
		}

		const next = [...deckOrder];
		const [removed] = next.splice(draggedIndex, 1);
		next.splice(dropIndex, 0, removed);
		deckOrder = next;
		orderChanged = true;
		draggedIndex = null;
		dragOverIndex = null;
	}

	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
	}

	function moveGroup(fromIndex: number, direction: 'up' | 'down') {
		const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
		if (toIndex < 0 || toIndex >= deckOrder.length) return;
		const next = [...deckOrder];
		const [removed] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, removed);
		deckOrder = next;
		orderChanged = true;
	}

	function resetOrder() {
		deckOrder = buildCanonicalOrder(monsters, events);
		orderChanged = false;
	}

	async function saveDeckOrder() {
		if (!orderChanged || savingOrder) return;
		savingOrder = true;
		try {
			await onSaveDeckOrder(deckOrder);
			orderChanged = false;
		} catch (err) {
			alert(`Failed to save deck order: ${getErrorMessage(err)}`);
		} finally {
			savingOrder = false;
		}
	}

	async function saveMonster() {
		if (!monsterFormData.name.trim()) {
			alert('Monster name is required.');
			return;
		}

		try {
			const id = await onMonsterSave(monsterFormData, editingId);
			if (!editingId) {
				deckOrder = [...deckOrder, { type: 'monster', id }];
			}
			editorType = 'monster';
			editingId = id;
			orderChanged = true;
			await saveDeckOrder();
		} catch (err) {
			alert(`Failed to save monster: ${getErrorMessage(err)}`);
		}
	}

	async function saveEvent() {
		if (!eventFormData.name.trim() || !eventFormData.title.trim()) {
			alert('Event name and title are required.');
			return;
		}

		try {
			const id = await onEventSave(eventFormData, editingId);
			if (!editingId) {
				deckOrder = [...deckOrder, { type: 'event', id }];
			}
			editorType = 'event';
			editingId = id;
			orderChanged = true;
			await saveDeckOrder();
		} catch (err) {
			alert(`Failed to save event: ${getErrorMessage(err)}`);
		}
	}

	const scale = $derived(scalePercent / 100);
	const totalGroups = $derived(deckOrder.length);
	const totalPhysicalCards = $derived.by(() => {
		let count = 0;
		for (const item of deckOrder) {
			if (item.type === 'monster') {
				count += monsterById.get(item.id)?.quantity ?? 1;
			} else {
				count += 1;
			}
		}
		return count;
	});

	const visibleGroups = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		return deckOrder
			.map((item, orderIndex) => ({ item, orderIndex }))
			.filter(({ item }) => {
				if (typeFilter !== 'all' && item.type !== typeFilter) return false;
				if (!query) return true;
				const label = getGroupLabel(item.type, item.id).toLowerCase();
				return label.includes(query);
			});
	});

	const selectedMonsterPreview = $derived.by(() => {
		if (editorType !== 'monster') return null;
		if (!editingId) {
			const resolvedRewardRows: ResolvedRewardRow[] = (monsterFormData.reward_rows ?? []).map((row: any) => ({
				...row,
				icon_urls: (row.icon_ids ?? []).map((id: string) => getIconPoolUrl(id))
			}));

			const effects = monsterFormData.special_effect_ids
				.map((id) => specialEffects.find((e) => e.id === id))
				.filter((e): e is SpecialEffectRow => e !== undefined);

			return {
				id: 'new',
				name: monsterFormData.name || 'New Monster',
				damage: monsterFormData.damage,
				barrier: monsterFormData.barrier,
				state: monsterFormData.state,
				icon: monsterFormData.icon,
				image_path: monsterFormData.image_path,
				invade_location_id: monsterFormData.invade_location_id,
				order_num: monsterFormData.order_num,
				card_image_path: null,
				reward_rows: monsterFormData.reward_rows as any,
				special_conditions: null,
				quantity: monsterFormData.quantity,
				created_at: null,
				updated_at: null,
				icon_url: null,
				art_url: null,
				resolved_reward_rows: resolvedRewardRows,
				effects
			} satisfies Monster;
		}

		const monster = monsterById.get(editingId);
		if (!monster) return null;
		const resolvedRewardRows: ResolvedRewardRow[] = (monsterFormData.reward_rows ?? []).map((row: any) => ({
			...row,
			icon_urls: (row.icon_ids ?? []).map((id: string) => getIconPoolUrl(id))
		}));

		const effects = monsterFormData.special_effect_ids
			.map((id) => specialEffects.find((e) => e.id === id))
			.filter((e): e is SpecialEffectRow => e !== undefined);

		return {
			...monster,
			name: monsterFormData.name,
			damage: monsterFormData.damage,
			barrier: monsterFormData.barrier,
			state: monsterFormData.state,
			icon: monsterFormData.icon,
			image_path: monsterFormData.image_path,
			invade_location_id: monsterFormData.invade_location_id,
			reward_rows: monsterFormData.reward_rows as any,
			quantity: monsterFormData.quantity,
			resolved_reward_rows: resolvedRewardRows,
			effects
		} satisfies Monster;
	});

	const selectedEventPreview = $derived.by(() => {
		if (editorType !== 'event') return null;

		const orderIndex = editingId ? deckOrder.findIndex((k) => k.type === 'event' && k.id === editingId) : deckOrder.length;
		const safeOrderNum = Math.max(0, orderIndex);

		if (!editingId) {
			return {
				id: 'new',
				name: eventFormData.name || 'new_event',
				title: eventFormData.title || 'New Event',
				description: eventFormData.description,
				image_path: eventFormData.image_path,
				card_image_path: null,
				order_num: safeOrderNum,
				created_at: null,
				updated_at: null,
				art_url: null
			} satisfies Event;
		}

		const event = eventById.get(editingId);
		if (!event) return null;

		return {
			...event,
			name: eventFormData.name,
			title: eventFormData.title,
			description: eventFormData.description,
			image_path: eventFormData.image_path,
			order_num: safeOrderNum
		} satisfies Event;
	});
</script>

<div class="workspace">
	<section class="deck">
		<header class="deck-toolbar">
			<div class="toolbar-left">
				<Button variant="primary" onclick={openNewMonster}>+ Monster</Button>
				<Button variant="primary" onclick={openNewEvent}>+ Event</Button>
				{#if orderChanged}
					<Button variant="secondary" onclick={resetOrder} disabled={savingOrder}>Reset</Button>
					<Button variant="primary" onclick={saveDeckOrder} disabled={savingOrder}>
						{savingOrder ? 'Saving…' : 'Save Order'}
					</Button>
				{/if}
			</div>
			<div class="toolbar-right">
				<div class="counts">
					<span class="badge">{totalGroups} entries</span>
					<span class="badge">{totalPhysicalCards} cards</span>
				</div>
				<input
					type="text"
					class="search"
					placeholder="Search…"
					bind:value={searchQuery}
				/>
				<select class="select" bind:value={typeFilter}>
					<option value="all">All</option>
					<option value="monster">Monsters</option>
					<option value="event">Events</option>
				</select>
				<label class="scale">
					<span>Scale</span>
					<input type="range" min="35" max="80" step="5" bind:value={scalePercent} />
					<span class="scale-val">{scalePercent}%</span>
				</label>
			</div>
		</header>

		<div class="deck-list" role="list">
			{#each visibleGroups as { item, orderIndex } (item.type + ':' + item.id)}
				{@const isDragging = draggedIndex === orderIndex}
				{@const isDragOver = dragOverIndex === orderIndex}
				{@const isSelected = selectedKey === `${item.type}:${item.id}`}
				{@const monster = item.type === 'monster' ? monsterById.get(item.id) : null}
				{@const event = item.type === 'event' ? eventById.get(item.id) : null}
				{@const copies = item.type === 'monster' ? (monster?.quantity ?? 1) : 1}

				<div
					class="group"
					class:selected={isSelected}
					class:dragging={isDragging}
					class:drag-over={isDragOver}
					draggable="true"
					role="listitem"
					ondragstart={(e) => handleDragStart(e, orderIndex)}
					ondragover={(e) => handleDragOver(e, orderIndex)}
					ondragleave={handleDragLeave}
					ondrop={(e) => handleDrop(e, orderIndex)}
					ondragend={handleDragEnd}
				>
					<div class="group-header">
						<div class="group-meta">
							<span class="pos">#{orderIndex + 1}</span>
							<span class="type">{item.type === 'monster' ? '👹 Monster' : '⚡ Event'}</span>
							<span class="name">{getGroupLabel(item.type, item.id)}</span>
							{#if item.type === 'monster' && copies > 1}
								<span class="copies">x{copies}</span>
							{/if}
						</div>

						<div class="group-actions">
							<button class="btn" onclick={() => openEdit(item.type, item.id)}>Edit</button>
							<button class="btn danger" onclick={() => requestDelete(item.type, item.id)}>Delete</button>
							<button class="btn" disabled={orderIndex === 0} onclick={() => moveGroup(orderIndex, 'up')}>
								↑
							</button>
							<button
								class="btn"
								disabled={orderIndex === deckOrder.length - 1}
								onclick={() => moveGroup(orderIndex, 'down')}
							>
								↓
							</button>
							<span class="drag-handle" title="Drag to reorder">⋮⋮</span>
						</div>
					</div>

					<div class="group-copies">
						{#if item.type === 'monster' && monster}
							{#each Array.from({ length: copies }, (_, i) => i) as idx (idx)}
								<div
									class="copy"
									class:selected={isSelected}
									style="--scale: {scale}; width: {600 * scale}px; height: {437 * scale}px;"
									role="button"
									tabindex="0"
									onclick={() => openEdit('monster', item.id)}
									onkeydown={(e) => e.key === 'Enter' && openEdit('monster', item.id)}
								>
									{#if copies > 1}
										<div class="copy-badge">{idx + 1}/{copies}</div>
									{/if}
									<div class="copy-inner">
										<MonsterCardPreview monster={monster} />
									</div>
								</div>
							{/each}
						{:else if item.type === 'event' && event}
							<div
								class="copy"
								class:selected={isSelected}
								style="--scale: {scale}; width: {600 * scale}px; height: {364 * scale}px;"
								role="button"
								tabindex="0"
								onclick={() => openEdit('event', item.id)}
								onkeydown={(e) => e.key === 'Enter' && openEdit('event', item.id)}
							>
								<div class="copy-inner">
									<EventCardPreview event={{ ...event, order_num: orderIndex }} />
								</div>
							</div>
						{:else}
							<div class="missing">Missing data</div>
						{/if}
					</div>
				</div>
			{/each}

			{#if visibleGroups.length === 0}
				<div class="empty">No matching cards.</div>
			{/if}
		</div>
	</section>

	<aside class="editor">
		{#if editorType === null}
			<div class="editor-empty">
				<h3>Deck Editor</h3>
				<p>Select a card to edit, or create a new one.</p>
				<div class="editor-empty-actions">
					<Button variant="primary" onclick={openNewMonster}>+ Monster</Button>
					<Button variant="primary" onclick={openNewEvent}>+ Event</Button>
				</div>
			</div>
		{:else if editorType === 'monster'}
			<div class="editor-header">
				<h3>{editingId ? 'Edit Monster' : 'New Monster'}</h3>
				<button class="icon-btn" onclick={closeEditor} title="Close">✕</button>
			</div>

			{#if selectedMonsterPreview}
				<div class="editor-preview" style="--scale: 0.55; width: {600 * 0.55}px; height: {437 * 0.55}px;">
					<div class="copy-inner">
						<MonsterCardPreview monster={selectedMonsterPreview} />
					</div>
				</div>
			{/if}

			<form class="editor-form" onsubmit={(e) => (e.preventDefault(), void saveMonster())}>
				<FormField label="Name" required>
					<Input type="text" bind:value={monsterFormData.name} required />
				</FormField>

				<div class="grid-2">
					<FormField label="Damage">
						<Input type="number" min={0} bind:value={monsterFormData.damage} />
					</FormField>
					<FormField label="Barrier">
						<Input type="number" min={0} bind:value={monsterFormData.barrier} />
					</FormField>
				</div>

				<div class="grid-2">
					<FormField label="Quantity" hint="Copies in deck">
						<Input type="number" min={1} bind:value={monsterFormData.quantity} />
					</FormField>
					<FormField label="State">
						<Select
							bind:value={monsterFormData.state}
							options={[
								{ value: 'tainted', label: 'Tainted' },
								{ value: 'corrupt', label: 'Corrupt' },
								{ value: 'fallen', label: 'Fallen' },
								{ value: 'boss', label: 'Boss' }
							]}
						/>
					</FormField>
				</div>

				<FormField label="Icon (emoji)">
					<Input type="text" bind:value={monsterFormData.icon} placeholder="👹" />
				</FormField>

				<FormField label="Invade Location (optional)">
					<Select
						value={monsterFormData.invade_location_id ?? ''}
						options={[
							{ value: '', label: 'None' },
							...locations.map((loc) => ({ value: loc.id, label: loc.name }))
						]}
						onchange={(e) => {
							const v = (e.target as HTMLSelectElement).value;
							monsterFormData.invade_location_id = v === '' ? null : v;
						}}
					/>
				</FormField>

				<FormField label="Special Effects">
					<SpecialEffectPicker bind:selected={monsterFormData.special_effect_ids} maxSelection={4} />
				</FormField>

				<div class="full-width">
					<RewardRowsEditor bind:rewardRows={monsterFormData.reward_rows} />
				</div>

				<div class="editor-actions">
					<Button variant="primary" type="submit">Save</Button>
					<Button type="button" onclick={closeEditor}>Close</Button>
					{#if editingId}
						<Button type="button" variant="danger" onclick={() => requestDelete('monster', editingId)}>
							Delete
						</Button>
					{/if}
				</div>
			</form>
		{:else}
			<div class="editor-header">
				<h3>{editingId ? 'Edit Event' : 'New Event'}</h3>
				<button class="icon-btn" onclick={closeEditor} title="Close">✕</button>
			</div>

			{#if selectedEventPreview}
				<div class="editor-preview" style="--scale: 0.62; width: {600 * 0.62}px; height: {364 * 0.62}px;">
					<div class="copy-inner">
						<EventCardPreview event={selectedEventPreview} />
					</div>
				</div>
			{/if}

			<form class="editor-form" onsubmit={(e) => (e.preventDefault(), void saveEvent())}>
				<FormField label="Name (Internal)" required>
					<Input type="text" bind:value={eventFormData.name} required />
				</FormField>
				<FormField label="Title (Displayed)" required>
					<Input type="text" bind:value={eventFormData.title} required />
				</FormField>
				<FormField label="Description">
					<Textarea rows={4} bind:value={eventFormData.description} />
				</FormField>

				<div class="editor-actions">
					<Button variant="primary" type="submit">Save</Button>
					<Button type="button" onclick={closeEditor}>Close</Button>
					{#if editingId}
						<Button type="button" variant="danger" onclick={() => requestDelete('event', editingId)}>
							Delete
						</Button>
					{/if}
				</div>
			</form>
		{/if}
	</aside>
</div>

<ConfirmDialog
	bind:open={showDeleteConfirm}
	title="Delete card?"
	message={deleteTarget ? `Delete “${deleteTarget.label}”? This cannot be undone.` : 'Delete this card?'}
	confirmLabel={deleting ? 'Deleting…' : 'Delete'}
	cancelLabel="Cancel"
	variant="danger"
	onconfirm={() => void confirmDelete()}
	oncancel={() => (deleteTarget = null)}
/>

<style>
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 420px;
		gap: 0.75rem;
		height: 100%;
		min-height: 0;
	}

	.deck {
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: rgba(2, 6, 23, 0.25);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 10px;
		overflow: hidden;
	}

	.deck-toolbar {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		background: rgba(15, 23, 42, 0.6);
		border-bottom: 1px solid rgba(148, 163, 184, 0.12);
		flex-wrap: wrap;
	}

	.toolbar-left,
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.counts {
		display: flex;
		gap: 0.35rem;
	}

	.badge {
		padding: 0.2rem 0.45rem;
		font-size: 0.7rem;
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(30, 41, 59, 0.4);
		color: #cbd5e1;
	}

	.search {
		padding: 0.4rem 0.6rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.6);
		color: #f8fafc;
		font-size: 0.85rem;
		min-width: 220px;
	}

	.search:focus {
		outline: none;
		border-color: rgba(168, 85, 247, 0.6);
	}

	.select {
		padding: 0.4rem 0.5rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.6);
		color: #f8fafc;
		font-size: 0.85rem;
	}

	.scale {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.scale input[type='range'] {
		width: 120px;
	}

	.scale-val {
		min-width: 44px;
		text-align: right;
	}

	.deck-list {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.group {
		border: 2px solid rgba(148, 163, 184, 0.12);
		border-radius: 12px;
		background: rgba(30, 41, 59, 0.35);
		padding: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.group.selected {
		border-color: rgba(168, 85, 247, 0.55);
		box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.25) inset;
	}

	.group.dragging {
		opacity: 0.55;
	}

	.group.drag-over {
		border-color: rgba(59, 130, 246, 0.55);
	}

	.group-header {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.group-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.pos {
		font-size: 0.75rem;
		font-weight: 800;
		color: #e2e8f0;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		padding: 0.15rem 0.4rem;
	}

	.type {
		font-size: 0.75rem;
		color: #94a3b8;
		white-space: nowrap;
	}

	.name {
		font-size: 0.85rem;
		font-weight: 700;
		color: #f8fafc;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 520px;
	}

	.copies {
		font-size: 0.7rem;
		font-weight: 700;
		color: #c084fc;
		background: rgba(168, 85, 247, 0.15);
		border: 1px solid rgba(168, 85, 247, 0.25);
		border-radius: 999px;
		padding: 0.15rem 0.4rem;
		white-space: nowrap;
	}

	.group-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.btn {
		padding: 0.25rem 0.5rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(15, 23, 42, 0.55);
		color: #cbd5e1;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.btn:hover {
		border-color: rgba(59, 130, 246, 0.4);
		background: rgba(59, 130, 246, 0.12);
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn.danger {
		border-color: rgba(248, 113, 113, 0.35);
		background: rgba(248, 113, 113, 0.12);
		color: #fecaca;
	}

	.btn.danger:hover {
		background: rgba(248, 113, 113, 0.18);
		border-color: rgba(248, 113, 113, 0.5);
	}

	.drag-handle {
		color: #64748b;
		padding: 0 0.25rem;
		user-select: none;
		cursor: grab;
	}

	.group-copies {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
		align-items: flex-start;
	}

	.copy {
		position: relative;
		border-radius: 10px;
		border: 2px solid transparent;
	}

	.copy.selected {
		border-color: rgba(168, 85, 247, 0.55);
	}

	.copy-inner {
		transform: scale(var(--scale));
		transform-origin: top left;
	}

	.copy-badge {
		position: absolute;
		top: 8px;
		left: 8px;
		z-index: 10;
		padding: 0.2rem 0.4rem;
		border-radius: 999px;
		font-size: 0.7rem;
		font-weight: 700;
		background: rgba(15, 23, 42, 0.75);
		border: 1px solid rgba(148, 163, 184, 0.25);
		color: #e2e8f0;
	}

	.missing,
	.empty {
		padding: 1rem;
		text-align: center;
		color: #94a3b8;
	}

	.editor {
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: rgba(2, 6, 23, 0.25);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 10px;
		overflow: hidden;
	}

	.editor-empty {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.editor-empty h3 {
		margin: 0;
		font-size: 0.95rem;
	}

	.editor-empty p {
		margin: 0;
		color: #94a3b8;
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.editor-empty-actions {
		display: flex;
		gap: 0.5rem;
	}

	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.75rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.12);
		background: rgba(15, 23, 42, 0.6);
	}

	.editor-header h3 {
		margin: 0;
		font-size: 0.95rem;
	}

	.icon-btn {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(30, 41, 59, 0.5);
		color: #cbd5e1;
		cursor: pointer;
	}

	.icon-btn:hover {
		background: rgba(59, 130, 246, 0.15);
		border-color: rgba(59, 130, 246, 0.35);
	}

	.editor-preview {
		padding: 0.75rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.12);
		display: flex;
		justify-content: center;
		align-items: flex-start;
	}

	.editor-preview .copy-inner {
		transform: scale(var(--scale));
		transform-origin: top left;
	}

	.editor-form {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.full-width {
		width: 100%;
	}

	.editor-actions {
		margin-top: 0.25rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	@media (max-width: 1100px) {
		.workspace {
			grid-template-columns: 1fr;
		}

		.editor {
			min-height: 420px;
		}
	}
</style>
