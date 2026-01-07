<script lang="ts">
	import Modal from '$lib/components/layout/Modal.svelte';
	import { FormField, Input, Textarea, Button } from '$lib/components/ui';
	import { IconPicker } from '$lib/components/shared';
	import type { VengeanceCardRow } from '$lib/types/gameData';
	import { getIconPoolUrl } from '$lib/utils/iconPool';

	interface Props {
		open?: boolean;
		card?: Partial<VengeanceCardRow>;
		onsave?: (card: Partial<VengeanceCardRow>) => void;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		card = $bindable<Partial<VengeanceCardRow>>({}),
		onsave,
		onclose
	}: Props = $props();

	let showIconPicker = $state(false);
	let rewardMode = $state<'icons' | 'text'>('icons');
	let tagInput = $state('');

	const titleText = $derived.by(() => (card.id ? 'Edit Vengeance Card' : 'Create Vengeance Card'));

	function ensureDefaults() {
		if (!card.reward_icon_ids) card.reward_icon_ids = [];
		if (card.reward_text === undefined) card.reward_text = null;
		if (card.description === undefined) card.description = null;
		if (!Array.isArray(card.tags)) card.tags = [];
		if (card.order_num === undefined || card.order_num === null) card.order_num = 0;
		const rawQuantity = (card as any).quantity;
		const normalizedQuantity = Number.isFinite(Number(rawQuantity))
			? Math.max(1, Math.trunc(Number(rawQuantity)))
			: 1;
		card.quantity = normalizedQuantity;
	}

	function setRewardMode(mode: 'icons' | 'text') {
		rewardMode = mode;
		showIconPicker = false;
		if (mode === 'icons') {
			card.reward_text = null;
		} else {
			card.reward_icon_ids = [];
		}
	}

	function normalizeTag(raw: string): string {
		return raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
	}

	function addTag() {
		ensureDefaults();
		const next = normalizeTag(tagInput);
		if (!next) {
			tagInput = '';
			return;
		}
		const tags = card.tags ?? [];
		if (!tags.includes(next)) {
			card.tags = [...tags, next];
		}
		tagInput = '';
	}

	function removeTag(tag: string) {
		ensureDefaults();
		card.tags = (card.tags ?? []).filter((t) => t !== tag);
	}

	function handleTagKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addTag();
		}
	}

	function close() {
		open = false;
		onclose?.();
	}

	function removeRewardAt(index: number) {
		ensureDefaults();
		const icons = card.reward_icon_ids ?? [];
		card.reward_icon_ids = icons.filter((_, i) => i !== index);
	}

	function save() {
		ensureDefaults();
		const title = (card.title ?? '').trim();
		if (!title) {
			alert('Title is required.');
			return;
		}

		const rewardText = (card.reward_text ?? '').trim();
		const rewardIconIds = card.reward_icon_ids ?? [];
		const tags = (card.tags ?? []).map(normalizeTag).filter(Boolean);
		card.tags = Array.from(new Set(tags));
		const quantity = Math.max(1, Math.trunc(Number((card as any).quantity ?? 1)));

		onsave?.({
			...card,
			title,
			description: (card.description ?? null) || null,
			reward_text: rewardMode === 'text' && rewardText ? rewardText : null,
			reward_icon_ids: rewardMode === 'text' ? [] : rewardIconIds,
			order_num: card.order_num ?? 0,
			quantity
		});
		close();
	}

	let lastOpen = false;
	$effect(() => {
		if (open && !lastOpen) {
			ensureDefaults();
			rewardMode = (card.reward_text ?? '').trim() ? 'text' : 'icons';
			showIconPicker = false;
			tagInput = '';
		}
		lastOpen = open;
	});
</script>

<Modal bind:open size="md" title={titleText} closeOnBackdrop={true} closeOnEscape={true}>
	{#snippet children()}
		<FormField label="Title" required>
			<Input type="text" bind:value={card.title} placeholder="Card title..." />
		</FormField>

		<FormField label="Description">
			<Textarea rows={4} bind:value={card.description} placeholder="Description..." />
		</FormField>

		<FormField label="Tags">
			<div class="tag-editor">
				<div class="tag-input">
					<Input
						type="text"
						bind:value={tagInput}
						placeholder="Add a tag (press Enter)…"
						onkeydown={handleTagKeydown}
					/>
					<Button variant="secondary" onclick={addTag}>Add</Button>
				</div>

				{#if card.tags && card.tags.length > 0}
					<div class="tag-list">
						{#each card.tags as tag, idx (`tag-${idx}`)}
							<button type="button" class="tag-pill" onclick={() => removeTag(tag)} title="Remove tag">
								{tag} <span aria-hidden="true">×</span>
							</button>
						{/each}
					</div>
				{:else}
					<div class="tag-empty">No tags</div>
				{/if}
			</div>
		</FormField>

		<FormField label="Quantity" helperText="Copies to export (TTS)">
			<Input type="number" min={1} step={1} bind:value={card.quantity} />
		</FormField>

		<div class="reward-section">
			<div class="reward-header">
				<div class="reward-title">Reward</div>
				{#if rewardMode === 'icons'}
					<Button variant="secondary" onclick={() => (showIconPicker = !showIconPicker)}>
						{showIconPicker ? 'Hide Picker' : 'Edit Icons'}
					</Button>
				{/if}
			</div>

			<div class="reward-mode">
				<Button variant={rewardMode === 'icons' ? 'primary' : 'secondary'} onclick={() => setRewardMode('icons')}>
					Icons
				</Button>
				<Button variant={rewardMode === 'text' ? 'primary' : 'secondary'} onclick={() => setRewardMode('text')}>
					Text
				</Button>
			</div>

			{#if rewardMode === 'text'}
				<FormField label="Reward Text">
					<Textarea rows={2} bind:value={card.reward_text} placeholder="Reward text..." />
				</FormField>
			{:else}
				<div class="reward-preview">
					{#if card.reward_icon_ids && card.reward_icon_ids.length > 0}
						{#each card.reward_icon_ids as iconId, idx (`reward-${idx}`)}
							{@const url = getIconPoolUrl(iconId)}
							<button type="button" class="reward-pill" onclick={() => removeRewardAt(idx)} title="Remove">
								{#if url}
									<img src={url} alt="" />
								{:else}
									<span>?</span>
								{/if}
							</button>
						{/each}
					{:else}
						<span class="reward-empty">No reward icons selected.</span>
					{/if}
				</div>

				{#if showIconPicker}
					<div class="reward-picker">
						<IconPicker
							selected={card.reward_icon_ids ?? []}
							onselect={(ids) => (card.reward_icon_ids = ids)}
							multiple={true}
							maxSelection={10}
							allowDuplicates={true}
						/>
					</div>
				{/if}
			{/if}
		</div>

		<div class="actions">
			<Button variant="secondary" onclick={close}>Cancel</Button>
			<Button variant="primary" onclick={save}>Save</Button>
		</div>
	{/snippet}
</Modal>

<style>
	.tag-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tag-input {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.tag-pill {
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.35);
		color: rgba(226, 232, 240, 0.9);
		padding: 0.25rem 0.5rem;
		border-radius: 999px;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.tag-pill:hover {
		border-color: rgba(59, 130, 246, 0.45);
	}

	.tag-empty {
		font-size: 0.85rem;
		color: rgba(226, 232, 240, 0.6);
	}

	.reward-section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.6rem;
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 10px;
		background: rgba(2, 6, 23, 0.25);
	}

	.reward-header {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
	}

	.reward-title {
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(226, 232, 240, 0.85);
	}

	.reward-mode {
		display: flex;
		gap: 0.5rem;
	}

	.reward-preview {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		min-height: 40px;
	}

	.reward-pill {
		width: 40px;
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.35);
		cursor: pointer;
		padding: 0;
	}

	.reward-pill img {
		width: 28px;
		height: 28px;
		object-fit: contain;
	}

	.reward-empty {
		color: rgba(226, 232, 240, 0.6);
		font-size: 0.85rem;
	}

	.reward-picker {
		margin-top: 0.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		padding-top: 0.5rem;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
</style>

