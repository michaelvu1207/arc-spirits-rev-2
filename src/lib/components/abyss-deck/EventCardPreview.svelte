<script lang="ts">
	import type { Event } from './types';

	interface Props {
		event: Event;
	}

	let { event }: Props = $props();
</script>

<div class="event-card-preview">
	<!-- Text Content Panel (Left with diagonal edge) -->
	<div class="content-panel">
		<!-- Order Badge -->
		<div class="order-badge">#{event.order_num}</div>

		<!-- Title -->
		<h2 class="event-title">{event.title}</h2>

		<!-- Description -->
		{#if event.description}
			<p class="event-description">{event.description}</p>
		{/if}

		<!-- Footer -->
		<div class="card-footer">ARC SPIRITS // EVENT</div>
	</div>

	<!-- Art Panel (Right) -->
	<div class="art-panel">
		{#if event.art_url}
			<img src={event.art_url} alt={event.name} class="event-art" loading="lazy" decoding="async" />
		{:else}
			<div class="no-art">No artwork</div>
		{/if}
	</div>

	<!-- Diagonal Overlay -->
	<div class="diagonal-overlay"></div>

	<!-- Left Accent Border -->
	<div class="accent-border"></div>
</div>

<style>
	.event-card-preview {
		position: relative;
		display: block;
		background: #0c0b13;
		border-radius: 12px;
		overflow: hidden;
		width: 600px;
		height: 364px;
	}

	/* Art Panel - Full background, grayscale */
	.art-panel {
		position: absolute;
		inset: 0;
		z-index: 1;
	}

	.event-art {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		filter: grayscale(100%);
		transform: scale(1.3);
	}

	.no-art {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #64748b;
		font-size: 0.85rem;
		background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
	}

	/* Diagonal Overlay - covers left portion */
	.diagonal-overlay {
		position: absolute;
		inset: 0;
		z-index: 2;
		background: linear-gradient(
			to right,
			rgba(12, 11, 19, 0.98) 0%,
			rgba(12, 11, 19, 0.96) 35%,
			rgba(12, 11, 19, 0.9) 50%,
			rgba(12, 11, 19, 0.7) 65%,
			rgba(12, 11, 19, 0.4) 80%,
			transparent 95%
		);
		clip-path: polygon(0 0, 90% 0, 65% 100%, 0 100%);
	}

	/* Content Panel - Text on the left */
	.content-panel {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		z-index: 3;
		padding: 20px 24px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 55%;
	}

	.order-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 3px 10px;
		border-radius: 6px;
		font-size: 0.65rem;
		font-weight: 700;
		background: rgba(59, 130, 246, 0.3);
		border: 1px solid rgba(59, 130, 246, 0.4);
		color: #93c5fd;
		width: fit-content;
	}

	.event-title {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 700;
		color: #f8fafc;
		line-height: 1.2;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
	}

	.event-description {
		margin: 0;
		font-size: 0.85rem;
		color: #cbd5e1;
		line-height: 1.5;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
		display: -webkit-box;
		-webkit-line-clamp: 9;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-footer {
		margin-top: auto;
		padding-top: 8px;
		font-size: 0.65rem;
		color: #64748b;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	/* Left Accent Border */
	.accent-border {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 6px;
		background: #3b82f6;
		z-index: 4;
		border-radius: 12px 0 0 12px;
	}

	@media (max-width: 500px) {
		.event-card-preview {
			min-height: 260px;
		}

		.content-panel {
			width: 65%;
			padding: 14px 16px;
		}

		.event-title {
			font-size: 1.2rem;
		}

		.event-description {
			font-size: 0.7rem;
			-webkit-line-clamp: 5;
		}
	}
</style>
