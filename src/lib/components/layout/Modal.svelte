<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

	interface Props {
		open?: boolean;
		title?: string;
		size?: ModalSize;
		closeOnBackdrop?: boolean;
		closeOnEscape?: boolean;
		children?: Snippet;
		header?: Snippet;
		footer?: Snippet;
	}

	let {
		open = $bindable(false),
		title = '',
		size = 'md',
		closeOnBackdrop = true,
		closeOnEscape = true,
		children,
		header,
		footer
	}: Props = $props();

	let previousActive: Element | null = null;
	let modalElement = $state<HTMLDivElement | null>(null);

	function widthFor(value: ModalSize): string {
		switch (value) {
			case 'sm':
				return 'min(420px, 92vw)';
			case 'lg':
				return 'min(960px, 92vw)';
			case 'xl':
				return 'min(1200px, 92vw)';
			case 'full':
				return 'calc(100vw - 4rem)';
			case 'md':
			default:
				return 'min(720px, 92vw)';
		}
	}

	function close() {
		open = false;
	}

	function handleBackdropClick(event: MouseEvent) {
		if (!closeOnBackdrop) return;
		if (event.target === event.currentTarget) {
			close();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (closeOnEscape && event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	}

	function focusModal() {
		if (modalElement && typeof modalElement.focus === 'function') {
			modalElement.focus({ preventScroll: true });
		}
	}

	$effect(() => {
		if (open) {
			previousActive = document.activeElement;
			setTimeout(focusModal, 0);
			document.addEventListener('keydown', handleKeydown);
			return () => {
				document.removeEventListener('keydown', handleKeydown);
				if (previousActive instanceof HTMLElement) {
					previousActive.focus({ preventScroll: true });
				}
			};
		}
	});
</script>

{#if open}
	<div
		class="modal-backdrop"
		role="presentation"
		tabindex="-1"
		onclick={handleBackdropClick}
		bind:this={modalElement}
		style={`--modal-width: ${widthFor(size)};`}
		transition:fade={{ duration: 200 }}
	>
		<div class="modal" role="dialog" aria-modal="true" aria-label={title} transition:fly={{ y: 20, duration: 300 }}>
			<header class="modal__header">
				<div class="modal__title-area">
					{#if title}
						<h2>{title}</h2>
					{/if}
					{#if header}
						{@render header()}
					{/if}
				</div>
				<button class="modal__close" type="button" onclick={close} aria-label="Close">
					✕
				</button>
			</header>
			<section class="modal__body">
				{#if children}
					{@render children()}
				{/if}
			</section>
			{#if footer}
				<footer class="modal__footer">
					{@render footer()}
				</footer>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(2, 6, 23, 0.72);
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: 2rem 1.25rem;
		z-index: 1200;
		overflow-y: auto;
	}

	.modal {
		width: var(--modal-width);
		background: rgba(8, 14, 32, 0.95);
		border: 1px solid rgba(94, 114, 228, 0.28);
		border-radius: 14px;
		box-shadow: 0 18px 48px rgba(2, 6, 23, 0.6);
		display: flex;
		flex-direction: column;
		max-height: calc(100vh - 3rem);
		overflow: hidden;
	}

	.modal__header {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1rem 1.25rem 0.75rem;
		align-items: flex-start;
		flex-shrink: 0;
	}

	.modal__title-area {
		flex: 1;
	}

	.modal__header h2 {
		margin: 0;
		font-size: 1.12rem;
		color: #f8fafc;
		letter-spacing: 0.01em;
	}

	.modal__close {
		border: none;
		background: rgba(30, 41, 59, 0.88);
		color: #94a3b8;
		border-radius: 999px;
		width: 1.8rem;
		height: 1.8rem;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
		flex-shrink: 0;
	}

	.modal__close:hover {
		background: rgba(59, 130, 246, 0.35);
		color: #f8fafc;
	}

	.modal__body {
		flex: 1;
		min-height: 0;
		padding: 0 1.25rem 1.25rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		scrollbar-width: thin;
		background: linear-gradient(180deg, rgba(12, 20, 38, 0.92), rgba(12, 20, 38, 0.78));
	}

	.modal__footer {
		flex-shrink: 0;
		padding: 0.75rem 1.25rem 1.25rem;
		display: flex;
		gap: 0.6rem;
		justify-content: flex-end;
		border-top: 1px solid rgba(94, 114, 228, 0.18);
		background: rgba(8, 14, 32, 0.94);
	}

	@media (max-width: 600px) {
		.modal {
			border-radius: 12px;
			max-height: calc(100vh - 2rem);
		}

		.modal__body {
			padding: 0 1rem 1rem;
		}

		.modal__header {
			padding: 0.85rem 1rem 0.65rem;
		}

		.modal__footer {
			padding: 0.7rem 1rem 1rem;
		}
	}
</style>
