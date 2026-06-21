<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly } from 'svelte/transition';

	type Tag = { id: string; name: string; color: string };

	export let isOpen = false;
	export let tags: Tag[] = [];

	const dispatch = createEventDispatcher();

	let editingTag: Partial<Tag> | null = null;
	let tagName = '';
	let tagColor = '#60a5fa';

	function resetForm() {
		editingTag = null;
		tagName = '';
		tagColor = '#60a5fa';
	}

	function startEdit(tag: Tag) {
		editingTag = tag;
		tagName = tag.name;
		tagColor = tag.color;
	}

	function save() {
		if (!tagName.trim()) return;
		dispatch('save', {
			id: editingTag?.id,
			name: tagName.trim(),
			color: tagColor
		});
		resetForm();
	}

	function remove(tag: Tag) {
		dispatch('delete', tag);
	}

	function close() {
		dispatch('close');
		resetForm();
	}
</script>

{#if isOpen}
	<div class="backdrop" role="button" tabindex="0" on:click={close} on:keydown={(e)=> (e.key==="Enter"||e.key===" ") && close()}></div>
	<div class="modal" transition:fly={{ y: 20, duration: 200 }}>
		<div class="modal-header">
			<h2>Manage Tags</h2>
			<button class="close-btn" on:click={close}>&times;</button>
		</div>

		<div class="modal-body">
			<div class="tag-form">
				<div class="input-group">
					<label for="tag-name">Name</label>
					<input
						type="text"
						id="tag-name"
						bind:value={tagName}
						placeholder="Tag Name"
						on:keydown={(e) => e.key === 'Enter' && save()}
					/>
				</div>
				<div class="input-group">
					<label for="tag-color">Color</label>
					<div class="color-picker-wrapper">
						<input type="color" id="tag-color" bind:value={tagColor} />
						<input type="text" bind:value={tagColor} class="color-text" />
					</div>
				</div>
				<button class="btn-save" on:click={save} disabled={!tagName.trim()}>
					{editingTag ? 'Update' : 'Add'}
				</button>
				{#if editingTag}
					<button class="btn-cancel" on:click={resetForm}>Cancel</button>
				{/if}
			</div>

			<div class="tags-list">
				{#each tags as tag (tag.id)}
					<div class="tag-item">
						<div class="tag-preview" style="--tag-color: {tag.color}">
							{tag.name}
						</div>
						<div class="actions">
							<button class="btn-icon" on:click={() => startEdit(tag)} title="Edit">✎</button>
							<button class="btn-icon danger" on:click={() => remove(tag)} title="Delete">🗑️</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(2px);
		z-index: 50;
	}

	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 400px;
		max-width: 90vw;
		background: #0f172a;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 12px;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
		z-index: 60;
		display: flex;
		flex-direction: column;
		max-height: 80vh;
	}

	.modal-header {
		padding: 1rem 1.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.1rem;
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

	.modal-body {
		padding: 1.5rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.tag-form {
		display: grid;
		gap: 1rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	label {
		font-size: 0.8rem;
		color: #94a3b8;
		font-weight: 600;
		text-transform: uppercase;
	}

	input[type='text'] {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.2);
		color: #f8fafc;
		padding: 0.6rem;
		border-radius: 6px;
		width: 100%;
	}

	.color-picker-wrapper {
		display: flex;
		gap: 0.5rem;
	}

	input[type='color'] {
		background: none;
		border: none;
		width: 40px;
		height: 40px;
		padding: 0;
		cursor: pointer;
	}

	.color-text {
		flex: 1;
	}

	.btn-save {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 0.6rem;
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-cancel {
		background: transparent;
		color: #94a3b8;
		border: 1px solid rgba(148, 163, 184, 0.3);
		padding: 0.6rem;
		border-radius: 6px;
		cursor: pointer;
	}

	.tags-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tag-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.3);
		border-radius: 6px;
	}

	.tag-preview {
		padding: 0.25rem 0.75rem;
		border-radius: 999px;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid var(--tag-color);
		color: #cbd5f5;
		font-size: 0.85rem;
	}

	.actions {
		display: flex;
		gap: 0.25rem;
	}

	.btn-icon {
		background: none;
		border: none;
		color: #94a3b8;
		cursor: pointer;
		padding: 0.25rem;
		font-size: 1rem;
		opacity: 0.7;
		transition: opacity 0.2s;
	}

	.btn-icon:hover {
		opacity: 1;
	}

	.btn-icon.danger:hover {
		color: #ef4444;
	}
</style>
