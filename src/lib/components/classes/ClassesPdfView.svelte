<script lang="ts">
	import { onMount } from 'svelte';
	import type { ClassRow, SpecialCategoryRow } from '$lib/types/gameData';
	import type { Effect, EffectBreakpoint, DiceEffect } from '$lib/types/effects';
	import html2canvas from 'html2canvas';
	import jsPDF from 'jspdf';
	import {
		parseEffectSchema,
		formatEffectSummary,
		parsePrismaticJson
	} from '$lib/features/classes/classes';
	import { Button } from '$lib/components/ui';
	import { BASE_LANGUAGE, type TranslationLanguage, getTranslationValue } from '$lib/i18n/translations';
	import { publicAssetUrl } from '$lib/utils';

	interface Props {
		classes: ClassRow[];
		specialCategories: SpecialCategoryRow[];
		diceNameById: Map<string, string>;
		language?: TranslationLanguage;
	}

	let { classes, specialCategories, diceNameById, language = BASE_LANGUAGE }: Props = $props();

	// Preview state
	let previewImages = $state<string[]>([]);
	let generatingPreview = $state(false);
	let exporting = $state(false);
	let previewContainer: HTMLDivElement | null = null;

	function getIconUrl(iconPng: string | null | undefined, updatedAt?: string | null): string | null {
		if (!iconPng) return null;
		const path = iconPng.startsWith('class_icons/') ? iconPng : `class_icons/${iconPng}`;
		return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
	}

	const resolveDiceLabel = (id: string | null | undefined, fallback?: string) => {
		if (id && diceNameById.has(id)) return diceNameById.get(id) ?? fallback ?? 'Custom Dice';
		return fallback ?? (id ?? 'Custom Dice');
	};

	const summarizeEffectBase = (effect: Effect) => formatEffectSummary(effect, resolveDiceLabel, language);

	function getBreakpointCount(bp: EffectBreakpoint): string | number {
		if (language === BASE_LANGUAGE) return bp.count;
		if (typeof bp.count !== 'string') return bp.count;
		return getTranslationValue((bp as any).count_translations, String(language)) ?? bp.count;
	}

	function toNumericCount(count: EffectBreakpoint['count']): number | null {
		if (typeof count === 'number' && Number.isFinite(count)) return count;
		if (typeof count === 'string') {
			const trimmed = count.trim();
			if (!/^\d+$/.test(trimmed)) return null;
			const parsed = Number.parseInt(trimmed, 10);
			if (Number.isFinite(parsed)) return parsed;
		}
		return null;
	}

	function sortBreakpointsByCount(breakpoints: EffectBreakpoint[]): EffectBreakpoint[] {
		return [...breakpoints]
			.map((bp, index) => ({ bp, index }))
			.sort((a, b) => {
				const aNumeric = toNumericCount(a.bp.count);
				const bNumeric = toNumericCount(b.bp.count);

				if (aNumeric !== null && bNumeric !== null) return aNumeric - bNumeric;
				if (aNumeric !== null) return -1;
				if (bNumeric !== null) return 1;
				return a.index - b.index;
			})
			.map(({ bp }) => bp);
	}

	function summarizeEffectWithScaling(className: string, effect: Effect): string {
		if (effect.type !== 'dice') {
			return summarizeEffectBase(effect);
		}

		const diceEffect = effect as DiceEffect;
		const diceLabelRaw = resolveDiceLabel(diceEffect.dice_id, diceEffect.dice_name);
		const diceLabel = (diceLabelRaw ?? diceEffect.dice_name ?? diceEffect.dice_id ?? 'Custom Dice')
			.replace(/\s+/g, ' ')
			.trim();
		const quantityValue = Number(diceEffect.quantity ?? 0);
		const quantityDisplay = Number.isFinite(quantityValue)
			? Math.max(0, Math.floor(quantityValue))
			: 0;
		const fallbackSummary = `${quantityDisplay}× ${diceLabel}`;

		const isSorcerer = className?.trim().toLowerCase() === 'sorcerer';
		if (isSorcerer) {
			return `${quantityDisplay}× ${diceLabel} × Runes`;
		}

		const baseSummary = summarizeEffectBase(effect);
		return baseSummary && baseSummary.trim().length ? baseSummary : fallbackSummary;
	}

	function resolveDiceIdsInSchema(schema: EffectBreakpoint[]): EffectBreakpoint[] {
		return schema.map((bp) => {
			const updatedEffects = bp.effects.map((effect) => {
				if (effect.type !== 'dice') return effect;
				const typed = effect as DiceEffect;
				if (typed.dice_id && diceNameById.has(typed.dice_id)) {
					return { ...typed, dice_name: diceNameById.get(typed.dice_id) ?? typed.dice_name };
				}
				return typed;
			});
			return { ...bp, effects: updatedEffects };
		});
	}

	function renderMultiline(value?: string | null): string {
		return (value ?? '').replace(/\r\n/g, '\n').trim();
	}

	function getClassName(entry: ClassRow): string {
		if (language === BASE_LANGUAGE) return entry.name;
		return getTranslationValue(entry.name_translations, String(language)) ?? entry.name;
	}

	function getClassDescription(entry: ClassRow): string {
		if (language === BASE_LANGUAGE) return entry.description ?? '';
		return getTranslationValue(entry.description_translations, String(language)) ?? entry.description ?? '';
	}

	function getClassFooter(entry: ClassRow): string {
		if (language === BASE_LANGUAGE) return entry.footer ?? '';
		return getTranslationValue(entry.footer_translations, String(language)) ?? entry.footer ?? '';
	}

	function getClassById(id: string): ClassRow | undefined {
		return classes.find((c) => c.id === id);
	}

	const getPrismatic = parsePrismaticJson;

	// Helper to render a regular class card
	function renderClassCard(entry: ClassRow): string {
		const effectSchema = sortBreakpointsByCount(
			resolveDiceIdsInSchema(parseEffectSchema(entry.effect_schema))
		);
		const displayName = getClassName(entry);
		const description = renderMultiline(getClassDescription(entry));
		const footer = renderMultiline(getClassFooter(entry));
		const prismatic = getPrismatic(entry.prismatic);
		const tags =
			Array.isArray(entry.tags) && entry.tags.length
				? entry.tags
						.map(
							(tag) =>
								`<span style="display:inline-block; padding:2px 6px; border-radius:999px; background:#e2e8f0; color:#0f172a; font-size:8px; margin-right:4px; margin-bottom:4px;">${tag}</span>`
						)
						.join('')
				: '';

		const iconUrl = getIconUrl(entry.icon_png, entry.updated_at);
		const iconHtml = iconUrl
			? `<div style="width:24px; height:24px; background-color:#ffffff; border-radius:4px; display:flex; align-items:center; justify-content:center;"><img src="${iconUrl}" style="width:100%; height:100%; object-fit:contain;" crossorigin="anonymous" /></div>`
			: `<span style="font-size:18px; line-height:1;">${entry.icon_emoji ?? '🛡️'}</span>`;

		return `
		<div style="padding: 10px; border: 3px solid ${entry.color ?? '#8b5cf6'}; background: #ffffff; border-radius: 8px; display: flex; flex-direction: column;">
			<div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
				${iconHtml}
				<div style="flex:1;">
					<h3 style="margin:0; font-size:14px; font-weight:700; color:#1e293b; line-height:1.2;">${displayName}</h3>
				</div>
				${tags ? `<div style="display:flex; flex-wrap:wrap; justify-content:flex-end; gap:2px;">${tags}</div>` : ''}
			</div>
			${description ? `<p style="margin:4px 0; font-size:9px; color:#475569; line-height:1.3; white-space:pre-line;">${description}</p>` : ''}
			${
				effectSchema.length
					? effectSchema
							.map(
								(bp) => `
						<div style="margin:3px 0; font-size:8px; line-height:1.3;">
							<strong style="color:#0f172a;">${getBreakpointCount(bp)}:</strong>
							<span style="color:#64748b;">
								${bp.effects.map((effect) => summarizeEffectWithScaling(entry.name, effect)).join(', ')}
							</span>
						</div>
					`
							)
							.join('')
					: '<p style="margin:4px 0; font-size:8px; font-style:italic; color:#94a3b8;">No effects configured.</p>'
			}
			${
				prismatic
					? `
				<div style="margin:4px 0; padding:6px; background:linear-gradient(135deg, #ede9fe, #ddd6fe, #c7d2fe); border-radius:4px; font-size:8px; line-height:1.3;">
					<strong style="color:#7c3aed; font-size:9px;">${prismatic.count || ''} ${prismatic.name}</strong>
					${prismatic.description ? `<div style="margin-top:3px; color:#6b21a8;">${prismatic.description}</div>` : ''}
				</div>
			`
					: ''
			}
			${footer ? `<div style="margin-top:6px; padding-top:4px; border-top:1px solid #e2e8f0; font-size:7px; color:#94a3b8; white-space:pre-line;">${footer}</div>` : ''}
		</div>
	`;
	}

	// Helper to render a special category card
	function renderSpecialCategoryCard(category: SpecialCategoryRow): string {
		const renderSlot = (slotIds: string[], slotIndex: number) => {
			if (slotIds.length === 0) {
				return `<div style="flex:1; padding:6px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:4px; display:flex; align-items:center; justify-content:center;">
				<span style="font-size:7px; color:#94a3b8; font-style:italic;">Slot ${slotIndex + 1}</span>
			</div>`;
			}

			const classesHtml = slotIds
				.map((classId) => {
					const cls = getClassById(classId);
					if (!cls) return '';

					const effectSchema = sortBreakpointsByCount(
						resolveDiceIdsInSchema(parseEffectSchema(cls.effect_schema))
					);

					const breakpointsHtml = effectSchema
						.map(
							(bp) =>
								`<div style="font-size:6px; color:#64748b; line-height:1.2;">(${getBreakpointCount(bp)}) ${bp.effects.map((e) => summarizeEffectWithScaling(cls.name, e)).join(', ')}</div>`
						)
						.join('');

					const displayName = getClassName(cls);
					const iconUrl = getIconUrl(cls.icon_png, cls.updated_at);
					const iconHtml = iconUrl
						? `<div style="width:14px; height:14px; background-color:#ffffff; border-radius:3px; display:flex; align-items:center; justify-content:center;"><img src="${iconUrl}" style="width:100%; height:100%; object-fit:contain;" crossorigin="anonymous" /></div>`
						: `<span style="font-size:10px;">${cls.icon_emoji ?? '🛡️'}</span>`;
					return `
					<div style="padding-left:6px; border-left:2px solid ${cls.color ?? '#8b5cf6'};">
						<div style="display:flex; align-items:center; gap:4px; margin-bottom:2px;">
							${iconHtml}
							<span style="font-size:8px; font-weight:600; color:#1e293b;">${displayName}</span>
						</div>
						${breakpointsHtml}
					</div>
				`;
				})
				.join('');

			return `<div style="flex:1; padding:6px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; display:flex; flex-direction:column; gap:4px;">
			${classesHtml}
		</div>`;
		};

		const description = category.description
			? `<p style="margin:4px 0 6px 0; font-size:8px; color:#475569; line-height:1.3;">${category.description}</p>`
			: '';

		return `
		<div style="padding: 10px; border: 3px solid ${category.color ?? '#8b5cf6'}; background: #ffffff; border-radius: 8px; display: flex; flex-direction: column;">
			<div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
				<span style="font-size:18px; line-height:1;">${category.icon_emoji ?? '⚡'}</span>
				<h3 style="margin:0; font-size:14px; font-weight:700; color:#1e293b; line-height:1.2;">${category.name}</h3>
			</div>
			${description}
			<div style="display:flex; flex-direction:column; gap:4px; flex:1;">
				${renderSlot(category.slot_1_class_ids, 0)}
				${renderSlot(category.slot_2_class_ids, 1)}
				${renderSlot(category.slot_3_class_ids, 2)}
			</div>
		</div>
	`;
	}

	function getPageChunks() {
		const specialClassIds = new Set(
			specialCategories.flatMap((cat) => [
				...cat.slot_1_class_ids,
				...cat.slot_2_class_ids,
				...cat.slot_3_class_ids
			])
		);

		const regularClasses = classes.filter((c) => !specialClassIds.has(c.id));
		const sorted = [...regularClasses].sort(
			(a, b) => a.position - b.position || a.name.localeCompare(b.name)
		);

		type CardItem =
			| { type: 'class'; data: ClassRow }
			| { type: 'special'; data: SpecialCategoryRow };
		const allCards: CardItem[] = [
			...specialCategories.map((cat) => ({ type: 'special' as const, data: cat })),
			...sorted.map((cls) => ({ type: 'class' as const, data: cls }))
		];

		const chunkSize = 9;
		const chunks: CardItem[][] = [];
		for (let i = 0; i < allCards.length; i += chunkSize) {
			chunks.push(allCards.slice(i, i + chunkSize));
		}
		return chunks;
	}

	async function generatePreview() {
		if (!classes.length && !specialCategories.length) {
			previewImages = [];
			return;
		}

		generatingPreview = true;
		const images: string[] = [];

		try {
			const chunks = getPageChunks();

			const tempContainer = document.createElement('div');
			tempContainer.style.position = 'absolute';
			tempContainer.style.left = '-9999px';
			tempContainer.style.width = '8.5in';
			tempContainer.style.height = '11in';
			tempContainer.style.backgroundColor = '#ffffff';
			tempContainer.style.padding = '0.5in';
			tempContainer.style.colorScheme = 'light';
			tempContainer.style.boxSizing = 'border-box';
			tempContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
			document.body.appendChild(tempContainer);

			for (let pageIndex = 0; pageIndex < chunks.length; pageIndex += 1) {
				const group = chunks[pageIndex];

				tempContainer.innerHTML = `
					<div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
						<h1 style="margin: 0 0 16px 0; font-size: 22px; color: #1e293b; text-align: center;">
							Arc Spirits Classes
						</h1>
						<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; grid-auto-rows: min-content;">
							${group
								.map((item) => {
									if (item.type === 'special') {
										return renderSpecialCategoryCard(item.data);
									} else {
										return renderClassCard(item.data);
									}
								})
								.join('')}
						</div>
					</div>
				`;

				// Wait for images to load
				const imgElements = tempContainer.querySelectorAll('img');
				await Promise.all(
					Array.from(imgElements).map(
						(img) =>
							new Promise<void>((resolve) => {
								if (img.complete) {
									resolve();
								} else {
									img.onload = () => resolve();
									img.onerror = () => resolve();
								}
							})
					)
				);

				const canvas = await html2canvas(tempContainer, {
					scale: 1.5,
					backgroundColor: '#ffffff',
					useCORS: true,
					allowTaint: false
				});
				images.push(canvas.toDataURL('image/png'));
			}

			document.body.removeChild(tempContainer);
			previewImages = images;
		} catch (err) {
			console.error('Failed to generate preview:', err);
		} finally {
			generatingPreview = false;
		}
	}

	async function exportToPDF() {
		if (!classes.length && !specialCategories.length) {
			alert('No classes to export.');
			return;
		}

		exporting = true;

		try {
			const chunks = getPageChunks();

			const pdf = new jsPDF({
				orientation: 'portrait',
				unit: 'in',
				format: 'letter'
			});

			const tempContainer = document.createElement('div');
			tempContainer.style.position = 'absolute';
			tempContainer.style.left = '-9999px';
			tempContainer.style.width = '8.5in';
			tempContainer.style.height = '11in';
			tempContainer.style.backgroundColor = '#ffffff';
			tempContainer.style.padding = '0.5in';
			tempContainer.style.colorScheme = 'light';
			tempContainer.style.boxSizing = 'border-box';
			tempContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
			document.body.appendChild(tempContainer);

			for (let pageIndex = 0; pageIndex < chunks.length; pageIndex += 1) {
				const group = chunks[pageIndex];

				tempContainer.innerHTML = `
					<div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
						<h1 style="margin: 0 0 16px 0; font-size: 22px; color: #1e293b; text-align: center;">
							Arc Spirits Classes
						</h1>
						<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; grid-auto-rows: min-content;">
							${group
								.map((item) => {
									if (item.type === 'special') {
										return renderSpecialCategoryCard(item.data);
									} else {
										return renderClassCard(item.data);
									}
								})
								.join('')}
						</div>
					</div>
				`;

				const imgElements = tempContainer.querySelectorAll('img');
				await Promise.all(
					Array.from(imgElements).map(
						(img) =>
							new Promise<void>((resolve) => {
								if (img.complete) {
									resolve();
								} else {
									img.onload = () => resolve();
									img.onerror = () => resolve();
								}
							})
					)
				);

				const canvas = await html2canvas(tempContainer, {
					scale: 2,
					backgroundColor: '#ffffff',
					useCORS: true,
					allowTaint: false
				});
				const imgData = canvas.toDataURL('image/png');
				if (pageIndex > 0) {
					pdf.addPage();
				}
				pdf.addImage(imgData, 'PNG', 0, 0, 8.5, 11);
			}

			pdf.save('arc-spirits-classes.pdf');
			document.body.removeChild(tempContainer);
		} catch (err) {
			console.error(err);
			alert('Failed to export classes. Please try again.');
		} finally {
			exporting = false;
		}
	}

	// Generate preview on mount and when data changes
	onMount(() => {
		generatePreview();
	});

	$effect(() => {
		// Re-generate preview when classes or specialCategories change
		if (classes.length || specialCategories.length) {
			generatePreview();
		}
	});
</script>

<div class="pdf-view">
	<div class="pdf-header">
		<div class="pdf-info">
			<h3>Class Cards PDF</h3>
			<p>{classes.length} classes, {specialCategories.length} special categories, {previewImages.length} pages</p>
		</div>
		<div class="pdf-actions">
			<Button variant="secondary" onclick={generatePreview} disabled={generatingPreview}>
				{generatingPreview ? 'Refreshing...' : 'Refresh Preview'}
			</Button>
			<Button variant="primary" onclick={exportToPDF} disabled={exporting || generatingPreview}>
				{exporting ? 'Exporting...' : 'Download PDF'}
			</Button>
		</div>
	</div>

	<div class="preview-container" bind:this={previewContainer}>
		{#if generatingPreview && previewImages.length === 0}
			<div class="loading-state">Generating preview...</div>
		{:else if previewImages.length === 0}
			<div class="empty-state">No classes to preview</div>
		{:else}
			<div class="preview-grid">
				{#each previewImages as src, index}
					<div class="preview-page">
						<div class="page-label">Page {index + 1}</div>
						<img {src} alt="Page {index + 1}" />
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.pdf-view {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		height: 100%;
	}

	.pdf-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.5rem;
		background: rgba(15, 23, 42, 0.4);
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.1);
	}

	.pdf-info h3 {
		margin: 0;
		font-size: 0.85rem;
		color: #f8fafc;
	}

	.pdf-info p {
		margin: 0.25rem 0 0 0;
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.pdf-actions {
		display: flex;
		gap: 0.5rem;
	}

	.preview-container {
		flex: 1;
		overflow: auto;
		background: rgba(15, 23, 42, 0.3);
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.1);
		padding: 1rem;
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.preview-page {
		background: rgba(30, 41, 59, 0.4);
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		overflow: hidden;
	}

	.page-label {
		padding: 0.35rem 0.5rem;
		font-size: 0.65rem;
		font-weight: 600;
		color: #94a3b8;
		background: rgba(15, 23, 42, 0.5);
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.preview-page img {
		width: 100%;
		height: auto;
		display: block;
	}

	.loading-state,
	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 200px;
		color: #64748b;
		font-size: 0.75rem;
	}
</style>
