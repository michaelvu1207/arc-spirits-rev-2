<script lang="ts">
	import { onMount } from 'svelte';
	import type { EditionRow, OriginRow, HexSpiritRow } from '$lib/types/gameData';
	import { Modal, PageLayout, type Tab } from '$lib/components/layout';
	import { Button, FormField, Input, Textarea } from '$lib/components/ui';
	import { NumberControl } from '$lib/components/shared';
	import { EditionsListView, EditionsTableView, EditionDetails } from '$lib/components/editions';
	import { useFormModal, useLookup } from '$lib/composables';
	import { getErrorMessage, publicAssetUrl } from '$lib/utils';
	import {
		deleteEditionRecord,
		emptyEditionForm,
		fetchEditionRecords,
		editionRowToForm,
		saveEditionRecord,
		DEFAULT_COST_DUPLICATES,
		type EditionFormData
	} from '$lib/features/editions/editions';
	import { fetchOriginRecords } from '$lib/features/origins/origins';
	import { fetchHexSpiritRecords } from '$lib/features/hex-spirits/hexSpirits';

	let editions: EditionRow[] = $state([]);
	let origins: OriginRow[] = $state([]);
	let hexSpirits: HexSpiritRow[] = $state([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedEditionId = $state<string | null>(null);

	// Tab state
	const tabs: Tab[] = [
		{ id: 'list', label: 'Data: List', icon: '📋' },
		{ id: 'table', label: 'Data: Table', icon: '📊' },
		{ id: 'details', label: 'Edition Details', icon: '📈' }
	];
	let activeTab = $state('list');

	const modal = useFormModal<EditionFormData>(emptyEditionForm());
	const originLookup = useLookup(() => origins);

	const ALL_COSTS = ['1', '3', '4', '5', '7', '9', '11', '13', '15', '17'];

	const selectedEdition = $derived(editions.find((e) => e.id === selectedEditionId) ?? null);

	const filteredSpirits = $derived(
		selectedEdition
			? hexSpirits.filter((spirit) => {
					if (!spirit.is_enabled) return false;
					const spiritOriginIds = spirit.traits?.origin_ids ?? [];
					return spiritOriginIds.some((oid) => selectedEdition.origin_ids.includes(oid));
				})
			: []
	);

	const spiritsByCost = $derived(
		filteredSpirits.reduce(
			(acc, spirit) => {
				const cost = String(spirit.cost);
				if (!acc[cost]) acc[cost] = [];
				acc[cost].push(spirit);
				return acc;
			},
			{} as Record<string, HexSpiritRow[]>
		)
	);

	// Calculate stats for all editions
	const editionStats = $derived(
		new Map(
			editions.map((edition) => {
				const spirits = hexSpirits.filter((spirit) => {
					if (!spirit.is_enabled) return false;
					const spiritOriginIds = spirit.traits?.origin_ids ?? [];
					return spiritOriginIds.some((oid) => edition.origin_ids.includes(oid));
				});

				const costDuplicates = edition.cost_duplicates ?? DEFAULT_COST_DUPLICATES;
				let totalUnique = spirits.length;
				let totalWithDuplicates = 0;

				for (const cost of ALL_COSTS) {
					const uniqueCount = spirits.filter((s) => String(s.cost) === cost).length;
					const duplicateCount = costDuplicates[cost] ?? 1;
					totalWithDuplicates += uniqueCount * duplicateCount;
				}

				return [edition.id, { totalUnique, totalWithDuplicates }];
			})
		)
	);

	function getOriginIconUrl(origin: OriginRow): string | null {
		return publicAssetUrl(origin.icon_png, { updatedAt: origin.updated_at ?? undefined });
	}

	onMount(loadData);

	async function loadData() {
		try {
			loading = true;
			error = null;
			const [editionsData, originsData, spiritsData] = await Promise.all([
				fetchEditionRecords(),
				fetchOriginRecords(),
				fetchHexSpiritRecords()
			]);
			editions = editionsData;
			origins = originsData;
			hexSpirits = spiritsData;

			if (editions.length > 0 && !selectedEditionId) {
				selectedEditionId = editions[0].id;
			}
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	function openEditionForm(edition?: EditionRow) {
		if (edition) {
			modal.open(editionRowToForm(edition));
		} else {
			modal.open();
		}
	}

	async function saveEdition() {
		if (!modal.formData.name.trim()) {
			alert('Edition name is required.');
			return;
		}

		try {
			const saved = await saveEditionRecord(modal.formData);
			await loadData();
			selectedEditionId = saved.id;
			modal.close();
		} catch (err) {
			alert(`Failed to save edition: ${getErrorMessage(err)}`);
		}
	}

	async function deleteEdition(edition: EditionRow) {
		if (!confirm(`Delete edition "${edition.name}"? This cannot be undone.`)) return;
		try {
			await deleteEditionRecord(edition.id);
			if (selectedEditionId === edition.id) {
				selectedEditionId = null;
			}
			await loadData();
		} catch (err) {
			alert(`Failed to delete edition: ${getErrorMessage(err)}`);
		}
	}

	async function deleteMultipleEditions(ids: string[]) {
		if (!confirm(`Delete ${ids.length} editions? This cannot be undone.`)) return;
		try {
			await Promise.all(ids.map((id) => deleteEditionRecord(id)));
			if (selectedEditionId && ids.includes(selectedEditionId)) {
				selectedEditionId = null;
			}
			await loadData();
		} catch (err) {
			alert(`Failed to delete editions: ${getErrorMessage(err)}`);
		}
	}

	function submitEditionForm(event: Event) {
		event.preventDefault();
		void saveEdition();
	}

	function toggleOriginInForm(originId: string) {
		if (modal.formData.origin_ids.includes(originId)) {
			modal.formData.origin_ids = modal.formData.origin_ids.filter((id) => id !== originId);
		} else {
			modal.formData.origin_ids = [...modal.formData.origin_ids, originId];
		}
	}

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}
</script>

<PageLayout
	title="Editions"
	subtitle="Create custom sets of hex spirits by selecting origins and configuring duplicates per cost"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	{#snippet headerActions()}
		<Button variant="primary" onclick={() => openEditionForm()}>Create Edition</Button>
	{/snippet}

	{#snippet tabActions()}
		<span class="edition-count">{editions.length} editions</span>
	{/snippet}

	{#if loading}
		<div class="loading-state">Loading editions...</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else if activeTab === 'list'}
		<EditionsListView
			{editions}
			{originLookup}
			stats={editionStats}
			onEdit={(edition) => openEditionForm(edition)}
			onDelete={(edition) => deleteEdition(edition)}
			onDeleteMultiple={deleteMultipleEditions}
			onSelect={(edition) => (selectedEditionId = edition.id)}
			{selectedEditionId}
		/>
	{:else if activeTab === 'table'}
		<EditionsTableView
			{editions}
			{originLookup}
			stats={editionStats}
			onEdit={(edition) => openEditionForm(edition)}
			onSelect={(edition) => (selectedEditionId = edition.id)}
			{selectedEditionId}
		/>
	{:else if activeTab === 'details'}
		<EditionDetails
			edition={selectedEdition}
			spirits={filteredSpirits}
			{originLookup}
		/>
	{/if}
</PageLayout>

	<Modal bind:open={modal.isOpen} title={modal.isEditing ? 'Edit Edition' : 'Create Edition'} size="lg">
		<form id="edition-editor-form" class="edition-form" onsubmit={submitEditionForm}>
			<div class="form-row">
				<FormField label="Name" required>
					<Input bind:value={modal.formData.name} />
				</FormField>
				<label class="checkbox-field">
					<input type="checkbox" bind:checked={modal.formData.is_default} />
					<span>Set as Default</span>
				</label>
			</div>

			<FormField label="Description">
				<Textarea bind:value={modal.formData.description} rows={2} />
			</FormField>

			<fieldset class="origins-fieldset">
				<legend>Select Origins</legend>
				<div class="origins-grid">
					{#each origins as origin}
						<label class="origin-checkbox">
							<input
								type="checkbox"
								checked={modal.formData.origin_ids.includes(origin.id)}
								onchange={() => toggleOriginInForm(origin.id)}
							/>
							<span class="origin-label" style="border-color: {origin.color}">
								{#if getOriginIconUrl(origin)}
									<img src={getOriginIconUrl(origin)} alt="" class="origin-label__icon" />
								{:else if origin.icon_emoji}
									<span>{origin.icon_emoji}</span>
								{/if}
								{origin.name}
							</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<fieldset class="duplicates-fieldset">
				<legend>Duplicates per Cost</legend>
				<div class="duplicates-grid">
					{#each ALL_COSTS as cost}
						<NumberControl
							label="Cost {cost}"
							bind:value={modal.formData.cost_duplicates[cost]}
							min={0}
							max={10}
						/>
					{/each}
				</div>
			</fieldset>
		</form>

		{#snippet footer()}
			<Button type="submit" form="edition-editor-form" variant="primary">Save</Button>
			<Button onclick={() => modal.close()}>Cancel</Button>
		{/snippet}
	</Modal>

<style>
	.edition-count {
		font-size: 0.7rem;
		color: #64748b;
	}

	.loading-state,
	.error-state {
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}

	.error-state {
		color: #f87171;
	}

	.edition-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-row {
		display: flex;
		gap: 1rem;
		align-items: end;
	}

	.checkbox-field {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		cursor: pointer;
	}

	.checkbox-field input {
		margin: 0;
	}

	.origins-fieldset,
	.duplicates-fieldset {
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		padding: 1rem;
	}

	.origins-fieldset legend,
	.duplicates-fieldset legend {
		padding: 0 0.5rem;
		font-weight: 500;
		color: #e2e8f0;
	}

	.origins-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 0.5rem;
	}

	.origin-checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.origin-checkbox input {
		margin: 0;
	}

	.origin-label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.5rem;
		background: rgba(51, 65, 85, 0.4);
		border: 1px solid;
		border-radius: 5px;
		font-size: 0.85rem;
	}

	.origin-label__icon {
		width: 16px;
		height: 16px;
		object-fit: contain;
	}

	.duplicates-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 0.75rem;
	}

</style>
