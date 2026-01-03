<script lang="ts">
	import type { IconPoolSourceType } from '$lib/types/gameData';

	type BadgeType = IconPoolSourceType | 'uploaded' | 'rune' | 'custom';

	interface Props {
		name: string;
		imageUrl: string;
		badge?: BadgeType;
		selected?: boolean;
		showCheckbox?: boolean;
		checked?: boolean;
		clickable?: boolean;
		onClick?: () => void;
		onCheckChange?: (checked: boolean) => void;
	}

	let {
		name,
		imageUrl,
		badge,
		selected = false,
		showCheckbox = false,
		checked = false,
		clickable = false,
		onClick,
		onCheckChange
	}: Props = $props();

	const isInteractive = $derived(clickable || !!onClick);

	function getBadgeClass(type: BadgeType): string {
		switch (type) {
			case 'origin':
				return 'badge-origin';
			case 'class':
				return 'badge-class';
			case 'custom':
				return 'badge-custom';
			case 'dice_side':
				return 'badge-dice';
			case 'uploaded':
				return 'badge-uploaded';
			case 'rune':
				return 'badge-rune';
			default:
				return '';
		}
	}

	function getBadgeLabel(type: BadgeType): string {
		switch (type) {
			case 'origin':
				return 'Origin';
			case 'class':
				return 'Class';
			case 'custom':
				return 'Custom';
			case 'dice_side':
				return 'Dice';
			case 'uploaded':
				return 'Uploaded';
			case 'rune':
				return 'Rune';
			default:
				return String(type);
		}
	}

	function handleClick() {
		if (onClick) {
			onClick();
		}
	}

	function handleCheckboxClick(event: MouseEvent) {
		event.stopPropagation();
	}

	function handleCheckboxChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (onCheckChange) {
			onCheckChange(target.checked);
		}
	}
</script>

{#snippet cardContent()}
	{#if showCheckbox}
		<div class="checkbox-corner">
			<input
				type="checkbox"
				{checked}
				onclick={handleCheckboxClick}
				onchange={handleCheckboxChange}
			/>
		</div>
	{/if}
	<div class="preview">
		<img src={imageUrl} alt={name} />
	</div>
	<div class="info">
		<h3 title={name}>{name}</h3>
		{#if badge}
			<span class="badge {getBadgeClass(badge)}">
				{getBadgeLabel(badge)}
			</span>
		{/if}
	</div>
{/snippet}

{#if isInteractive}
	<button
		type="button"
		class="icon-card clickable"
		class:selected
		onclick={handleClick}
	>
		{@render cardContent()}
	</button>
{:else}
	<div class="icon-card" class:selected>
		{@render cardContent()}
	</div>
{/if}

<style>
	.icon-card {
		background: rgba(15, 23, 42, 0.4);
		border: 2px solid rgba(148, 163, 184, 0.1);
		border-radius: 10px;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		transition: all 0.2s;
		position: relative;
		text-align: left;
		font: inherit;
		color: inherit;
	}

	.icon-card:hover {
		border-color: rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.6);
	}

	.icon-card.clickable {
		cursor: pointer;
	}

	.icon-card.clickable:hover {
		border-color: rgba(99, 102, 241, 0.4);
		background: rgba(99, 102, 241, 0.1);
		transform: translateY(-2px);
	}

	.icon-card.selected {
		border-color: rgba(74, 222, 128, 0.6);
		background: rgba(74, 222, 128, 0.08);
	}

	.checkbox-corner {
		position: absolute;
		top: 0.4rem;
		left: 0.4rem;
		z-index: 1;
	}

	.checkbox-corner input[type='checkbox'] {
		width: 16px;
		height: 16px;
		cursor: pointer;
		accent-color: #4ade80;
	}

	.preview {
		width: 100%;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.5));
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.1);
		overflow: hidden;
	}

	.preview img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 0.15rem;
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		align-items: center;
	}

	.info h3 {
		margin: 0;
		font-size: 0.65rem;
		color: #f1f5f9;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
		text-align: center;
	}

	.badge {
		display: inline-block;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-size: 0.55rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.badge-uploaded {
		background: rgba(96, 165, 250, 0.2);
		color: #60a5fa;
	}

	.badge-origin {
		background: rgba(165, 180, 252, 0.2);
		color: #a5b4fc;
	}

	.badge-class {
		background: rgba(251, 191, 36, 0.2);
		color: #fbbf24;
	}

	.badge-custom {
		background: rgba(74, 222, 128, 0.2);
		color: #4ade80;
	}

	.badge-dice {
		background: rgba(248, 113, 113, 0.2);
		color: #f87171;
	}

	.badge-rune {
		background: rgba(244, 114, 182, 0.2);
		color: #f472b6;
	}
</style>
