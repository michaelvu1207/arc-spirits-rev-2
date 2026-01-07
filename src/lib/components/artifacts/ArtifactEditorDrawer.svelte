<script lang="ts">
	import type {
		ArtifactRow,
		OriginRow,
		GuardianRow,
		RuneRow,
		ArtifactTagRow
	} from '$lib/types/gameData';
	import { createEventDispatcher } from 'svelte';
	import { fly } from 'svelte/transition';
	import { supabase } from '$lib/api/supabaseClient';
	import { generateArtifactCardPNG } from '$lib/generators/cards';
	import { processAndUploadImage } from '$lib/utils/storage';

export let isOpen = false;
export let artifact: Partial<ArtifactRow> = {};
export let language: 'base' | string = 'base';
export let origins: OriginRow[] = [];
export let guardians: Pick<GuardianRow, 'id' | 'name'>[] = [];
export let runes: RuneRow[] = [];
export let tags: ArtifactTagRow[] = [];

	const dispatch = createEventDispatcher();

let selectedTagIds: string[] = [];
let generatingCard = false;
let nameDraft = '';
let benefitDraft = '';
let lastInitKey = '';

const BASE_LANGUAGE: 'base' = 'base';
const BASE_STORAGE_LANG = 'en';

function normalizeOptionalText(value: string | null | undefined): string | null {
	const trimmed = (value ?? '').trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeLanguageCode(value: string): string {
	return value.trim().replace(/_/g, '-').toLowerCase();
}

function getTranslationValue(input: unknown, lang: string): string | null {
	if (!lang || lang === BASE_LANGUAGE) return null;
	if (!input || typeof input !== 'object') return null;
	const record = input as Record<string, unknown>;
	const direct = record[lang];
	if (typeof direct === 'string') return normalizeOptionalText(direct);
	for (const [key, value] of Object.entries(record)) {
		if (normalizeLanguageCode(key) !== lang) continue;
		if (typeof value !== 'string') continue;
		return normalizeOptionalText(value);
	}
	return null;
}

function getArtifactNameForLanguage(row: Partial<ArtifactRow>): string {
	const baseName = (row.name ?? '').trim();
	if (language === BASE_LANGUAGE) return baseName;
	return getTranslationValue((row as any).name_translations, language) ?? baseName;
}

function getArtifactBenefitForLanguage(row: Partial<ArtifactRow>): string {
	const baseBenefit = (row.benefit ?? '').trim();
	if (language === BASE_LANGUAGE) return baseBenefit;
	return getTranslationValue((row as any).benefit_translations, language) ?? baseBenefit;
}

function sanitizeLanguageForPath(lang: string): string {
	return lang.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

	// Computed card image URL
	$: cardImageUrl = (() => {
		const basePath = (artifact as any)?.card_image_path ?? null;
		const translatedPath = getTranslationValue((artifact as any)?.card_image_path_translations, language);
		const path = language === BASE_LANGUAGE ? basePath : translatedPath ?? basePath;
		return path ? supabase.storage.from('game_assets').getPublicUrl(path).data?.publicUrl : null;
	})();

	$: if (isOpen) {
		selectedTagIds = (artifact as any).tag_ids || [];

		// Ensure quantity has a default value
		if ((artifact as any).quantity === undefined || (artifact as any).quantity === null) {
			(artifact as any).quantity = 1;
		}

		const initKey = `${(artifact as any)?.id ?? 'new'}|${language}`;
		if (initKey !== lastInitKey) {
			lastInitKey = initKey;
			nameDraft = language === BASE_LANGUAGE ? ((artifact as any).name ?? '') : (getTranslationValue((artifact as any).name_translations, language) ?? '');
			benefitDraft = language === BASE_LANGUAGE ? ((artifact as any).benefit ?? '') : (getTranslationValue((artifact as any).benefit_translations, language) ?? '');
		}
	}

	function save() {
		// Prepare artifact object for saving
		const toSave: Partial<ArtifactRow> & Record<string, unknown> = {
			...artifact,
			tag_ids: selectedTagIds,
			guardian_id: (artifact as any).guardian_id ?? null
		};

		if (language === BASE_LANGUAGE) {
			toSave.name = (nameDraft ?? '').trim();
			toSave.benefit = benefitDraft ?? '';
		} else {
			const nextName = normalizeOptionalText(nameDraft);
			const currentNameTranslations = ((artifact as any).name_translations ?? {}) as Record<string, string>;
			const nextNameTranslations = { ...currentNameTranslations };
			if (nextName) nextNameTranslations[language] = nextName;
			else delete nextNameTranslations[language];
			toSave.name_translations = nextNameTranslations;

			const nextBenefit = normalizeOptionalText(benefitDraft);
			const currentBenefitTranslations = ((artifact as any).benefit_translations ?? {}) as Record<string, string>;
			const nextBenefitTranslations = { ...currentBenefitTranslations };
			if (nextBenefit) nextBenefitTranslations[language] = nextBenefit;
			else delete nextBenefitTranslations[language];
			toSave.benefit_translations = nextBenefitTranslations;
		}
		dispatch('save', toSave);
	}

	function close() {
		dispatch('close');
	}

	function toggleTag(tagId: string) {
		if (selectedTagIds.includes(tagId)) {
			selectedTagIds = selectedTagIds.filter((t) => t !== tagId);
		} else {
			selectedTagIds = [...selectedTagIds, tagId];
		}
	}


	// Generate and upload artifact card PNG
	async function generateCardPNG() {
		if (!artifact.id || !artifact.name) {
			alert('Please save the artifact first before generating a card image.');
			return;
		}

		generatingCard = true;
		try {
			const renderArtifact = {
				...(artifact as ArtifactRow),
				name: getArtifactNameForLanguage(artifact),
				benefit: getArtifactBenefitForLanguage(artifact)
			};

			const safeLang = language === BASE_LANGUAGE ? BASE_STORAGE_LANG : sanitizeLanguageForPath(language);
			const folder = `card_images/artifacts/${safeLang || BASE_STORAGE_LANG}`;
			const filename = artifact.id;

			// Generate PNG directly using Canvas API
			const pngBlob = await generateArtifactCardPNG(renderArtifact as ArtifactRow, origins, runes, tags, guardians);

			// Upload with transparent area cropping
			const { data, error: uploadError } = await processAndUploadImage(pngBlob, {
				folder,
				filename,
				cropTransparent: true,
				upsert: true
			});

			if (uploadError) {
				throw new Error(`Failed to upload card image: ${uploadError.message}`);
			}

			const uploadedPath = data?.path ?? '';

			const updatePayload: Record<string, unknown> = {
				updated_at: new Date().toISOString(),
			};

			if (language === BASE_LANGUAGE) {
				updatePayload.card_image_path = uploadedPath;
			} else {
				const current = ((artifact as any).card_image_path_translations ?? {}) as Record<string, string>;
				updatePayload.card_image_path_translations = { ...current, [language]: uploadedPath };
			}

			const { error: updateError } = await supabase.from('artifacts').update(updatePayload).eq('id', artifact.id);

			if (updateError) {
				throw new Error(`Failed to update artifact: ${updateError.message}`);
			}

			// Update local artifact object
			if (language === BASE_LANGUAGE) {
				(artifact as any).card_image_path = uploadedPath;
			} else {
				const current = ((artifact as any).card_image_path_translations ?? {}) as Record<string, string>;
				(artifact as any).card_image_path_translations = { ...current, [language]: uploadedPath };
			}

			alert('Card image generated successfully!');
		} catch (error) {
			console.error('Error generating card:', error);
			alert(`Failed to generate card: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			generatingCard = false;
		}
	}
</script>

{#if isOpen}
	<div class="drawer-backdrop" role="button" tabindex="0" on:click={close} on:keydown={(e)=> (e.key=="Enter"||e.key==" ") && close()}></div>
	<div class="drawer" transition:fly={{ x: 400, duration: 300 }}>
		<div class="drawer-header">
			<h2>{artifact.id ? 'Edit Artifact' : 'Create Artifact'}</h2>
			<button class="close-btn" on:click={close}>&times;</button>
		</div>

		<div class="drawer-content">
			<div class="form-group">
				<label for="name">Name{language === BASE_LANGUAGE ? '' : ` (${language})`}</label>
				<input
					type="text"
					id="name"
					value={nameDraft}
					on:input={(e) => (nameDraft = (e.currentTarget as HTMLInputElement).value)}
					placeholder={language === BASE_LANGUAGE ? 'Artifact Name' : ((artifact as any).name ?? 'Artifact Name')}
				/>
			</div>

			<div class="form-group">
				<label for="guardian">Guardian (optional)</label>
				<select id="guardian" bind:value={artifact.guardian_id}>
					<option value={null}>Unassigned</option>
					{#each guardians as guardian}
						<option value={guardian.id}>{guardian.name}</option>
					{/each}
				</select>
			</div>

			<div class="form-group">
				<label for="benefit">Benefit{language === BASE_LANGUAGE ? '' : ` (${language})`}</label>
				<textarea
					id="benefit"
					value={benefitDraft}
					on:input={(e) => (benefitDraft = (e.currentTarget as HTMLTextAreaElement).value)}
					rows="3"
					placeholder={language === BASE_LANGUAGE ? "Describe the artifact's effect..." : ((artifact as any).benefit ?? "Describe the artifact's effect...")}
				></textarea>
			</div>

			<div class="form-group">
				<label for="quantity">Quantity</label>
				<input
					type="number"
					id="quantity"
					min="1"
					bind:value={artifact.quantity}
					placeholder="1"
				/>
				<small style="color: #94a3b8; font-size: 0.75rem; margin-top: 0.25rem;">
					Number of copies to export (default: 1)
				</small>
			</div>

			<div class="form-group">
				<label for="tags-selector">Tags</label>
				<div id="tags-selector" class="tags-selector">
					{#each tags as tag}
						<button
							class="tag-pill"
							class:active={selectedTagIds.includes(tag.id)}
							style="--tag-color: {tag.color}"
							on:click={() => toggleTag(tag.id)}
						>
							{tag.name}
						</button>
					{/each}
				</div>
			</div>

			{#if artifact.id}
				<div class="form-group">
					<label for="card-image-btn">Card Image</label>
					<div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
						{#if cardImageUrl}
							<a 
								href={cardImageUrl}
								target="_blank"
								rel="noopener noreferrer"
								style="color: #3b82f6; text-decoration: underline; font-size: 0.9rem;"
							>
								View Card Image
							</a>
						{/if}
						<button
							type="button"
							class="btn-generate-card" id="card-image-btn"
							on:click={generateCardPNG}
							disabled={generatingCard}
						>
							{generatingCard ? 'Generating...' : 'Generate Card PNG'}
						</button>
					</div>
				</div>
			{/if}

			<div class="form-group">
				<label for="recipe-editor">Recipe</label>
				<div id="recipe-editor" class="recipe-editor">
				{#if artifact.recipe_box && artifact.recipe_box.length > 0}
					{#each artifact.recipe_box as entry, i}
						<div class="recipe-row">
							<select
								value={entry.rune_id}
								on:change={(e) => {
									const val = e.currentTarget.value;
									if (artifact.recipe_box) artifact.recipe_box[i].rune_id = val;
								}}
							>
								<option value="">Select Rune...</option>
								{#each runes as rune}
									<option value={rune.id}>{rune.name}</option>
								{/each}
							</select>
							<input
								type="number"
								min="1"
								value={entry.quantity}
								on:input={(e) => {
									const val = Number(e.currentTarget.value) || 1;
									if (artifact.recipe_box) artifact.recipe_box[i].quantity = val;
								}}
							/>
							<button
								class="remove-btn"
								on:click={() => {
									if (artifact.recipe_box) {
										artifact.recipe_box = artifact.recipe_box.filter((_, idx) => idx !== i);
									}
								}}
							>
								&times;
							</button>
						</div>
					{/each}
				{:else}
					<div class="empty-recipe">No runes added yet.</div>
				{/if}

					<button
						class="add-rune-btn"
						on:click={() => {
							if (!artifact.recipe_box) artifact.recipe_box = [];
							artifact.recipe_box = [...artifact.recipe_box, { rune_id: '', quantity: 1 }];
						}}
					>
						+ Add Rune
					</button>
				</div>
				</div>
			</div>

		<div class="drawer-footer">
			<button class="btn-secondary" on:click={close}>Cancel</button>
			<button class="btn-primary" on:click={save}>Save Artifact</button>
		</div>
	</div>
{/if}

<style>
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(2px);
		z-index: 40;
	}

	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 400px;
		background: #0f172a;
		border-left: 1px solid rgba(148, 163, 184, 0.2);
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.5);
		z-index: 50;
		display: flex;
		flex-direction: column;
	}

	.drawer-header {
		padding: 1.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.drawer-header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: #f8fafc;
	}

	.close-btn {
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		line-height: 1;
	}

	.drawer-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		font-size: 0.85rem;
		font-weight: 600;
		color: #94a3b8;
		text-transform: uppercase;
	}

	input,
	select,
	textarea {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.2);
		color: #f8fafc;
		padding: 0.75rem;
		border-radius: 6px;
		width: 100%;
	}

	.tags-selector {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tag-pill {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid var(--tag-color);
		color: #cbd5f5;
		padding: 0.25rem 0.75rem;
		border-radius: 999px;
		font-size: 0.8rem;
		cursor: pointer;
		opacity: 0.6;
		transition: all 0.2s;
	}

	.tag-pill:hover {
		opacity: 0.9;
	}

	.tag-pill.active {
		background: var(--tag-color);
		color: #0f172a;
		font-weight: 600;
		opacity: 1;
	}

	.drawer-footer {
		padding: 1.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
	}

	button.btn-primary {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
	}

	button.btn-secondary {
		background: transparent;
		color: #94a3b8;
		border: 1px solid rgba(148, 163, 184, 0.3);
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
	}

	button.btn-generate-card {
		background: #10b981;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	button.btn-generate-card:hover:not(:disabled) {
		background: #059669;
	}

	button.btn-generate-card:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
