<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import { cropEmptySpace } from '$lib/utils/imageCrop';
	import { useFormModal } from '$lib/composables';
	import { getErrorMessage, sanitizeFilename } from '$lib/utils';
	import { processAndUploadImage } from '$lib/utils/storage';
	import { Button, FormField, Input, Select } from '$lib/components/ui';
	import { Modal, PageLayout, type Tab } from '$lib/components/layout';
	import { GuardiansListView, GuardiansTableView } from '$lib/components/guardians';
	import type { ArtifactRow, GuardianRow, OriginRow } from '$lib/types/gameData';

	type Guardian = GuardianRow;
	type OriginOption = Pick<OriginRow, 'id' | 'name'>;
	type Artifact = Pick<ArtifactRow, 'id' | 'name' | 'benefit' | 'recipe_box' | 'guardian_id'>;

	type GuardianLanguage = 'base' | string;
	const BASE_LANGUAGE: GuardianLanguage = 'base';

	let guardians: Guardian[] = $state([]);
	let origins: OriginOption[] = $state([]);
	let artifactsByGuardian: Record<string, Artifact[]> = $state({});
	let loading = $state(true);
	let error: string | null = $state(null);

	let search = $state('');
	let originFilter = $state('all');

	let guardianLanguage = $state<GuardianLanguage>(BASE_LANGUAGE);
	let guardianLanguageSelect = $state<GuardianLanguage>(BASE_LANGUAGE);
	let newGuardianLanguageDraft = $state('');
	let extraGuardianLanguages = $state<string[]>([]);

	// Tab state
	const tabs: Tab[] = [
		{ id: 'list', label: 'Data: List', icon: '📋' },
		{ id: 'table', label: 'Data: Table', icon: '📊' }
	];
	let activeTab = $state('list');

	const modal = useFormModal<{ name: string; origin_id: string | null }>({
		name: '',
		origin_id: null
	});

	const gameAssetsStorage = supabase.storage.from('game_assets');
	let uploadingId: string | null = $state(null);
	let uploadInput: HTMLInputElement | null = $state(null);
	let chibiUploadInput: HTMLInputElement | null = $state(null);
	let iconUploadInput: HTMLInputElement | null = $state(null);
	let uploadTarget: Guardian | null = $state(null);
	let uploadType: 'image_mat' | 'chibi' | 'icon' = $state('image_mat');

	function normalizeOptionalText(value: string | null | undefined): string | null {
		const trimmed = (value ?? '').trim();
		return trimmed.length > 0 ? trimmed : null;
	}

	function normalizeLanguageCode(value: string): string {
		return value.trim().replace(/_/g, '-').toLowerCase();
	}

	function getTranslationValue(input: unknown, lang: string): string | null {
		if (!lang || lang === BASE_LANGUAGE) return null;
		if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
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

	function ensureTranslationRecord(input: unknown): Record<string, string> {
		if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
		const out: Record<string, string> = {};
		for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
			if (typeof value !== 'string') continue;
			const normalizedKey = normalizeLanguageCode(key);
			if (!normalizedKey) continue;
			out[normalizedKey] = value;
		}
		return out;
	}

	function ensureLanguageListed(lang: string) {
		if (!lang || lang === BASE_LANGUAGE) return;
		if (!extraGuardianLanguages.includes(lang)) extraGuardianLanguages = [...extraGuardianLanguages, lang];
	}

	function getGuardianName(guardian: Guardian, lang: GuardianLanguage): string {
		if (lang === BASE_LANGUAGE) return guardian.name;
		return getTranslationValue(guardian.name_translations, lang) ?? guardian.name;
	}

	const detectedGuardianLanguages = $derived.by(() => {
		const out = new Set<string>();
		for (const guardian of guardians) {
			const translations = guardian.name_translations;
			if (!translations || typeof translations !== 'object' || Array.isArray(translations)) continue;
			for (const key of Object.keys(translations as Record<string, unknown>)) {
				const normalized = normalizeLanguageCode(key);
				if (!normalized) continue;
				out.add(normalized);
			}
		}
		return Array.from(out).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
	});

	const guardianLanguageOptions = $derived.by(() => {
		const merged = new Set<string>([...detectedGuardianLanguages, ...extraGuardianLanguages]);
		const langs = Array.from(merged).filter((l) => l && l !== BASE_LANGUAGE);
		langs.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
		return [{ value: BASE_LANGUAGE, label: 'Default' }, ...langs.map((l) => ({ value: l, label: l }))];
	});

	$effect(() => {
		if (guardianLanguageSelect !== guardianLanguage) {
			requestGuardianLanguageChange(String(guardianLanguageSelect));
		}
	});

	function requestGuardianLanguageChange(nextRaw: string) {
		const normalized = nextRaw === BASE_LANGUAGE ? BASE_LANGUAGE : normalizeLanguageCode(nextRaw);
		const next = normalized.length > 0 ? normalized : BASE_LANGUAGE;
		if (next === guardianLanguage) return;

		if (modal.isOpen) {
			const ok = confirm('Switching language will discard any unsaved changes in the modal. Continue?');
			if (!ok) {
				guardianLanguageSelect = guardianLanguage;
				return;
			}
			modal.close();
		}

		guardianLanguage = next;
		guardianLanguageSelect = next;
	}

	function addGuardianLanguage() {
		const normalized = normalizeLanguageCode(newGuardianLanguageDraft);
		if (!normalized) return;
		ensureLanguageListed(normalized);
		newGuardianLanguageDraft = '';
		requestGuardianLanguageChange(normalized);
	}

	async function cropAndResizeToSquare(
		blob: Blob
	): Promise<{ blob: Blob; ext: string; contentType: string }> {
		const arrayBuffer = await blob.arrayBuffer();
		const image = await createImageBitmap(new Blob([arrayBuffer]));
		const size = 800;
		const side = Math.min(image.width, image.height);
		const sx = (image.width - side) / 2;
		const sy = (image.height - side) / 2;

		const canvas = new OffscreenCanvas(size, size);
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas context unavailable');
		ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);

		const outBlob = await canvas.convertToBlob({ type: 'image/png', quality: 0.92 });
		return { blob: outBlob, ext: 'png', contentType: 'image/png' };
	}

	function promptImageUpload(
		guardian: Guardian,
		type: 'image_mat' | 'chibi' | 'icon' = 'image_mat'
	) {
		const input = type === 'chibi' ? chibiUploadInput : type === 'icon' ? iconUploadInput : uploadInput;
		if (!input) return;
		uploadTarget = guardian;
		uploadType = type;
		input.value = '';
		input.click();
	}

	async function handleImageUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !uploadTarget) return;

		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			input.value = '';
			uploadTarget = null;
			return;
		}

		if (file.size > 50 * 1024 * 1024) {
			alert('Image must be smaller than 50MB.');
			input.value = '';
			uploadTarget = null;
			return;
		}

		const guardian = uploadTarget;
		const type = uploadType;
		uploadTarget = null;
		uploadingId = guardian.id;

		try {
			const oldPathField =
				type === 'chibi'
					? guardian.chibi_image_path
					: type === 'icon'
						? guardian.icon_image_path
						: guardian.image_mat_path;
			if (oldPathField) {
				const oldPath = oldPathField.startsWith('guardians/')
					? oldPathField
					: `guardians/${oldPathField}`;
				await gameAssetsStorage.remove([oldPath]);
			}

			const croppedBlob = await cropEmptySpace(file);

			let finalBlob: Blob;
			let extension: string;
			let contentType: string;

			if (type === 'image_mat') {
				finalBlob = croppedBlob;
				extension = file.name.split('.').pop()?.toLowerCase() || 'png';
				contentType = file.type || 'image/png';
			} else {
				const result = await cropAndResizeToSquare(croppedBlob);
				finalBlob = result.blob;
				extension = result.ext;
				contentType = result.contentType;
			}

			const sanitizedName = sanitizeFilename(guardian.name);
			const fileName =
				type === 'chibi'
					? `guardian_${sanitizedName}_chibi`
					: type === 'icon'
						? `guardian_${sanitizedName}_icon`
						: `guardian_${sanitizedName}_image_mat`;
			const folder = `guardians/${guardian.id}`;

			// Use unified upload with transparent area cropping
			const { data, error: uploadError } = await processAndUploadImage(finalBlob, {
				folder,
				filename: fileName,
				cropTransparent: true,
				upsert: true
			});

			if (uploadError) throw uploadError;

			const fullPath = data?.path ?? '';

			const updateData: Record<string, any> = {
				updated_at: new Date().toISOString()
			};
			if (type === 'chibi') {
				updateData.chibi_image_path = fullPath;
			} else if (type === 'icon') {
				updateData.icon_image_path = fullPath;
			} else {
				updateData.image_mat_path = fullPath;
			}

			const { error: updateError } = await supabase
				.from('guardians')
				.update(updateData)
				.eq('id', guardian.id);

			if (updateError) throw updateError;

			await loadGuardians();
		} catch (err) {
			alert(`Failed to upload image: ${getErrorMessage(err)}`);
		} finally {
			uploadingId = null;
		}
	}

	async function removeImage(guardian: Guardian, type: 'image_mat' | 'chibi' | 'icon') {
		const pathField =
			type === 'chibi'
				? guardian.chibi_image_path
				: type === 'icon'
					? guardian.icon_image_path
					: guardian.image_mat_path;

		if (!pathField) return;

		const typeName = type === 'chibi' ? 'chibi image' : type === 'icon' ? 'icon image' : 'image mat';
		if (!confirm(`Remove ${typeName} for "${guardian.name}"?`)) return;

		uploadingId = guardian.id;
		try {
			const path = pathField.startsWith('guardians/') ? pathField : `guardians/${pathField}`;
			await gameAssetsStorage.remove([path]);

			const updateData: Record<string, any> = {
				updated_at: new Date().toISOString()
			};
			if (type === 'chibi') {
				updateData.chibi_image_path = null;
			} else if (type === 'icon') {
				updateData.icon_image_path = null;
			} else {
				updateData.image_mat_path = null;
			}

			const { error: updateError } = await supabase
				.from('guardians')
				.update(updateData)
				.eq('id', guardian.id);

			if (updateError) throw updateError;

			await loadGuardians();
		} catch (err) {
			alert(`Failed to remove image: ${getErrorMessage(err)}`);
		} finally {
			uploadingId = null;
		}
	}

	onMount(async () => {
		await loadOrigins();
		await loadGuardians();
	});

	async function loadOrigins() {
		const { data, error: fetchError } = await supabase
			.from('origins')
			.select('id, name')
			.order('position', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			return;
		}
		origins = data ?? [];
	}

	async function loadGuardians() {
		loading = true;
		error = null;
		try {
			const [guardianResult, artifactResult] = await Promise.all([
				supabase.from('guardians').select('*').order('created_at', { ascending: true }),
				supabase
					.from('artifacts')
					.select('id, name, benefit, recipe_box, guardian_id')
					.order('name', { ascending: true })
			]);
			if (guardianResult.error) throw guardianResult.error;
			if (artifactResult.error) throw artifactResult.error;
			guardians = guardianResult.data ?? [];
			const artifactList =
				(artifactResult.data ?? []).map((artifact) => ({
					...artifact,
					recipe_box: Array.isArray(artifact.recipe_box) ? artifact.recipe_box : []
				})) as Artifact[];
			const grouped: Record<string, Artifact[]> = {};
			for (const artifact of artifactList) {
				if (!artifact.guardian_id) continue;
				if (!grouped[artifact.guardian_id]) grouped[artifact.guardian_id] = [];
				grouped[artifact.guardian_id].push(artifact);
			}
			artifactsByGuardian = grouped;
		} catch (err) {
			error = getErrorMessage(err);
			artifactsByGuardian = {};
		} finally {
			loading = false;
		}
	}

	async function saveGuardian() {
		if (!modal.formData.origin_id) {
			alert('Select an origin for the guardian.');
			return;
		}

		if (!modal.formData.name?.trim()) {
			if (modal.isEditing && guardianLanguage !== BASE_LANGUAGE) {
				// Allow clearing translations
			} else {
				alert('Guardian name is required.');
				return;
			}
		}

		const normalizedName = modal.formData.name?.trim() ?? '';

		try {
			if (modal.isEditing) {
				const existing = guardians.find((g) => g.id === modal.editingId);
				if (!existing) {
					alert('Guardian not found.');
					return;
				}

				const updatePayload: Record<string, unknown> = {
					origin_id: modal.formData.origin_id,
					updated_at: new Date().toISOString()
				};

				if (guardianLanguage === BASE_LANGUAGE) {
					updatePayload.name = normalizedName;
				} else {
					const current = ensureTranslationRecord(existing.name_translations);
					const next = { ...current };
					if (normalizedName) next[String(guardianLanguage)] = normalizedName;
					else delete next[String(guardianLanguage)];
					updatePayload.name_translations = next;
				}

				const { error: updateError } = await supabase
					.from('guardians')
					.update(updatePayload)
					.eq('id', modal.editingId!);
				if (updateError) throw updateError;
			} else {
				if (guardianLanguage !== BASE_LANGUAGE) {
					alert('Switch to Default language to create a new guardian.');
					return;
				}

				const payload = {
					name: normalizedName,
					origin_id: modal.formData.origin_id
				};

				const { error: insertError } = await supabase.from('guardians').insert(payload);
				if (insertError) throw insertError;
			}

			modal.close();
			await loadGuardians();
		} catch (err) {
			alert(`Failed to save guardian: ${getErrorMessage(err)}`);
		}
	}

	async function deleteGuardian(guardian: Guardian) {
		if (!confirm(`Delete guardian "${guardian.name}"?`)) return;
		try {
			const { error: deleteError } = await supabase
				.from('guardians')
				.delete()
				.eq('id', guardian.id);
			if (deleteError) throw deleteError;
			await loadGuardians();
		} catch (err) {
			alert(`Failed to delete guardian: ${getErrorMessage(err)}`);
		}
	}

	async function deleteGuardians(ids: string[]) {
		if (ids.length === 0) return;
		if (!confirm(`Delete ${ids.length} guardian${ids.length === 1 ? '' : 's'}?`)) return;
		try {
			const { error: deleteError } = await supabase
				.from('guardians')
				.delete()
				.in('id', ids);
			if (deleteError) throw deleteError;
			await loadGuardians();
		} catch (err) {
			alert(`Failed to delete guardians: ${getErrorMessage(err)}`);
		}
	}

	const originName = (originId: string) =>
		origins.find((o) => o.id === originId)?.name ?? 'Unknown Origin';

	const filteredGuardians = $derived(
		guardians.filter((guardian) => {
			if (originFilter !== 'all' && guardian.origin_id !== originFilter) return false;
			if (search.trim()) {
				const term = search.trim().toLowerCase();
				const displayName = getGuardianName(guardian, guardianLanguage).toLowerCase();
				const baseName = guardian.name.toLowerCase();
				return (
					baseName.includes(term) ||
					displayName.includes(term) ||
					originName(guardian.origin_id).toLowerCase().includes(term)
				);
			}
			return true;
		})
	);

	function openCreateGuardian() {
		if (guardianLanguage !== BASE_LANGUAGE) {
			alert('Switch to Default language to create a new guardian.');
			return;
		}
		modal.open();
	}

	function openEditGuardian(guardian: Guardian) {
		const displayName =
			guardianLanguage === BASE_LANGUAGE
				? guardian.name
				: getTranslationValue(guardian.name_translations, guardianLanguage) ?? '';
		modal.open({ id: guardian.id, name: displayName, origin_id: guardian.origin_id });
	}

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}
</script>

<PageLayout
	title="Guardians"
	subtitle="Track the exceptional spirits tied to each origin"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	{#snippet headerActions()}
		<Button variant="primary" onclick={openCreateGuardian}>Create Guardian</Button>
	{/snippet}

	{#snippet tabActions()}
		<div class="guardian-actions-row">
			<span class="guardian-count">{filteredGuardians.length} guardians</span>

			<div class="guardian-language">
				<span class="guardian-language__label">Language</span>
				<Select bind:value={guardianLanguageSelect} options={guardianLanguageOptions} disabled={loading} />
				<Input
					bind:value={newGuardianLanguageDraft}
					placeholder="Add lang (e.g. es, fr-CA)"
					disabled={loading}
				/>
				<Button
					variant="secondary"
					size="sm"
					onclick={addGuardianLanguage}
					disabled={loading || normalizeOptionalText(newGuardianLanguageDraft) === null}
				>
					Add
				</Button>
			</div>
		</div>
	{/snippet}

	<div class="filters">
		<FormField label="Search">
			<Input type="search" placeholder="Search guardians" bind:value={search} />
		</FormField>
		<FormField label="Origin">
			<Select
				bind:value={originFilter}
				options={[
					{ value: 'all', label: 'All origins' },
					...origins.map((o) => ({ value: o.id, label: o.name }))
				]}
			/>
		</FormField>
	</div>

	{#if loading}
		<div class="loading-state">Loading guardians...</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else if activeTab === 'list'}
		<GuardiansListView
			guardians={filteredGuardians}
			language={guardianLanguage}
			{origins}
			{artifactsByGuardian}
			onEdit={openEditGuardian}
			onDelete={deleteGuardian}
			onDeleteMultiple={deleteGuardians}
			onUploadImage={promptImageUpload}
			onRemoveImage={removeImage}
			{uploadingId}
		/>
	{:else if activeTab === 'table'}
		<GuardiansTableView
			guardians={filteredGuardians}
			language={guardianLanguage}
			{origins}
			{artifactsByGuardian}
			onEdit={openEditGuardian}
		/>
	{/if}
</PageLayout>

<Modal bind:open={modal.isOpen} title={modal.isEditing ? 'Edit Guardian' : 'Create Guardian'}>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			void saveGuardian();
		}}
	>
		<FormField label={`Name${guardianLanguage === BASE_LANGUAGE ? '' : ` (${guardianLanguage})`}`} required={guardianLanguage === BASE_LANGUAGE}>
			<Input type="text" bind:value={modal.formData.name} required={guardianLanguage === BASE_LANGUAGE} />
		</FormField>
		<FormField label="Origin" required>
			<Select
				bind:value={modal.formData.origin_id}
				options={[
					{ value: '', label: 'Select origin' },
					...origins.map((o) => ({ value: o.id, label: o.name }))
				]}
				required
			/>
		</FormField>
		<div class="modal__actions">
			<Button type="submit">Save</Button>
			<Button type="button" onclick={() => modal.close()}>Cancel</Button>
		</div>
	</form>
</Modal>

<input
	type="file"
	accept="image/*"
	bind:this={uploadInput}
	onchange={handleImageUpload}
	style="display: none;"
/>
<input
	type="file"
	accept="image/*"
	bind:this={chibiUploadInput}
	onchange={handleImageUpload}
	style="display: none;"
/>
<input
	type="file"
	accept="image/*"
	bind:this={iconUploadInput}
	onchange={handleImageUpload}
	style="display: none;"
/>

<style>
	.guardian-count {
		font-size: 0.7rem;
		color: #64748b;
	}

	.guardian-actions-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.guardian-language {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.guardian-language__label {
		font-size: 0.7rem;
		color: #64748b;
	}

	.filters {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.5rem;
		margin-bottom: 0.5rem;
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

	.modal__actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		margin-top: 1rem;
	}
</style>
