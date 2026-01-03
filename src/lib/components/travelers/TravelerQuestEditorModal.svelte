<script lang="ts">
	import Modal from '$lib/components/layout/Modal.svelte';
	import { FormField, Input, Textarea, Button } from '$lib/components/ui';
	import { IconPicker } from '$lib/components/shared';
	import type { TravelerQuestRow } from '$lib/types/gameData';
	import { getIconPoolUrl } from '$lib/utils/iconPool';

	interface Props {
		open?: boolean;
		quest?: Partial<TravelerQuestRow>;
		onsave?: (quest: Partial<TravelerQuestRow>) => void;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		quest = $bindable<Partial<TravelerQuestRow>>({}),
		onsave,
		onclose
	}: Props = $props();

	let showIconPicker = $state(false);
	let rewardMode = $state<'icons' | 'text'>('icons');
	let tagInput = $state('');

	const titleText = $derived.by(() => (quest.id ? 'Edit Traveler Quest' : 'Create Traveler Quest'));

	function ensureDefaults() {
		if (!quest.reward_icon_ids) quest.reward_icon_ids = [];
		if (quest.reward_text === undefined) quest.reward_text = null;
		if (quest.description === undefined) quest.description = null;
		if (!Array.isArray(quest.tags)) quest.tags = [];
		if (quest.order_num === undefined || quest.order_num === null) quest.order_num = 0;
	}

	function setRewardMode(mode: 'icons' | 'text') {
		rewardMode = mode;
		showIconPicker = false;
		if (mode === 'icons') {
			quest.reward_text = null;
		} else {
			quest.reward_icon_ids = [];
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
		const tags = quest.tags ?? [];
		if (!tags.includes(next)) {
			quest.tags = [...tags, next];
		}
		tagInput = '';
	}

	function removeTag(tag: string) {
		ensureDefaults();
		quest.tags = (quest.tags ?? []).filter((t) => t !== tag);
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
		const icons = quest.reward_icon_ids ?? [];
		quest.reward_icon_ids = icons.filter((_, i) => i !== index);
	}

	function save() {
		ensureDefaults();
		const title = (quest.title ?? '').trim();
		if (!title) {
			alert('Title is required.');
			return;
		}

		const rewardText = (quest.reward_text ?? '').trim();
		const rewardIconIds = quest.reward_icon_ids ?? [];
		const tags = (quest.tags ?? []).map(normalizeTag).filter(Boolean);
		quest.tags = Array.from(new Set(tags));

		onsave?.({
			...quest,
			title,
			description: (quest.description ?? null) || null,
			reward_text: rewardMode === 'text' && rewardText ? rewardText : null,
			reward_icon_ids: rewardMode === 'text' ? [] : rewardIconIds,
			order_num: quest.order_num ?? 0
		});
		close();
	}

	let lastOpen = false;
	$effect(() => {
		if (open && !lastOpen) {
			ensureDefaults();
			rewardMode = (quest.reward_text ?? '').trim() ? 'text' : 'icons';
			showIconPicker = false;
			tagInput = '';
		}
		lastOpen = open;
	});
</script>

<Modal bind:open size="md" title={titleText} closeOnBackdrop={true} closeOnEscape={true}>
		{#snippet children()}
			<FormField label="Title" required>
				<Input type="text" bind:value={quest.title} placeholder="Quest title..." />
			</FormField>

			<FormField label="Description">
				<Textarea rows={4} bind:value={quest.description} placeholder="Quest description..." />
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

					{#if quest.tags && quest.tags.length > 0}
						<div class="tag-list">
							{#each quest.tags as tag, idx (`tag-${idx}`)}
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
						<Textarea rows={2} bind:value={quest.reward_text} placeholder="Reward text..." />
					</FormField>
				{:else}
					<div class="reward-preview">
						{#if quest.reward_icon_ids && quest.reward_icon_ids.length > 0}
							{#each quest.reward_icon_ids as iconId, idx (`reward-${idx}`)}
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
								selected={quest.reward_icon_ids ?? []}
								onselect={(ids) => (quest.reward_icon_ids = ids)}
								multiple={true}
								maxSelection={10}
								allowDuplicates={true}
							/>
						</div>
					{/if}
				{/if}
			</div>
		{/snippet}

	{#snippet footer()}
		<Button variant="secondary" onclick={close}>Cancel</Button>
		<Button variant="primary" onclick={save}>Save</Button>
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
			align-items: center;
			min-height: 32px;
		}

		.tag-pill {
			border: 1px solid rgba(201, 168, 108, 0.35);
			background: rgba(2, 6, 23, 0.55);
			color: rgba(226, 232, 240, 0.9);
			border-radius: 999px;
			padding: 0.2rem 0.55rem;
			font-size: 0.85rem;
			cursor: pointer;
			transition: border-color 0.15s ease, transform 0.15s ease;
		}

		.tag-pill:hover {
			transform: translateY(-1px);
			border-color: rgba(255, 255, 255, 0.65);
		}

		.tag-empty {
			color: rgba(148, 163, 184, 0.75);
			font-size: 0.9rem;
		}

		.reward-section {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
			padding: 0.75rem;
			border: 1px solid rgba(148, 163, 184, 0.18);
			border-radius: 12px;
			background: rgba(15, 23, 42, 0.55);
		}

		.reward-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.75rem;
		}

		.reward-title {
			font-size: 0.95rem;
			font-weight: 600;
			color: #e2e8f0;
		}

		.reward-mode {
			display: flex;
			gap: 0.5rem;
			align-items: center;
		}

		.reward-preview {
			display: flex;
			flex-wrap: wrap;
			gap: 0.4rem;
			align-items: center;
			min-height: 36px;
		}

	.reward-pill {
		width: 34px;
		height: 34px;
		padding: 0;
		border-radius: 10px;
		border: 1px solid rgba(201, 168, 108, 0.45);
		background: rgba(2, 6, 23, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: border-color 0.15s ease, transform 0.15s ease;
	}

	.reward-pill:hover {
		transform: translateY(-1px);
		border-color: rgba(255, 255, 255, 0.7);
	}

	.reward-pill img {
		width: 22px;
		height: 22px;
		object-fit: contain;
		filter:
			drop-shadow(1px 0 0 #2b1a12)
			drop-shadow(-1px 0 0 #2b1a12)
			drop-shadow(0 1px 0 #2b1a12)
			drop-shadow(0 -1px 0 #2b1a12)
			drop-shadow(1px 1px 0 #2b1a12)
			drop-shadow(-1px 1px 0 #2b1a12)
			drop-shadow(1px -1px 0 #2b1a12)
			drop-shadow(-1px -1px 0 #2b1a12)
			drop-shadow(2px 0 0 #2b1a12)
			drop-shadow(-2px 0 0 #2b1a12)
			drop-shadow(0 2px 0 #2b1a12)
			drop-shadow(0 -2px 0 #2b1a12);
	}

	.reward-empty {
		color: rgba(148, 163, 184, 0.75);
		font-size: 0.9rem;
	}

	.reward-picker {
		padding-top: 0.25rem;
	}
</style>
