<script lang="ts">
	/**
	 * V4: Celestial Cosmic Event Card
	 * Starfield background with nebula effects and ethereal glow
	 * Cosmic/astronomical aesthetic with constellation motifs
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

<div class="celestial-event-card">
	<!-- Starfield Background -->
	<div class="starfield">
		<div class="stars layer-1"></div>
		<div class="stars layer-2"></div>
		<div class="stars layer-3"></div>
	</div>

	<!-- Nebula Effect -->
	<div class="nebula"></div>

	<!-- Constellation Lines -->
	<div class="constellation-overlay"></div>

	<!-- Content Area -->
	<div class="card-content">
		<!-- Left Panel -->
		<div class="info-panel">
			<!-- Order Orb -->
			<div class="order-orb">
				<div class="orb-glow"></div>
				<span class="orb-value">{event.order_num}</span>
				<div class="orb-ring"></div>
			</div>

			<!-- Title -->
			<h2 class="event-title">{event.title}</h2>

			<!-- Cosmic Divider -->
			<div class="cosmic-divider">
				<span class="star-point left"></span>
				<span class="divider-line"></span>
				<span class="center-star"></span>
				<span class="divider-line"></span>
				<span class="star-point right"></span>
			</div>

			<!-- Description -->
			{#if event.description}
				<p class="event-description">{event.description}</p>
			{/if}

			<!-- Footer -->
			<div class="card-footer">
				<span class="footer-star"></span>
				<span class="footer-text">Arc Spirits // Event</span>
				<span class="footer-star"></span>
			</div>
		</div>

		<!-- Right Panel - Art -->
		<div class="art-panel">
			<div class="celestial-frame">
				<div class="frame-orbit outer"></div>
				<div class="frame-orbit inner"></div>
				<div class="art-container">
					{#if artUrl}
						<img src={artUrl} alt={event.title} class="event-art" />
					{:else}
						<div class="no-art">
							<span class="cosmic-symbol"></span>
						</div>
					{/if}
					<div class="art-aura"></div>
				</div>
			</div>
		</div>
	</div>

	<!-- Glowing Border -->
	<div class="glow-border"></div>
</div>

<style>
	.celestial-event-card {
		width: 600px;
		height: 400px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: linear-gradient(
			135deg,
			#0a0a1a 0%,
			#0f0f2a 25%,
			#141428 50%,
			#0f0f2a 75%,
			#0a0a1a 100%
		);
		border-radius: 12px;
		overflow: hidden;
		box-shadow:
			0 0 40px rgba(100, 150, 255, 0.2),
			0 8px 32px rgba(0, 0, 0, 0.5);
	}

	.starfield {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.stars {
		position: absolute;
		inset: 0;
		background-image:
			radial-gradient(1px 1px at 50px 50px, rgba(255, 255, 255, 0.8), transparent),
			radial-gradient(1px 1px at 100px 120px, rgba(255, 255, 255, 0.6), transparent),
			radial-gradient(1.5px 1.5px at 180px 80px, rgba(200, 220, 255, 0.9), transparent),
			radial-gradient(1px 1px at 250px 150px, rgba(255, 255, 255, 0.5), transparent),
			radial-gradient(1px 1px at 320px 40px, rgba(255, 255, 255, 0.7), transparent),
			radial-gradient(1.5px 1.5px at 400px 100px, rgba(180, 200, 255, 0.8), transparent),
			radial-gradient(1px 1px at 480px 180px, rgba(255, 255, 255, 0.6), transparent),
			radial-gradient(1px 1px at 550px 60px, rgba(255, 255, 255, 0.5), transparent);
		background-size: 600px 400px;
	}

	.stars.layer-1 {
		opacity: 0.9;
		animation: twinkle 4s ease-in-out infinite;
	}

	.stars.layer-2 {
		opacity: 0.6;
		background-position: 30px 20px;
		animation: twinkle 5s ease-in-out infinite 1s;
	}

	.stars.layer-3 {
		opacity: 0.4;
		background-position: -20px 40px;
		animation: twinkle 6s ease-in-out infinite 2s;
	}

	@keyframes twinkle {
		0%, 100% { opacity: 0.4; }
		50% { opacity: 0.9; }
	}

	.nebula {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 30% 40%, rgba(100, 60, 150, 0.25) 0%, transparent 50%),
			radial-gradient(ellipse at 70% 60%, rgba(60, 100, 180, 0.2) 0%, transparent 45%),
			radial-gradient(ellipse at 50% 80%, rgba(80, 150, 120, 0.15) 0%, transparent 40%);
		pointer-events: none;
	}

	.constellation-overlay {
		position: absolute;
		inset: 0;
		opacity: 0.15;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 300 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50 50 L80 70 L120 60 L140 90 M180 30 L200 60 L220 50 M60 150 L90 140 L110 160 L140 145' stroke='%23aaddff' stroke-width='0.5' fill='none'/%3E%3Ccircle cx='50' cy='50' r='2' fill='%23aaddff'/%3E%3Ccircle cx='80' cy='70' r='1.5' fill='%23aaddff'/%3E%3Ccircle cx='120' cy='60' r='2' fill='%23aaddff'/%3E%3Ccircle cx='140' cy='90' r='1.5' fill='%23aaddff'/%3E%3C/svg%3E");
		pointer-events: none;
	}

	.card-content {
		position: relative;
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: 1fr 1fr;
		z-index: 1;
	}

	.info-panel {
		padding: 28px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.order-orb {
		width: 56px;
		height: 56px;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.orb-glow {
		position: absolute;
		inset: -8px;
		background: radial-gradient(circle, rgba(100, 150, 255, 0.4) 0%, transparent 70%);
		border-radius: 50%;
		animation: orb-pulse 3s ease-in-out infinite;
	}

	@keyframes orb-pulse {
		0%, 100% { transform: scale(1); opacity: 0.6; }
		50% { transform: scale(1.1); opacity: 0.9; }
	}

	.orb-value {
		position: relative;
		z-index: 2;
		font-size: 1.8rem;
		font-weight: 800;
		color: #e0e8ff;
		text-shadow: 0 0 20px rgba(100, 150, 255, 0.8);
	}

	.orb-ring {
		position: absolute;
		inset: 0;
		border: 2px solid rgba(100, 150, 255, 0.5);
		border-radius: 50%;
		animation: ring-spin 10s linear infinite;
	}

	@keyframes ring-spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.event-title {
		margin: 0;
		font-size: 1.7rem;
		font-weight: 700;
		color: #e8f0ff;
		text-shadow:
			0 0 20px rgba(100, 150, 255, 0.5),
			0 2px 4px rgba(0, 0, 0, 0.5);
		line-height: 1.2;
	}

	.cosmic-divider {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.star-point::before {
		content: '';
		font-size: 8px;
		color: rgba(100, 150, 255, 0.6);
	}

	.divider-line {
		flex: 1;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(100, 150, 255, 0.4), transparent);
	}

	.center-star::before {
		content: '';
		font-size: 14px;
		color: rgba(150, 180, 255, 0.8);
	}

	.event-description {
		margin: 0;
		font-size: 1rem;
		color: #a8b8d8;
		line-height: 1.5;
		flex: 1;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}

	.card-footer {
		display: flex;
		align-items: center;
		gap: 10px;
		padding-top: 10px;
	}

	.footer-star::before {
		content: '';
		font-size: 8px;
		color: rgba(100, 150, 255, 0.5);
	}

	.footer-text {
		font-size: 0.75rem;
		color: #6080a0;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	.art-panel {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}

	.celestial-frame {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.frame-orbit {
		position: absolute;
		border-radius: 50%;
		border: 1px solid rgba(100, 150, 255, 0.2);
	}

	.frame-orbit.outer {
		width: 95%;
		height: 95%;
		animation: orbit-rotate 30s linear infinite;
	}

	.frame-orbit.outer::before {
		content: '';
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 6px;
		height: 6px;
		background: rgba(100, 150, 255, 0.6);
		border-radius: 50%;
		box-shadow: 0 0 10px rgba(100, 150, 255, 0.8);
	}

	.frame-orbit.inner {
		width: 85%;
		height: 85%;
		border-color: rgba(150, 100, 200, 0.15);
		animation: orbit-rotate 20s linear infinite reverse;
	}

	.frame-orbit.inner::before {
		content: '';
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 4px;
		height: 4px;
		background: rgba(150, 100, 200, 0.5);
		border-radius: 50%;
		box-shadow: 0 0 8px rgba(150, 100, 200, 0.7);
	}

	@keyframes orbit-rotate {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.art-container {
		width: 75%;
		height: 80%;
		border-radius: 12px;
		overflow: hidden;
		position: relative;
		box-shadow:
			0 0 30px rgba(100, 150, 255, 0.3),
			0 0 60px rgba(100, 150, 255, 0.15);
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
		background: linear-gradient(135deg, #1a1a3a, #0a0a2a);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cosmic-symbol::before {
		content: '';
		font-size: 48px;
		color: rgba(100, 150, 255, 0.3);
	}

	.art-aura {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at center, transparent 50%, rgba(10, 10, 30, 0.5) 100%);
		pointer-events: none;
	}

	.glow-border {
		position: absolute;
		inset: 0;
		border-radius: 12px;
		border: 1px solid rgba(100, 150, 255, 0.3);
		box-shadow:
			inset 0 0 20px rgba(100, 150, 255, 0.1),
			0 0 20px rgba(100, 150, 255, 0.1);
		pointer-events: none;
	}
</style>
