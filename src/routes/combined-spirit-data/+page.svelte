<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import { PageLayout } from '$lib/components/layout';
	import AwakenConditionEditor from '$lib/components/spirits/AwakenConditionEditor.svelte';
	import { fetchClassRecords, parseEffectSchema } from '$lib/features/classes/classes';
	import { fetchHexSpiritRecords } from '$lib/features/hex-spirits/hexSpirits';
	import { fetchOriginRecords } from '$lib/features/origins/origins';
	import type {
		AwakenCondition,
		ClassRow,
		HexSpiritRow,
		Json,
		MatItemRow,
		OriginRow
	} from '$lib/types/gameData';
	import type { EffectBreakpoint } from '$lib/types/effects';
	import { isAwakenOrRuneToken, normalizeAwakenRuneTokens } from '$lib/utils/awakenRuneTokens';
	import { getErrorMessage } from '$lib/utils';

	type AbilityDraft = {
		breakpointIndex: number;
		effectIndex: number;
		count: string;
		text: string;
	};

	type RowDraft = {
		cost: number;
		awakenCondition: AwakenCondition | null;
		classId: string;
		classQuantity: number;
		abilities: AbilityDraft[];
	};

	let allSpirits: HexSpiritRow[] = $state([]);
	let classes: ClassRow[] = $state([]);
	let origins: OriginRow[] = $state([]);
	let runes: MatItemRow[] = $state([]);
	let loading = $state(true);
	let error: string | null = $state(null);
	let search = $state('');
	let editingId: string | null = $state(null);
	let savingId: string | null = $state(null);
	let drafts: Record<string, RowDraft> = $state({});
	let rowErrors: Record<string, string | null> = $state({});

	const classById = $derived(new Map(classes.map((entry) => [entry.id, entry])));
	const originById = $derived(new Map(origins.map((entry) => [entry.id, entry])));
	const runeById = $derived(new Map(runes.map((entry) => [entry.id, entry])));
	const classUsage = $derived.by(() => {
		const usage = new Map<string, Set<string>>();
		for (const spirit of allSpirits) {
			for (const classId of new Set(spirit.traits?.class_ids ?? [])) {
				const spirits = usage.get(classId) ?? new Set<string>();
				spirits.add(spirit.id);
				usage.set(classId, spirits);
			}
		}
		return usage;
	});

	const filteredSpirits = $derived.by(() => {
		const term = search.trim().toLowerCase();
		return allSpirits
			// Combined data covers the high-tier spirits plus the human/hero roster,
			// whose low cost should not exclude them from this cross-origin view.
			.filter((spirit) => {
				const originNames = (spirit.traits?.origin_ids ?? [])
					.map((id) => originById.get(id)?.name ?? '')
					.map((name) => name.toLowerCase());
				const isHuman = /^hero\b/i.test(spirit.name) || originNames.some((name) => name === 'human enclave' || name === 'hero party' || name === 'heroes');
				return (spirit.cost >= 7 && spirit.cost <= 9) || isHuman;
			})
			.filter((spirit) => {
				if (!term) return true;
				const originNames = (spirit.traits?.origin_ids ?? [])
					.map((id) => originById.get(id)?.name ?? '')
					.join(' ');
				const classNames = (spirit.traits?.class_ids ?? [])
					.map((id) => classById.get(id)?.name ?? '')
					.join(' ');
				return `${spirit.name} ${originNames} ${classNames}`.toLowerCase().includes(term);
			})
			.sort((a, b) => {
				if (a.cost !== b.cost) return a.cost - b.cost;
				const aOrigin = originById.get(a.traits?.origin_ids?.[0] ?? '')?.position ?? 999;
				const bOrigin = originById.get(b.traits?.origin_ids?.[0] ?? '')?.position ?? 999;
				return aOrigin - bOrigin || a.name.localeCompare(b.name);
			});
	});

	const costGroups = $derived.by(() =>
		[...new Set(filteredSpirits.map((spirit) => spirit.cost))]
			.sort((a, b) => a - b)
			.map((cost) => ({ cost, spirits: filteredSpirits.filter((spirit) => spirit.cost === cost) }))
	);

	onMount(loadData);

	function cloneDatabaseValue<T>(value: T): T {
		return JSON.parse(JSON.stringify(value)) as T;
	}

	async function loadData() {
		loading = true;
		error = null;
		try {
			const [spiritRecords, classRecords, originRecords, matResult] = await Promise.all([
				fetchHexSpiritRecords(),
				fetchClassRecords(),
				fetchOriginRecords(),
				supabase.from('mat_items').select('*').order('name')
			]);
			if (matResult.error) throw matResult.error;
			allSpirits = spiritRecords;
			classes = classRecords;
			origins = originRecords;
			runes = (matResult.data ?? []) as MatItemRow[];
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	function uniqueClassIds(spirit: HexSpiritRow): string[] {
		return [...new Set(spirit.traits?.class_ids ?? [])];
	}

	function classQuantity(spirit: HexSpiritRow, classId: string): number {
		return (spirit.traits?.class_ids ?? []).filter((id) => id === classId).length;
	}

	function originSummary(spirit: HexSpiritRow): string {
		const counts = new Map<string, number>();
		for (const id of spirit.traits?.origin_ids ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
		return [...counts.entries()]
			.map(([id, quantity]) => `${originById.get(id)?.name ?? 'Unknown'}${quantity > 1 ? ` ×${quantity}` : ''}`)
			.join(', ') || 'Unassigned';
	}

	function classSummary(spirit: HexSpiritRow): string {
		return uniqueClassIds(spirit)
			.map((id) => {
				const quantity = classQuantity(spirit, id);
				return `${classById.get(id)?.name ?? 'Unknown'}${quantity > 1 ? ` ×${quantity}` : ''}`;
			})
			.join(', ') || 'Unassigned';
	}

	function abilityDrafts(entry: ClassRow | undefined): AbilityDraft[] {
		if (!entry) return [];
		const schema = Array.isArray(entry.effect_schema) ? entry.effect_schema : [];
		const drafts: AbilityDraft[] = [];
		for (let breakpointIndex = 0; breakpointIndex < schema.length; breakpointIndex += 1) {
			const breakpoint = schema[breakpointIndex];
			if (!breakpoint || typeof breakpoint !== 'object' || Array.isArray(breakpoint)) continue;
			const record = breakpoint as Record<string, Json | undefined>;
			const effects = Array.isArray(record.effects) ? record.effects : [];
			for (let effectIndex = 0; effectIndex < effects.length; effectIndex += 1) {
				const effect = effects[effectIndex];
				if (!effect || typeof effect !== 'object' || Array.isArray(effect)) continue;
				const effectRecord = effect as Record<string, Json | undefined>;
				if (effectRecord.type !== 'benefit') continue;
				drafts.push({
					breakpointIndex,
					effectIndex,
					count: String(record.count ?? ''),
					text: typeof effectRecord.description === 'string' ? effectRecord.description : ''
				});
			}
		}
		return drafts;
	}

	function classAbilitySummary(entry: ClassRow | undefined): string {
		const fields = abilityDrafts(entry);
		if (fields.length === 0) return 'No text ability';
		return fields.map((field) => field.text).filter(Boolean).join(' • ');
	}

	function awakenSummary(condition: AwakenCondition | null): string {
		if (!condition) return 'No awaken cost';
		if (condition.type === 'text') return condition.text || 'Empty text cost';
		if (condition.rune_ids.length === 0) return 'Empty rune cost';
		return condition.rune_ids
			.map((token) => {
				if (typeof token === 'string') return runeById.get(token)?.name ?? 'Unknown rune';
				return `(${(token.rune_ids ?? []).map((id) => runeById.get(id)?.name ?? 'Unknown').join(' OR ')})`;
			})
			.join(' + ');
	}

	function spiritImageUrl(spirit: HexSpiritRow): string | null {
		if (!spirit.game_print_image_path) return null;
		const path = spirit.game_print_image_path.startsWith('hex_spirits/')
			? spirit.game_print_image_path
			: `hex_spirits/${spirit.game_print_image_path}`;
		return supabase.storage.from('game_assets').getPublicUrl(path).data.publicUrl ?? null;
	}

	function startEdit(spirit: HexSpiritRow) {
		const ids = uniqueClassIds(spirit);
		const classId = ids[0] ?? '';
		drafts[spirit.id] = {
			cost: spirit.cost,
			awakenCondition: spirit.awaken_condition ? cloneDatabaseValue(spirit.awaken_condition) : null,
			classId,
			classQuantity: classId ? Math.max(1, classQuantity(spirit, classId)) : 1,
			abilities: abilityDrafts(classById.get(classId))
		};
		rowErrors[spirit.id] = null;
		editingId = spirit.id;
	}

	function cancelEdit(spiritId: string) {
		editingId = null;
		delete drafts[spiritId];
		rowErrors[spiritId] = null;
	}

	function changeDraftClass(spiritId: string, classId: string) {
		const draft = drafts[spiritId];
		if (!draft) return;
		draft.classId = classId;
		draft.classQuantity = 1;
		draft.abilities = abilityDrafts(classById.get(classId));
	}

	function updateAbility(spiritId: string, index: number, text: string) {
		const draft = drafts[spiritId];
		if (!draft?.abilities[index]) return;
		draft.abilities[index].text = text;
	}

	function sanitizedAwakenCondition(condition: AwakenCondition | null): AwakenCondition | null {
		if (!condition) return null;
		if (condition.type === 'text') {
			const text = condition.text.trim();
			return text ? { type: 'text', text } : null;
		}
		const tokens = normalizeAwakenRuneTokens(condition.rune_ids)
			.filter((token) => typeof token === 'string' || (isAwakenOrRuneToken(token) && token.rune_ids.length > 0))
			.slice(0, 5);
		return tokens.length ? { type: 'rune_cost', rune_ids: tokens } : null;
	}

	function schemaWithAbilityDrafts(entry: ClassRow, abilities: AbilityDraft[]): Json | null {
		const original = entry.effect_schema;
		if (!Array.isArray(original)) return original;
		const schema = cloneDatabaseValue(original) as Json[];
		for (const ability of abilities) {
			const breakpoint = schema[ability.breakpointIndex];
			if (!breakpoint || typeof breakpoint !== 'object' || Array.isArray(breakpoint)) continue;
			const effects = (breakpoint as Record<string, Json | undefined>).effects;
			if (!Array.isArray(effects)) continue;
			const effect = effects[ability.effectIndex];
			if (!effect || typeof effect !== 'object' || Array.isArray(effect)) continue;
			(effect as Record<string, Json | undefined>).description = ability.text.trim();
		}
		return schema;
	}

	async function saveRow(spirit: HexSpiritRow) {
		const draft = drafts[spirit.id];
		if (!draft || savingId) return;
		if (!draft.classId) {
			rowErrors[spirit.id] = 'Select a class before saving.';
			return;
		}

		const selectedClass = classById.get(draft.classId);
		if (!selectedClass) {
			rowErrors[spirit.id] = 'The selected class no longer exists.';
			return;
		}

		savingId = spirit.id;
		rowErrors[spirit.id] = null;
		const previousSchema = selectedClass.effect_schema;
		const nextSchema = schemaWithAbilityDrafts(selectedClass, draft.abilities);
		const classChanged = JSON.stringify(previousSchema) !== JSON.stringify(nextSchema);
		let classSaved = false;

		try {
			if (classChanged) {
				const classResult = await supabase
					.from('classes')
					.update({ effect_schema: nextSchema, updated_at: new Date().toISOString() })
					.eq('id', selectedClass.id);
				if (classResult.error) throw classResult.error;
				classSaved = true;
			}

			const spiritResult = await supabase
				.from('hex_spirits')
				.update({
					cost: Math.min(9, Math.max(7, Math.round(Number(draft.cost) || 7))),
					awaken_condition: sanitizedAwakenCondition(draft.awakenCondition),
					traits: {
						...(spirit.traits ?? { origin_ids: [], class_ids: [] }),
						class_ids: Array(Math.max(1, Math.floor(draft.classQuantity || 1))).fill(draft.classId)
					},
					updated_at: new Date().toISOString()
				})
				.eq('id', spirit.id);
			if (spiritResult.error) throw spiritResult.error;

			await loadData();
			editingId = null;
			delete drafts[spirit.id];
		} catch (err) {
			if (classSaved) {
				await supabase
					.from('classes')
					.update({ effect_schema: previousSchema, updated_at: selectedClass.updated_at })
					.eq('id', selectedClass.id);
			}
			rowErrors[spirit.id] = getErrorMessage(err);
		} finally {
			savingId = null;
		}
	}

	function breakpointCount(entry: ClassRow | undefined): number {
		return parseEffectSchema(entry?.effect_schema ?? null).length;
	}

	function tierLabel(cost: number): string {
		if (cost === 7) return 'Abyss Spirits';
		if (cost === 9) return 'Arcane Spirits';
		return `Cost ${cost} Spirits`;
	}
</script>

<PageLayout
	title="Combined Spirit Data"
	subtitle="Arcane Abyss spirits, summon costs, awaken requirements, classes, and abilities"
>
	<div class="page-stack">
		<div class="toolbar">
			<div>
				<strong>{filteredSpirits.length}</strong> Arcane Abyss spirits
				<span>Costs 7–9</span>
			</div>
			<input type="search" bind:value={search} placeholder="Search spirit, origin, or class…" />
		</div>

		{#if loading}
			<div class="state-card">Loading combined spirit data…</div>
		{:else if error}
			<div class="state-card state-card--error">{error}</div>
		{:else}
			{#each costGroups as group (group.cost)}
				{#if group.spirits.length > 0}
					<section class="cost-group">
						<header>
							<div>
								<h2>{tierLabel(group.cost)}</h2>
								<span>Cost {group.cost} · {group.spirits.length} spirits</span>
							</div>
						</header>

						<div class="table-scroll">
							<table>
								<thead>
									<tr>
										<th>Spirit</th>
										<th>Origin</th>
										<th>Cost</th>
										<th>Awaken Cost</th>
										<th>Class</th>
										<th>Class Ability</th>
										<th><span class="sr-only">Actions</span></th>
									</tr>
								</thead>
								<tbody>
									{#each group.spirits as spirit (spirit.id)}
										{@const assignedClassIds = uniqueClassIds(spirit)}
										{@const primaryClass = classById.get(assignedClassIds[0] ?? '')}
										<tr class:editing={editingId === spirit.id}>
											<td>
												<div class="spirit-cell">
													{#if spiritImageUrl(spirit)}
														<img src={spiritImageUrl(spirit) ?? ''} alt="" />
													{:else}
														<div class="image-placeholder" aria-hidden="true">✦</div>
													{/if}
													<strong>{spirit.name}</strong>
												</div>
											</td>
											<td>{originSummary(spirit)}</td>
											<td><span class="cost-badge">{spirit.cost}</span></td>
											<td class="summary-cell">{awakenSummary(spirit.awaken_condition)}</td>
											<td>
												<strong>{classSummary(spirit)}</strong>
												{#if assignedClassIds.length !== 1}
													<span class="warning-chip">{assignedClassIds.length} distinct classes</span>
												{/if}
											</td>
											<td class="summary-cell">{classAbilitySummary(primaryClass)}</td>
											<td>
												<button class="edit-button" type="button" disabled={savingId !== null} onclick={() => startEdit(spirit)}>
													Edit
												</button>
											</td>
										</tr>

										{#if editingId === spirit.id && drafts[spirit.id]}
											{@const draft = drafts[spirit.id]}
											{@const selectedClass = classById.get(draft.classId)}
											{@const selectedUsage = classUsage.get(draft.classId)?.size ?? 0}
											<tr class="editor-row">
												<td colspan="7">
													<div class="row-editor">
														<section class="editor-section editor-section--details">
															<h3>Spirit details</h3>
															<label>
																<span>Spirit cost</span>
																<input type="number" min="7" max="9" bind:value={draft.cost} />
															</label>
															<label>
																<span>Class</span>
																<select value={draft.classId} onchange={(event) => changeDraftClass(spirit.id, event.currentTarget.value)}>
																	{#each classes as entry (entry.id)}
																		<option value={entry.id}>{entry.name}</option>
																	{/each}
																</select>
															</label>
															<label>
																<span>Class quantity</span>
																<input type="number" min="1" max="9" bind:value={draft.classQuantity} />
															</label>
															<p>Origin: {originSummary(spirit)}</p>
														</section>

														<section class="editor-section editor-section--awaken">
															<h3>Awaken cost</h3>
															<AwakenConditionEditor bind:value={draft.awakenCondition} {runes} compact />
														</section>

														<section class="editor-section editor-section--ability">
															<h3>Class ability</h3>
															{#if selectedUsage > 1}
																<p class="warning-box">
																	This class is shared by {selectedUsage} spirits. Changing its ability updates every spirit using it.
																</p>
															{/if}
															{#if breakpointCount(selectedClass) > 1}
																<p class="warning-box">
																	This existing class has {breakpointCount(selectedClass)} breakpoints. Each ability is shown separately so none are discarded.
																</p>
															{/if}
															{#if draft.abilities.length === 0}
																<p class="empty-note">This class has no benefit-text ability to edit here.</p>
															{:else}
																{#each draft.abilities as ability, index (`${ability.breakpointIndex}-${ability.effectIndex}`)}
																	<label class="ability-field">
																		<span>{draft.abilities.length > 1 ? `Breakpoint ${ability.count || index + 1}` : 'Ability text'}</span>
																		<textarea rows="3" value={ability.text} oninput={(event) => updateAbility(spirit.id, index, event.currentTarget.value)}></textarea>
																	</label>
																{/each}
															{/if}
														</section>
													</div>

													{#if rowErrors[spirit.id]}
														<div class="row-error">{rowErrors[spirit.id]}</div>
													{/if}
													<div class="editor-actions">
														<button type="button" class="save-button" disabled={savingId === spirit.id} onclick={() => saveRow(spirit)}>
															{savingId === spirit.id ? 'Saving…' : 'Save row'}
														</button>
														<button type="button" disabled={savingId === spirit.id} onclick={() => cancelEdit(spirit.id)}>Cancel</button>
													</div>
												</td>
											</tr>
										{/if}
									{/each}
								</tbody>
							</table>
						</div>
					</section>
				{/if}
			{/each}
		{/if}
	</div>
</PageLayout>

<style>
	.page-stack {
		display: grid;
		gap: 0.75rem;
	}

	.toolbar,
	.cost-group,
	.state-card {
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 12px;
		background: rgba(15, 23, 42, 0.68);
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem;
	}

	.toolbar div {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.toolbar span,
	.cost-group > header span {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.toolbar input {
		width: min(360px, 50vw);
	}

	.cost-group {
		overflow: hidden;
	}

	.cost-group > header {
		padding: 0.7rem 0.85rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.14);
		background: linear-gradient(90deg, rgba(79, 70, 229, 0.18), transparent);
	}

	.cost-group h2 {
		margin: 0;
		font-size: 0.95rem;
	}

	.table-scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		min-width: 1120px;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.55rem 0.65rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		text-align: left;
		vertical-align: middle;
	}

	th {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8;
		background: rgba(2, 6, 23, 0.4);
	}

	td {
		font-size: 0.76rem;
		color: #cbd5e1;
	}

	tr.editing td {
		background: rgba(79, 70, 229, 0.09);
	}

	.spirit-cell {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		color: #f8fafc;
	}

	.spirit-cell img,
	.image-placeholder {
		width: 42px;
		height: 42px;
		border-radius: 8px;
		object-fit: cover;
		background: rgba(30, 41, 59, 0.8);
	}

	.image-placeholder {
		display: grid;
		place-items: center;
		color: #a78bfa;
	}

	.cost-badge,
	.warning-chip {
		display: inline-flex;
		padding: 0.18rem 0.42rem;
		border-radius: 999px;
		font-weight: 700;
	}

	.cost-badge {
		background: rgba(245, 158, 11, 0.17);
		color: #fcd34d;
	}

	.warning-chip {
		margin-top: 0.25rem;
		background: rgba(245, 158, 11, 0.12);
		color: #fbbf24;
		font-size: 0.65rem;
	}

	.summary-cell {
		max-width: 270px;
		line-height: 1.35;
	}

	.edit-button,
	.save-button {
		cursor: pointer;
		white-space: nowrap;
	}

	.save-button {
		background: linear-gradient(135deg, #4f46e5, #7c3aed);
		border-color: transparent;
	}

	.editor-row > td {
		padding: 0.75rem;
		background: rgba(2, 6, 23, 0.62);
	}

	.row-editor {
		display: grid;
		grid-template-columns: minmax(190px, 0.7fr) minmax(330px, 1.25fr) minmax(320px, 1fr);
		gap: 0.7rem;
	}

	.editor-section {
		display: grid;
		align-content: start;
		gap: 0.6rem;
		padding: 0.7rem;
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 10px;
		background: rgba(15, 23, 42, 0.64);
	}

	.editor-section h3 {
		margin: 0;
		font-size: 0.82rem;
	}

	.editor-section label,
	.ability-field {
		display: grid;
		gap: 0.3rem;
	}

	.editor-section label > span {
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.editor-section--details p,
	.empty-note {
		margin: 0;
		font-size: 0.72rem;
		color: #94a3b8;
	}

	.ability-field textarea {
		width: 100%;
		resize: vertical;
	}

	.warning-box,
	.row-error {
		margin: 0;
		padding: 0.5rem;
		border-radius: 8px;
		font-size: 0.71rem;
	}

	.warning-box {
		border: 1px solid rgba(245, 158, 11, 0.28);
		background: rgba(120, 53, 15, 0.18);
		color: #fcd34d;
	}

	.row-error,
	.state-card--error {
		color: #fca5a5;
	}

	.row-error {
		margin-top: 0.65rem;
		background: rgba(127, 29, 29, 0.18);
	}

	.editor-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.65rem;
	}

	.state-card {
		padding: 1rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (max-width: 760px) {
		.toolbar {
			align-items: stretch;
			flex-direction: column;
		}

		.toolbar input {
			width: 100%;
		}

		.row-editor {
			grid-template-columns: 1fr;
		}
	}
</style>
