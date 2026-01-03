<script lang="ts">
	/**
	 * V2: Crystal Portal Event Card
	 * Inspired by ArtifactCardV3 - faceted crystalline frame with prismatic effects
	 * Ethereal energy portal aesthetic
	 */

	interface Event {
		name: string;
		title: string;
		description?: string | null;
		order_num: number;
		image_path?: string | null;
		art_url?: string | null;
	}

	interface Props {
		event: Event;
	}

	let { event }: Props = $props();

	const artUrl = $derived(event.art_url || event.image_path);
</script>

<div class="crystal-event-card">
	<!-- Outer Crystal Glow -->
	<div class="crystal-glow"></div>

	<!-- Faceted Frame -->
	<div class="facet-layer">
		<div class="facet top-left"></div>
		<div class="facet top-right"></div>
		<div class="facet bottom-left"></div>
		<div class="facet bottom-right"></div>
	</div>

	<!-- Inner Crystal Body -->
	<div class="crystal-body">
		<div class="prismatic-shimmer"></div>
		<div class="frost-texture"></div>

		<!-- Content Panel -->
		<div class="content-panel">
			<!-- Order Gem -->
			<div class="order-gem">
				<span class="gem-value">{event.order_num}</span>
			</div>

			<!-- Title -->
			<h2 class="event-title">{event.title}</h2>

			<!-- Crystal Divider -->
			<div class="crystal-divider">
				<span class="shard left"></span>
				<span class="center-gem"></span>
				<span class="shard right"></span>
			</div>

			<!-- Description -->
			{#if event.description}
				<p class="event-description">{event.description}</p>
			{/if}

			<!-- Footer -->
			<div class="card-footer">
				Arc Spirits // Event
			</div>
		</div>

		<!-- Art Portal -->
		<div class="art-portal">
			<div class="portal-ring outer"></div>
			<div class="portal-ring inner"></div>
			<div class="portal-content">
				{#if artUrl}
					<img src={artUrl} alt={event.title} class="event-art" />
				{:else}
					<div class="no-art"></div>
				{/if}
				<div class="portal-energy"></div>
			</div>
		</div>
	</div>

	<!-- Edge Highlights -->
	<div class="edge-highlight top"></div>
	<div class="edge-highlight right"></div>
	<div class="edge-highlight bottom"></div>
	<div class="edge-highlight left"></div>
</div>

<style>
	.crystal-event-card {
		width: 600px;
		height: 400px;
		font-family: 'Opsilon', serif;
		position: relative;
		clip-path: polygon(
			16px 0,
			calc(100% - 16px) 0,
			100% 16px,
			100% calc(100% - 16px),
			calc(100% - 16px) 100%,
			16px 100%,
			0 calc(100% - 16px),
			0 16px
		);
	}

	.crystal-glow {
		position: absolute;
		inset: -30px;
		background: radial-gradient(
			ellipse at center,
			rgba(138, 180, 248, 0.5) 0%,
			rgba(99, 155, 255, 0.25) 40%,
			transparent 70%
		);
		filter: blur(25px);
		animation: pulse-glow 4s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes pulse-glow {
		0%, 100% { opacity: 0.6; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.05); }
	}

	.facet-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 2;
	}

	.facet {
		position: absolute;
		width: 60px;
		height: 60px;
	}

	.facet.top-left {
		top: 0;
		left: 0;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(138, 180, 248, 0.2) 50%, transparent 100%);
		clip-path: polygon(0 0, 100% 0, 0 100%);
	}

	.facet.top-right {
		top: 0;
		right: 0;
		background: linear-gradient(-135deg, rgba(255, 255, 255, 0.3) 0%, rgba(138, 180, 248, 0.15) 50%, transparent 100%);
		clip-path: polygon(0 0, 100% 0, 100% 100%);
	}

	.facet.bottom-left {
		bottom: 0;
		left: 0;
		background: linear-gradient(45deg, rgba(100, 120, 180, 0.25) 0%, transparent 100%);
		clip-path: polygon(0 0, 0 100%, 100% 100%);
	}

	.facet.bottom-right {
		bottom: 0;
		right: 0;
		background: linear-gradient(-45deg, rgba(100, 120, 180, 0.2) 0%, transparent 100%);
		clip-path: polygon(100% 0, 0 100%, 100% 100%);
	}

	.crystal-body {
		width: 100%;
		height: 100%;
		background: linear-gradient(
			160deg,
			rgba(200, 220, 255, 0.95) 0%,
			rgba(170, 195, 245, 0.9) 20%,
			rgba(140, 170, 230, 0.85) 50%,
			rgba(120, 150, 220, 0.9) 80%,
			rgba(100, 130, 200, 0.95) 100%
		);
		display: grid;
		grid-template-columns: 1fr 1fr;
		position: relative;
		overflow: hidden;
	}

	.prismatic-shimmer {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			120deg,
			transparent 0%,
			rgba(255, 200, 220, 0.15) 15%,
			rgba(200, 255, 220, 0.15) 30%,
			rgba(220, 200, 255, 0.15) 45%,
			rgba(255, 255, 200, 0.15) 60%,
			rgba(200, 220, 255, 0.15) 75%,
			transparent 100%
		);
		animation: shimmer 8s linear infinite;
		pointer-events: none;
	}

	@keyframes shimmer {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(100%); }
	}

	.frost-texture {
		position: absolute;
		inset: 0;
		opacity: 0.06;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50 0 L50 100 M0 50 L100 50 M25 25 L75 75 M75 25 L25 75' stroke='white' stroke-width='0.5' fill='none'/%3E%3C/svg%3E");
		background-size: 50px 50px;
		pointer-events: none;
	}

	.content-panel {
		padding: 28px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		position: relative;
		z-index: 1;
	}

	.order-gem {
		width: 48px;
		height: 48px;
		background: linear-gradient(135deg, rgba(60, 80, 140, 0.8), rgba(40, 60, 120, 0.9));
		border: 3px solid rgba(100, 130, 200, 0.6);
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			inset 0 0 12px rgba(138, 180, 248, 0.4),
			0 4px 12px rgba(60, 80, 140, 0.3);
	}

	.gem-value {
		font-size: 1.6rem;
		font-weight: 800;
		color: white;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.event-title {
		margin: 0;
		font-size: 1.7rem;
		font-weight: 700;
		color: #2a3a6a;
		text-shadow:
			0 1px 0 rgba(255, 255, 255, 0.8),
			0 2px 10px rgba(100, 130, 200, 0.3);
		line-height: 1.2;
	}

	.crystal-divider {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.shard {
		flex: 1;
		height: 3px;
		background: linear-gradient(90deg, transparent, rgba(60, 80, 140, 0.5), transparent);
	}

	.shard.left {
		background: linear-gradient(90deg, transparent, rgba(60, 80, 140, 0.5));
	}

	.shard.right {
		background: linear-gradient(90deg, rgba(60, 80, 140, 0.5), transparent);
	}

	.center-gem::before {
		content: '';
		font-size: 16px;
		color: rgba(60, 80, 140, 0.7);
	}

	.event-description {
		margin: 0;
		font-size: 1rem;
		color: #3a4a7a;
		line-height: 1.5;
		flex: 1;
	}

	.card-footer {
		padding-top: 10px;
		font-size: 0.75rem;
		color: #4a5a8a;
		font-weight: 600;
	}

	.art-portal {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}

	.portal-ring {
		position: absolute;
		border-radius: 50%;
		border: 3px solid rgba(100, 130, 200, 0.4);
	}

	.portal-ring.outer {
		width: 90%;
		height: 90%;
		animation: ring-rotate 20s linear infinite;
	}

	.portal-ring.inner {
		width: 80%;
		height: 80%;
		border-color: rgba(138, 180, 248, 0.5);
		animation: ring-rotate 15s linear infinite reverse;
	}

	@keyframes ring-rotate {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.portal-content {
		width: 75%;
		height: 85%;
		border-radius: 50%;
		overflow: hidden;
		position: relative;
		box-shadow:
			0 0 30px rgba(138, 180, 248, 0.5),
			inset 0 0 20px rgba(100, 130, 200, 0.3);
	}

	.event-art {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(90%) contrast(105%);
	}

	.no-art {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, #1a2a4a, #0a1a3a);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.no-art::before {
		content: '';
		font-size: 40px;
		color: rgba(138, 180, 248, 0.3);
	}

	.portal-energy {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at center, transparent 30%, rgba(100, 130, 200, 0.3) 100%);
		animation: energy-pulse 3s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes energy-pulse {
		0%, 100% { opacity: 0.5; }
		50% { opacity: 0.8; }
	}

	.edge-highlight {
		position: absolute;
		pointer-events: none;
		z-index: 3;
	}

	.edge-highlight.top {
		top: 0;
		left: 40px;
		right: 40px;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent);
	}

	.edge-highlight.bottom {
		bottom: 0;
		left: 40px;
		right: 40px;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
	}

	.edge-highlight.left {
		left: 0;
		top: 40px;
		bottom: 40px;
		width: 1px;
		background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.6), transparent);
	}

	.edge-highlight.right {
		right: 0;
		top: 40px;
		bottom: 40px;
		width: 1px;
		background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.3), transparent);
	}
</style>
