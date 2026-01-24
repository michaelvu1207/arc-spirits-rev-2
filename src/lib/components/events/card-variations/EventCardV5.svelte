<script lang="ts">
	/**
	 * V5: Mysterious Arcane Event Card
	 * Monster-card inspired layout with ethereal/mystical aesthetic
	 * Deep indigos, purples, floating particles, arcane patterns
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

<div class="arcane-event-card">
	<!-- Arcane Pattern Overlay -->
	<div class="arcane-pattern"></div>

	<!-- Floating Particles -->
	<div class="particles">
		<span class="particle p1"></span>
		<span class="particle p2"></span>
		<span class="particle p3"></span>
		<span class="particle p4"></span>
		<span class="particle p5"></span>
		<span class="particle p6"></span>
		<span class="particle p7"></span>
		<span class="particle p8"></span>
	</div>

	<!-- Main Content Grid -->
	<div class="card-content">
		<!-- Left Info Panel -->
		<div class="info-panel">
			<!-- Mist Effect -->
			<div class="mist-effect"></div>

			<!-- Event Badge -->
			<div class="event-badge">
				EVENT #{event.order_num}
			</div>

			<!-- Title -->
			<h2 class="event-title">{event.title}</h2>

			<!-- Mystical Divider -->
			<div class="mystical-divider">
				<span class="divider-line left"></span>
				<span class="divider-diamond"></span>
				<span class="divider-line right"></span>
			</div>

			<!-- Description -->
			{#if event.description}
				<div class="description-panel">
					<div class="description-accent"></div>
					<p class="event-description">{event.description}</p>
				</div>
			{/if}
		</div>

		<!-- Right Art Panel -->
		<div class="art-panel">
			<div class="art-gradient-overlay"></div>
			{#if artUrl}
				<img src={artUrl} alt={event.title} class="event-art" />
			{:else}
				<div class="no-art">
					<div class="no-art-symbol"></div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Bottom Bar -->
	<div class="bottom-bar">
		<span class="footer-left">
			ARC SPIRITS
			<span class="footer-diamond"></span>
		</span>
		<span class="footer-right">
			<span class="footer-diamond"></span>
			// ARCANE EVENT
		</span>
	</div>

	<!-- Glowing Border -->
	<div class="glow-corners"></div>
</div>

<style>
	.arcane-event-card {
		width: 600px;
		height: 437px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: linear-gradient(
			135deg,
			#0f0a1a 0%,
			#1a1033 30%,
			#150d28 60%,
			#0a0812 100%
		);
		border-radius: 4px;
		overflow: hidden;
		border: 2px solid #4c1d95;
		box-shadow:
			0 0 30px rgba(139, 92, 246, 0.15),
			0 10px 40px rgba(0, 0, 0, 0.5);
	}

	/* Arcane pattern overlay */
	.arcane-pattern {
		position: absolute;
		inset: 0;
		opacity: 0.5;
		background-image:
			radial-gradient(circle at 60px 60px, rgba(99, 102, 241, 0.08) 0%, transparent 40px),
			radial-gradient(circle at 180px 120px, rgba(139, 92, 246, 0.06) 0%, transparent 30px),
			radial-gradient(circle at 300px 80px, rgba(99, 102, 241, 0.07) 0%, transparent 35px),
			radial-gradient(circle at 420px 160px, rgba(139, 92, 246, 0.05) 0%, transparent 45px),
			radial-gradient(circle at 540px 100px, rgba(99, 102, 241, 0.06) 0%, transparent 30px);
		pointer-events: none;
	}

	/* Floating particles */
	.particles {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.particle {
		position: absolute;
		border-radius: 50%;
		background: #a78bfa;
		box-shadow: 0 0 10px rgba(167, 139, 250, 0.6);
	}

	.p1 { width: 4px; height: 4px; top: 80px; left: 50px; opacity: 0.6; animation: float 4s ease-in-out infinite; }
	.p2 { width: 3px; height: 3px; top: 150px; left: 120px; opacity: 0.4; animation: float 5s ease-in-out infinite 0.5s; }
	.p3 { width: 4px; height: 4px; top: 250px; left: 80px; opacity: 0.5; animation: float 4.5s ease-in-out infinite 1s; }
	.p4 { width: 2px; height: 2px; top: 100px; left: 200px; opacity: 0.3; animation: float 6s ease-in-out infinite 0.2s; }
	.p5 { width: 5px; height: 5px; top: 300px; left: 180px; opacity: 0.5; animation: float 5s ease-in-out infinite 1.5s; }
	.p6 { width: 3px; height: 3px; top: 50px; left: 450px; opacity: 0.4; animation: float 4s ease-in-out infinite 0.8s; }
	.p7 { width: 4px; height: 4px; top: 200px; left: 520px; opacity: 0.35; animation: float 5.5s ease-in-out infinite 0.3s; }
	.p8 { width: 3px; height: 3px; top: 320px; left: 480px; opacity: 0.4; animation: float 4.5s ease-in-out infinite 1.2s; }

	@keyframes float {
		0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
		50% { transform: translateY(-8px) scale(1.2); opacity: 0.7; }
	}

	/* Main content grid */
	.card-content {
		position: relative;
		width: 100%;
		height: calc(100% - 56px);
		display: grid;
		grid-template-columns: 1.2fr 0.8fr;
		z-index: 1;
	}

	/* Left info panel */
	.info-panel {
		position: relative;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		background: linear-gradient(
			to bottom right,
			rgba(26, 16, 51, 0.92),
			rgba(15, 10, 26, 0.95)
		);
	}

	.mist-effect {
		position: absolute;
		top: 10px;
		right: -10px;
		width: 100px;
		height: 120px;
		background:
			radial-gradient(ellipse at 30% 40%, rgba(139, 92, 246, 0.2) 0%, transparent 60%),
			radial-gradient(ellipse at 70% 60%, rgba(79, 70, 229, 0.15) 0%, transparent 50%);
		filter: blur(20px);
		opacity: 0.6;
		pointer-events: none;
	}

	/* Event badge */
	.event-badge {
		display: inline-flex;
		align-items: center;
		padding: 6px 12px;
		background: rgba(139, 92, 246, 0.25);
		border: 1px solid rgba(139, 92, 246, 0.4);
		border-radius: 4px;
		font-size: 0.8rem;
		font-weight: 700;
		color: #a78bfa;
		letter-spacing: 0.05em;
		width: fit-content;
	}

	/* Title */
	.event-title {
		margin: 0;
		font-size: 1.9rem;
		font-weight: 800;
		color: #e0e7ff;
		text-transform: uppercase;
		line-height: 1.15;
		text-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
	}

	/* Mystical divider */
	.mystical-divider {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 0;
	}

	.divider-line {
		flex: 1;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4));
	}

	.divider-line.right {
		background: linear-gradient(90deg, rgba(139, 92, 246, 0.4), transparent);
	}

	.divider-diamond {
		width: 8px;
		height: 8px;
		background: #8b5cf6;
		transform: rotate(45deg);
		box-shadow: 0 0 10px rgba(139, 92, 246, 0.6);
	}

	/* Description panel */
	.description-panel {
		position: relative;
		flex: 1;
		background: rgba(0, 0, 0, 0.35);
		padding: 14px;
		padding-left: 17px;
		clip-path: polygon(0 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
	}

	.description-accent {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: #8b5cf6;
	}

	.event-description {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 500;
		color: #c7d2fe;
		line-height: 1.5;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
		display: -webkit-box;
		-webkit-line-clamp: 5;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Art panel */
	.art-panel {
		position: relative;
		overflow: hidden;
	}

	.art-gradient-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to right,
			rgba(15, 10, 26, 0.95) 0%,
			rgba(26, 16, 51, 0.6) 25%,
			rgba(21, 13, 40, 0.3) 50%,
			rgba(10, 8, 18, 0.1) 100%
		);
		z-index: 1;
		pointer-events: none;
	}

	.event-art {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(70%) contrast(110%) brightness(85%) hue-rotate(10deg);
	}

	.no-art {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, #1a1033, #0a0812);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.no-art-symbol {
		width: 60px;
		height: 60px;
		border: 2px solid rgba(139, 92, 246, 0.3);
		border-radius: 50%;
		position: relative;
	}

	.no-art-symbol::before {
		content: '';
		position: absolute;
		inset: 8px;
		border: 1px solid rgba(139, 92, 246, 0.2);
		border-radius: 50%;
	}

	.no-art-symbol::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) rotate(45deg);
		width: 12px;
		height: 12px;
		background: rgba(139, 92, 246, 0.4);
	}

	/* Bottom bar */
	.bottom-bar {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 56px;
		background: linear-gradient(
			to bottom,
			rgba(15, 10, 30, 0.95),
			rgba(8, 6, 18, 0.98)
		);
		border-top: 1px solid rgba(99, 102, 241, 0.4);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px;
	}

	.footer-left,
	.footer-right {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.05em;
	}

	.footer-left {
		color: rgba(99, 102, 241, 0.6);
	}

	.footer-right {
		color: rgba(167, 139, 250, 0.5);
		font-weight: 500;
	}

	.footer-diamond {
		width: 6px;
		height: 6px;
		background: rgba(139, 92, 246, 0.3);
		transform: rotate(45deg);
	}

	/* Corner glows */
	.glow-corners {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.glow-corners::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 80px;
		height: 80px;
		background: radial-gradient(circle at 0 0, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
	}

	.glow-corners::after {
		content: '';
		position: absolute;
		bottom: 0;
		right: 0;
		width: 80px;
		height: 80px;
		background: radial-gradient(circle at 100% 100%, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
	}
</style>
