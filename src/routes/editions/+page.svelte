<script lang="ts">
	import { onMount } from 'svelte';
	import type { EditionRow, OriginRow, HexSpiritRow } from '$lib/types/gameData';
	import { PageLayout } from '$lib/components/layout';
	import { Button } from '$lib/components/ui';
	import { OriginToggleChips, CostDuplicatesEditor } from '$lib/components/editions';
	import { useLookup } from '$lib/composables';
	import { getErrorMessage } from '$lib/utils';
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
	let editForm = $state<EditionFormData | null>(null);
	let saving = $state(false);

	const originLookup = useLookup(() => origins);
	const ALL_COSTS = ['1', '3', '4', '5', '7', '9', '11', '13', '15', '17'];

	const editionStats = $derived(
		new Map(
			editions.map((edition) => {
				const spirits = hexSpirits.filter((spirit) => {
					const spiritOriginIds = spirit.traits?.origin_ids ?? [];
					return spiritOriginIds.some((oid) => edition.origin_ids.includes(oid));
				});
				const costDuplicates = edition.cost_duplicates ?? DEFAULT_COST_DUPLICATES;
				let totalUnique = spirits.length;
				let totalWithDuplicates = 0;
				for (const cost of ALL_COSTS) {
					const uniqueCount = spirits.filter((s) => String(s.cost) === cost).length;
					totalWithDuplicates += uniqueCount * (costDuplicates[cost] ?? 1);
				}
				return [edition.id, { totalUnique, totalWithDuplicates }];
			})
		)
	);

	onMount(loadData);

	async function loadData() {
		try {
			loading = true;
			error = null;
			const [ed, or, sp] = await Promise.all([
				fetchEditionRecords(),
				fetchOriginRecords(),
				fetchHexSpiritRecords()
			]);
			editions = ed;
			origins = or;
			hexSpirits = sp;
			if (editions.length > 0 && !selectedEditionId) {
				selectEdition(editions[0]);
			}
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	function selectEdition(edition: EditionRow) {
		if (selectedEditionId === edition.id) {
			selectedEditionId = null;
			editForm = null;
			return;
		}
		selectedEditionId = edition.id;
		editForm = editionRowToForm(edition);
	}

	function startCreate() {
		selectedEditionId = null;
		editForm = emptyEditionForm();
	}

	function cancelEdit() {
		if (selectedEditionId) {
			const edition = editions.find((e) => e.id === selectedEditionId);
			if (edition) editForm = editionRowToForm(edition);
			else { selectedEditionId = null; editForm = null; }
		} else {
			editForm = null;
		}
	}

	async function saveEdit() {
		if (!editForm || !editForm.name.trim()) return;
		try {
			saving = true;
			const saved = await saveEditionRecord(editForm);
			await loadData();
			selectedEditionId = saved.id;
			const updated = editions.find((e) => e.id === saved.id);
			if (updated) editForm = editionRowToForm(updated);
		} catch (err) {
			alert(`Failed to save: ${getErrorMessage(err)}`);
		} finally {
			saving = false;
		}
	}

	async function deleteEdition(edition: EditionRow) {
		if (!confirm(`Delete "${edition.name}"?`)) return;
		try {
			await deleteEditionRecord(edition.id);
			if (selectedEditionId === edition.id) {
				selectedEditionId = null;
				editForm = null;
			}
			await loadData();
		} catch (err) {
			alert(`Failed to delete: ${getErrorMessage(err)}`);
		}
	}

	function toggleOrigin(originId: string) {
		if (!editForm) return;
		if (editForm.origin_ids.includes(originId)) {
			editForm.origin_ids = editForm.origin_ids.filter((id) => id !== originId);
		} else {
			editForm.origin_ids = [...editForm.origin_ids, originId];
		}
	}
</script>

<PageLayout title="Editions" subtitle="Manage edition origin sets and cost duplicates">
	{#snippet headerActions()}
		<Button variant="primary" onclick={startCreate}>+ New</Button>
	{/snippet}

	{#if loading}
		<div class="state-msg">Loading...</div>
	{:else if error}
		<div class="state-msg state-msg--err">{error}</div>
	{:else}
		<table class="t">
			<thead><tr>
				<th>Name</th>
				<th class="tc w60">Origins</th>
				<th class="tc w60">Unique</th>
				<th class="tc w60">Total</th>
				<th class="w36"></th>
			</tr></thead>
			<tbody>
				{#each editions as edition (edition.id)}
					{@const s = editionStats.get(edition.id)}
					{@const sel = selectedEditionId === edition.id}
					<tr class="row" class:sel onclick={() => selectEdition(edition)}>
						<td>
							<span class="nm">{edition.name}</span>
							{#if edition.is_default}<span class="bg bg--d">D</span>{/if}
							{#if edition.is_enabled === false}<span class="bg bg--off">off</span>{/if}
						</td>
						<td class="tc">{edition.origin_ids.length}</td>
						<td class="tc">{s?.totalUnique ?? '—'}</td>
						<td class="tc">{s?.totalWithDuplicates ?? '—'}</td>
						<td class="tc">
							<button class="xbtn" title="Delete" onclick={(e) => { e.stopPropagation(); deleteEdition(edition); }}>&#10005;</button>
						</td>
					</tr>
					{#if sel && editForm}
						<tr class="erow"><td colspan="5">
							{@render inlineEditor()}
						</td></tr>
					{/if}
				{/each}

				{#if editForm && !selectedEditionId}
					<tr class="row sel">
						<td colspan="5"><span class="nm">New Edition</span></td>
					</tr>
					<tr class="erow"><td colspan="5">
						{@render inlineEditor()}
					</td></tr>
				{/if}
			</tbody>
		</table>

		{#if editions.length === 0 && !editForm}
			<div class="state-msg">No editions. Click <strong>+ New</strong> to create one.</div>
		{/if}
	{/if}
</PageLayout>

{#snippet inlineEditor()}
	{#if editForm}
		<div class="ed">
			<div class="ed-top">
				<input class="ed-name" bind:value={editForm.name} placeholder="Name" />
				<input class="ed-desc" bind:value={editForm.description} placeholder="Description (optional)" />
				<label class="ed-ck"><input type="checkbox" bind:checked={editForm.is_default} /><span>Default</span></label>
				<label class="ed-ck"><input type="checkbox" bind:checked={editForm.is_enabled} /><span>Enabled</span></label>
			</div>
			<OriginToggleChips {origins} selectedIds={editForm.origin_ids} onToggle={toggleOrigin} />
			<CostDuplicatesEditor bind:costDuplicates={editForm.cost_duplicates} />
			<div class="ed-foot">
				<button class="btn-save" onclick={saveEdit} disabled={saving || !editForm.name.trim()}>
					{saving ? 'Saving...' : 'Save'}
				</button>
				<button class="btn-cancel" onclick={cancelEdit}>Cancel</button>
			</div>
		</div>
	{/if}
{/snippet}

<style>
	.state-msg { padding: 1rem; text-align: center; color: #64748b; font-size: 0.75rem; }
	.state-msg--err { color: #f87171; }

	/* Table */
	.t { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
	.t thead { position: sticky; top: 0; z-index: 1; }
	.t th {
		padding: 0.3rem 0.5rem; text-align: left;
		font-size: 0.65rem; font-weight: 600; color: #64748b;
		text-transform: uppercase; letter-spacing: 0.05em;
		border-bottom: 1px solid rgba(148,163,184,0.15);
		background: rgba(15,23,42,0.6);
	}
	.tc { text-align: center !important; }
	.w60 { width: 60px; }
	.w36 { width: 36px; }

	/* Rows */
	.row { cursor: pointer; transition: background 0.1s; }
	.row:hover { background: rgba(99,102,241,0.08); }
	.row.sel { background: rgba(59,130,246,0.12); }
	.row td {
		padding: 0.35rem 0.5rem;
		border-bottom: 1px solid rgba(148,163,184,0.08);
		color: #cbd5e1;
	}
	.row.sel td { border-bottom-color: transparent; }

	.nm { font-weight: 600; color: #f1f5f9; }
	.bg {
		display: inline-block; margin-left: 0.3rem;
		font-size: 0.55rem; padding: 0.05rem 0.25rem;
		border-radius: 2px; font-weight: 700;
		vertical-align: middle; line-height: 1.3;
	}
	.bg--d { background: rgba(34,197,94,0.2); border: 1px solid rgba(34,197,94,0.4); color: #86efac; }
	.bg--off { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; }

	.xbtn {
		background: none; border: none; color: #475569;
		cursor: pointer; padding: 0.15rem 0.3rem;
		font-size: 0.7rem; line-height: 1; border-radius: 3px;
	}
	.xbtn:hover { background: rgba(239,68,68,0.15); color: #f87171; }

	/* Editor row */
	.erow td { padding: 0; border-bottom: 1px solid rgba(148,163,184,0.08); }

	.ed {
		padding: 0.5rem;
		background: rgba(30,41,59,0.25);
		display: flex; flex-direction: column; gap: 0.5rem;
	}

	.ed-top {
		display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;
	}

	.ed-name, .ed-desc {
		padding: 0.3rem 0.5rem;
		background: rgba(15,23,42,0.6);
		border: 1px solid rgba(148,163,184,0.2);
		border-radius: 4px; color: #e2e8f0;
		font-size: 0.78rem; outline: none;
	}
	.ed-name { width: 160px; font-weight: 600; }
	.ed-desc { flex: 1; min-width: 120px; }
	.ed-name:focus, .ed-desc:focus {
		border-color: rgba(59,130,246,0.5);
	}

	.ed-ck {
		display: flex; align-items: center; gap: 0.3rem;
		font-size: 0.7rem; color: #94a3b8; cursor: pointer;
		white-space: nowrap;
	}
	.ed-ck input { margin: 0; }

	.ed-foot {
		display: flex; gap: 0.35rem; justify-content: flex-end;
	}

	.btn-save, .btn-cancel {
		padding: 0.25rem 0.6rem; border-radius: 4px;
		font-size: 0.7rem; font-weight: 600; cursor: pointer;
		border: 1px solid transparent;
	}
	.btn-save {
		background: rgba(59,130,246,0.25); color: #93c5fd;
		border-color: rgba(59,130,246,0.4);
	}
	.btn-save:hover:not(:disabled) {
		background: rgba(59,130,246,0.35);
	}
	.btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
	.btn-cancel {
		background: rgba(51,65,85,0.3); color: #94a3b8;
		border-color: rgba(148,163,184,0.2);
	}
	.btn-cancel:hover { background: rgba(51,65,85,0.5); }
</style>
