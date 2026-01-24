<script lang="ts">
	// @ts-nocheck
	import { onMount } from 'svelte';
	import { Button, FormField, Input, Select, Textarea } from '$lib/components/ui';
	import { ImageUploader } from '$lib/components/shared';
	import { Modal } from '$lib/components/layout';
	import { useFormModal, useFileUpload } from '$lib/composables';
	import { getErrorMessage } from '$lib/utils';
	import { supabase } from '$lib/api/supabaseClient';
	import { BASE_LANGUAGE, type TranslationLanguage, getTranslationValue, normalizeLanguageCode, setTranslationValue } from '$lib/i18n/translations';
	import {
		DICE_TYPE_ICONS,
		DICE_TYPE_LABELS,
		createInitialForm,
		deleteDiceRecord,
		fetchDiceRecords,
		normalizeSides,
		saveDiceRecord,
		toFormData,
		type CustomDiceWithSides,
		type DiceFormData,
		type DiceType
	} from '$lib/features/dice/dice';

	let diceList: CustomDiceWithSides[] = [];
	let error: string | null = null;
	let loading = true;

	const modal = useFormModal<DiceFormData>(createInitialForm());
	const backgroundUpload = useFileUpload('game_assets', 'dice_backgrounds');

	let editingDice: CustomDiceWithSides | null = null;

	// Language state
	let diceLanguage: TranslationLanguage = BASE_LANGUAGE;
	let diceLanguageSelect: TranslationLanguage = BASE_LANGUAGE;
	let newDiceLanguageDraft = '';
	let extraDiceLanguages: string[] = [];
	let diceLanguageOptions: { value: TranslationLanguage; label: string }[] = [
		{ value: BASE_LANGUAGE, label: 'Default' }
	];

	type AttackStats = { mean: number; sd: number } | null;

	function ensureDiceLanguageListed(lang: string) {
		if (!lang || lang === BASE_LANGUAGE) return;
		if (!extraDiceLanguages.includes(lang)) extraDiceLanguages = [...extraDiceLanguages, lang];
	}

	function getDiceName(dice: CustomDiceWithSides, lang: TranslationLanguage = diceLanguage): string {
		if (lang === BASE_LANGUAGE) return dice.name;
		return getTranslationValue((dice as any).name_translations, String(lang)) ?? dice.name;
	}

	function getDiceDescription(dice: CustomDiceWithSides, lang: TranslationLanguage = diceLanguage): string {
		const base = dice.description ?? '';
		if (lang === BASE_LANGUAGE) return base;
		return getTranslationValue((dice as any).description_translations, String(lang)) ?? base;
	}

	$: {
		const out = new Set<string>();
		for (const dice of diceList) {
			const sources = [(dice as any).name_translations, (dice as any).description_translations];
			for (const source of sources) {
				if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
				for (const key of Object.keys(source as Record<string, unknown>)) {
					const normalized = normalizeLanguageCode(key);
					if (!normalized) continue;
					out.add(normalized);
				}
			}
		}

		const merged = new Set<string>([...out, ...extraDiceLanguages]);
		const langs = Array.from(merged).filter((l) => l && l !== BASE_LANGUAGE);
		langs.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
		diceLanguageOptions = [{ value: BASE_LANGUAGE, label: 'Default' }, ...langs.map((l) => ({ value: l, label: l }))];
	}

	$: if (diceLanguageSelect !== diceLanguage) {
		requestDiceLanguageChange(String(diceLanguageSelect));
	}

	onMount(async () => {
		await loadDice();
	});

	async function loadDice() {
		loading = true;
		error = null;
		try {
			diceList = await fetchDiceRecords();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	function openCreate() {
		if (diceLanguage !== BASE_LANGUAGE) {
			alert('Create dice in Default language first, then add translations.');
			return;
		}
		editingDice = null;
		modal.open();
	}

	function openEdit(dice: CustomDiceWithSides) {
		editingDice = dice;
		const baseForm = toFormData(dice);
		if (diceLanguage === BASE_LANGUAGE) {
			modal.open(baseForm);
			return;
		}

		modal.open({
			...baseForm,
			name: getTranslationValue((dice as any).name_translations, String(diceLanguage)) ?? '',
			description: getTranslationValue((dice as any).description_translations, String(diceLanguage)) ?? ''
		});
	}

	function requestDiceLanguageChange(nextRaw: string) {
		const normalized = nextRaw === BASE_LANGUAGE ? BASE_LANGUAGE : normalizeLanguageCode(nextRaw);
		const next = normalized.length > 0 ? normalized : BASE_LANGUAGE;
		if (next === diceLanguage) return;

		if (modal.isOpen) {
			const ok = confirm('Switching language will discard any unsaved changes in the editor. Continue?');
			if (!ok) {
				diceLanguageSelect = diceLanguage;
				return;
			}
			modal.close();
			editingDice = null;
		}

		diceLanguage = next;
		diceLanguageSelect = next;
	}

	function addDiceLanguage() {
		const normalized = normalizeLanguageCode(newDiceLanguageDraft);
		if (!normalized) return;
		ensureDiceLanguageListed(normalized);
		newDiceLanguageDraft = '';
		requestDiceLanguageChange(normalized);
	}

	function setDiceType(type: DiceType) {
		modal.formData = {
			...modal.formData,
			dice_type: type,
			dice_sides: normalizeSides(type, modal.formData.dice_sides)
		};
	}

	function updateSideValue(index: number, value: string) {
		if (!modal.formData.dice_sides) return;
		const updated = [...modal.formData.dice_sides];
		updated[index] = { ...updated[index], reward_value: value };
		modal.formData = { ...modal.formData, dice_sides: updated };
	}

	function updateSideIcon(index: number, value: string) {
		if (!modal.formData.dice_sides) return;
		const updated = [...modal.formData.dice_sides];
		updated[index] = { ...updated[index], icon: value };
		modal.formData = { ...modal.formData, dice_sides: updated };
	}

	function computeAttackStats(dice: CustomDiceWithSides): AttackStats {
		if ((dice.dice_type ?? 'attack') !== 'attack') return null;
		const values = dice.dice_sides
			.map((side) => Number(side.reward_value))
			.filter((value) => Number.isFinite(value) && value !== 100) as number[];
		if (!values.length) return null;
		const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
		const meanSquares = values.reduce((sum, value) => sum + value * value, 0) / values.length;
		const variance = meanSquares - mean * mean;
		const sd = Math.sqrt(Math.max(variance, 0));
		return {
			mean,
			sd
		};
	}

	function formatStat(value: number): string {
		return Number.isFinite(value) ? value.toFixed(2) : '—';
	}

	async function saveDice() {
		const isBase = diceLanguage === BASE_LANGUAGE;

		if (isBase && !modal.formData.name?.trim()) {
			alert('Dice name is required');
			return;
		}

		if (!isBase && !editingDice?.id) {
			alert('Create the dice in Default language first, then add translations.');
			return;
		}

		try {
			if (isBase) {
				await saveDiceRecord(modal.formData);
			} else {
				const translationName = modal.formData.name ?? '';
				const translationDescription = modal.formData.description ?? '';

				await saveDiceRecord({
					...modal.formData,
					id: editingDice!.id,
					name: editingDice!.name,
					description: editingDice!.description ?? ''
				});

				const { error: updateError } = await supabase
					.from('custom_dice')
					.update({
						name_translations: setTranslationValue(
							(editingDice as any).name_translations,
							String(diceLanguage),
							translationName
						),
						description_translations: setTranslationValue(
							(editingDice as any).description_translations,
							String(diceLanguage),
							translationDescription
						),
						updated_at: new Date().toISOString()
					})
					.eq('id', editingDice!.id);

				if (updateError) throw updateError;
			}
			modal.close();
			await loadDice();
		} catch (err) {
			alert(`Failed to save dice: ${getErrorMessage(err)}`);
		}
	}

	async function deleteDice(dice: CustomDiceWithSides) {
		if (!confirm(`Delete custom dice "${getDiceName(dice)}"?`)) return;
		try {
			await deleteDiceRecord(dice.id);
			await loadDice();
		} catch (err) {
			alert(`Failed to delete dice: ${getErrorMessage(err)}`);
		}
	}

	function handleBackgroundUpload(path: string) {
		modal.formData = { ...modal.formData, background_image_path: path };
	}

	function handleBackgroundError(message: string) {
		alert(message);
	}

	function submitDiceForm(event: Event) {
		event.preventDefault();
		void saveDice();
	}
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Custom Dice</h1>
			<p>Create and manage custom dice definitions with sides and values.</p>
		</div>
		<div style="display: flex; gap: 0.5rem;">
			<Button onclick={openCreate}>Create Dice</Button>
		</div>
	</header>

	<div class="language-bar">
		<FormField label="Language">
			<Select bind:value={diceLanguageSelect} options={diceLanguageOptions} />
		</FormField>
		<FormField label="Add language">
			<div class="language-bar__add">
				<Input bind:value={newDiceLanguageDraft} placeholder="e.g. ja" />
				<Button variant="secondary" onclick={addDiceLanguage} disabled={!newDiceLanguageDraft.trim()}>
					Add
				</Button>
			</div>
		</FormField>
	</div>

	{#if loading}
		<div class="card loading">Loading dice…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<div class="dice-row">
			{#each diceList as dice}
				{@const stats = computeAttackStats(dice)}
				{@const displayName = getDiceName(dice)}
				{@const displayDescription = getDiceDescription(dice)}
				<div
					class="dice-panel"
					style={`border-color: ${dice.color ?? '#4a9eff'}`}
				>
					<div class="dice-panel__icon">{dice.icon ?? '🎲'}</div>
					<div class="dice-panel__content">
						<h3>{displayName}</h3>
						{#if displayDescription}
							<p>{displayDescription}</p>
						{/if}
						<div class="dice-panel__sides">
							{dice.dice_sides.length} sides
							{#if stats}
								<span class="dice-panel__stats">EV {formatStat(stats.mean)} • SD {formatStat(stats.sd)}</span>
							{/if}
						</div>
						<div class="dice-panel__type">{DICE_TYPE_LABELS[dice.dice_type ?? 'attack']}</div>
					</div>
					<div class="dice-panel__actions">
						<button
							class="icon-btn"
							type="button"
							onclick={() => openEdit(dice)}
							title="Edit dice"
						>
							✏️
						</button>
						<button
							class="icon-btn danger"
							type="button"
							onclick={() => deleteDice(dice)}
							title="Delete dice"
						>
							🗑️
						</button>
					</div>
				</div>
			{:else}
				<div class="card empty">Create your first dice to begin.</div>
			{/each}
		</div>
	{/if}

	<Modal bind:open={modal.isOpen} title={modal.isEditing ? 'Edit Dice' : 'Create Dice'} size="lg">
		<form id="dice-editor-form" class="dice-editor" onsubmit={submitDiceForm}>
			<section class="dice-editor__grid">
				<FormField
					label={`Name${diceLanguage === BASE_LANGUAGE ? '' : ` (${diceLanguage})`}`}
					required={diceLanguage === BASE_LANGUAGE}
				>
					<Input bind:value={modal.formData.name} required={diceLanguage === BASE_LANGUAGE} />
				</FormField>

				<FormField label="Icon">
					<Input bind:value={modal.formData.icon} />
				</FormField>

				<FormField label="Color">
					<Input type="color" bind:value={modal.formData.color} />
				</FormField>

				<FormField label="Dice type">
					<Select
						bind:value={modal.formData.dice_type}
						options={[
							{ value: 'attack', label: 'Attack Dice' },
							{ value: 'special', label: 'Special Dice' }
						]}
						onchange={(event) => setDiceType((event.currentTarget.value as DiceType) ?? 'attack')}
					/>
				</FormField>
			</section>

			<FormField label={`Description${diceLanguage === BASE_LANGUAGE ? '' : ` (${diceLanguage})`}`}>
				<Textarea rows={2} bind:value={modal.formData.description} />
			</FormField>

			<h3>Dice Background</h3>
			<ImageUploader
				bind:value={modal.formData.background_image_path}
				bucket="game_assets"
				folder="dice_backgrounds"
				maxSizeMB={10}
				onupload={handleBackgroundUpload}
				onerror={handleBackgroundError}
			>
				<p>Upload a background image that will be used for all dice sides.</p>
			</ImageUploader>

			<h3>Sides</h3>
			<div class="sides-grid">
				{#if modal.formData.dice_sides}
					{#each modal.formData.dice_sides as side, index}
						<div class="side-editor">
							<strong>Side {index + 1}</strong>
							{#if modal.formData.dice_type === 'attack'}
								<FormField label="Attack value">
									<Input
										type="number"
										value={side.reward_value ?? String(index + 1)}
										oninput={(event) => updateSideValue(index, (event.currentTarget.value ?? '').trim())}
									/>
								</FormField>
							{:else}
								<FormField label="Effect text">
									<Textarea
										rows={2}
										value={side.reward_value ?? ''}
										oninput={(event) => updateSideValue(index, event.currentTarget.value)}
									/>
								</FormField>
							{/if}
							<FormField label="Icon">
								<Input
									value={side.icon ?? DICE_TYPE_ICONS[modal.formData.dice_type ?? 'attack']}
									oninput={(event) => updateSideIcon(index, event.currentTarget.value)}
								/>
							</FormField>
						</div>
					{/each}
				{/if}
			</div>
		</form>

		{#snippet footer()}
			<Button variant="primary" type="submit" form="dice-editor-form">Save</Button>
			<Button onclick={() => modal.close()}>Cancel</Button>
		{/snippet}
	</Modal>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.language-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 1rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 10px;
		align-items: flex-end;
	}

	.language-bar__add {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.dice-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.75rem;
	}

	.dice-panel {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.6rem;
		align-items: center;
		padding: 0.75rem;
		background: rgba(15, 23, 42, 0.65);
		border: 2px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
	}

	.dice-panel:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 16px rgba(15, 23, 42, 0.35);
	}

	.dice-panel__icon {
		font-size: 1.8rem;
	}

	.dice-panel__content h3 {
		margin: 0;
		color: #f8fafc;
		font-size: 1rem;
	}

	.dice-panel__content p {
		margin: 0.2rem 0 0;
		color: #cbd5f5;
		font-size: 0.85rem;
	}

	.dice-panel__sides {
		margin-top: 0.4rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #94a3b8;
	}

	.dice-panel__stats {
		margin-left: 0.4rem;
		font-weight: 600;
		text-transform: none;
		letter-spacing: 0.02em;
		color: #f8fafc;
	}

	.dice-panel__type {
		margin-top: 0.25rem;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
		color: #fde68a;
	}

	.dice-panel__actions {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.icon-btn {
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 8px;
		color: inherit;
		cursor: pointer;
		padding: 0.25rem 0.45rem;
		transition: background 0.15s ease;
	}

	.icon-btn:hover {
		background: rgba(59, 130, 246, 0.2);
	}

	.icon-btn.danger:hover {
		background: rgba(248, 113, 113, 0.2);
	}

	.dice-editor {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.dice-editor__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.6rem;
	}

	.sides-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.6rem;
	}

	.side-editor {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.6rem;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 10px;
		background: rgba(30, 41, 59, 0.55);
	}

	.side-editor strong {
		color: #cbd5f5;
	}
</style>
