<script lang="ts">
	import { onDestroy } from 'svelte';

	export let onEdit: () => void;
	export let onDelete: (() => void) | null = null;
	export let onGenerate: (() => void) | null = null;
	export let onToggleEnabled: (() => void) | null = null;
	export let toggleLabel: string = 'Toggle';

	let isOpen = false;
	let dropdown: HTMLDivElement | null = null;

function handleToggle(event: MouseEvent) {
	event.stopPropagation();
	isOpen = !isOpen;
}

function handleEdit(event: MouseEvent) {
	event.stopPropagation();
	isOpen = false;
	onEdit();
}

function handleDelete(event: MouseEvent) {
	event.stopPropagation();
	isOpen = false;
	onDelete?.();
}

function handleToggleEnabled(event: MouseEvent) {
	event.stopPropagation();
	isOpen = false;
	onToggleEnabled?.();
}

	function handleClickOutside(event: MouseEvent) {
		if (dropdown && !dropdown.contains(event.target as Node)) {
			isOpen = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			isOpen = false;
		}
	}

	$: if (isOpen) {
		setTimeout(() => {
			document.addEventListener('click', handleClickOutside, true);
			document.addEventListener('keydown', handleKeydown);
		}, 0);
	}

	onDestroy(() => {
		document.removeEventListener('click', handleClickOutside, true);
		document.removeEventListener('keydown', handleKeydown);
	});
</script>

<div class="card-actions" bind:this={dropdown}>
	<button
		class="dropdown-toggle"
		type="button"
		aria-label="Actions"
		aria-expanded={isOpen}
		on:click={handleToggle}
	>
		<span class="dropdown-icon">⋮</span>
	</button>
	{#if isOpen}
		<div class="dropdown-menu">
			<button class="dropdown-item" type="button" on:click={handleEdit}>
				Edit
			</button>
			{#if onGenerate}
				<button class="dropdown-item" type="button" on:click={() => { isOpen = false; onGenerate?.(); }}>
					Generate PNG
				</button>
			{/if}
			{#if onToggleEnabled}
				<button class="dropdown-item" type="button" on:click={handleToggleEnabled}>
					{toggleLabel}
				</button>
			{/if}
			{#if onDelete}
				<button class="dropdown-item danger" type="button" on:click={handleDelete}>
					Delete
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.card-actions {
		position: relative;
	}

	.dropdown-toggle {
		background: transparent;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		color: #cbd5f5;
		transition: all 0.15s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
	}

	.dropdown-toggle:hover {
		background: rgba(30, 41, 59, 0.6);
		border-color: rgba(148, 163, 184, 0.4);
	}

	.dropdown-icon {
		font-size: 1.2rem;
		line-height: 1;
		display: inline-block;
		font-weight: 300;
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 0.25rem);
		right: 0;
		background: rgba(5, 7, 16, 0.98);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 8px;
		padding: 0.25rem;
		min-width: 120px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.dropdown-item {
		background: transparent;
		border: none;
		padding: 0.5rem 0.75rem;
		text-align: left;
		cursor: pointer;
		color: #cbd5f5;
		border-radius: 6px;
		font-size: 0.875rem;
		transition: background 0.15s ease;
	}

	.dropdown-item:hover {
		background: rgba(30, 41, 59, 0.8);
	}

	.dropdown-item.danger {
		color: #fecaca;
	}

	.dropdown-item.danger:hover {
		background: rgba(248, 113, 113, 0.2);
	}
</style>
