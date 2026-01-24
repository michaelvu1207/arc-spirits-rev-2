<script lang="ts">
	/**
	 * V6: Symmetrical Arcane Event Card
	 * Centered text layout with symmetrical mysterious design
	 * Art as full background with centered content overlay
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

<div class="arcane-card">
	<!-- Full Background Art -->
	<div class="art-bg">
		{#if artUrl}
			<img src={artUrl} alt="" class="bg-image" />
		{/if}
		<div class="art-overlay"></div>
	</div>

	<!-- Symmetrical Frame Elements -->
	<div class="frame-left"></div>
	<div class="frame-right"></div>
	<div class="frame-top"></div>
	<div class="frame-bottom"></div>

	<!-- Corner Ornaments -->
	<div class="corner top-left"></div>
	<div class="corner top-right"></div>
	<div class="corner bottom-left"></div>
	<div class="corner bottom-right"></div>

	<!-- Floating Particles -->
	<div class="particles">
		<span class="particle p1"></span>
		<span class="particle p2"></span>
		<span class="particle p3"></span>
		<span class="particle p4"></span>
		<span class="particle p5"></span>
		<span class="particle p6"></span>
	</div>

	<!-- Centered Content -->
	<div class="content">
		<!-- Order Number -->
		<div class="order-badge">
			<span class="order-line left"></span>
			<span class="order-num">{event.order_num}</span>
			<span class="order-line right"></span>
		</div>

		<!-- Title -->
		<h2 class="title">{event.title}</h2>

		<!-- Decorative Divider -->
		<div class="divider">
			<span class="div-wing left"></span>
			<span class="div-diamond"></span>
			<span class="div-wing right"></span>
		</div>

		<!-- Description -->
		{#if event.description}
			<p class="description">{event.description}</p>
		{/if}

		<!-- Footer -->
		<div class="footer">
			<span class="footer-diamond"></span>
			<span class="footer-text">ARCANE EVENT</span>
			<span class="footer-diamond"></span>
		</div>
	</div>

	<!-- Vignette Overlay -->
	<div class="vignette"></div>
</div>

<style>
	.arcane-card {
		width: 600px;
		height: 437px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: #080610;
		border-radius: 4px;
		overflow: hidden;
		border: 2px solid #3b2d5c;
		box-shadow:
			0 0 40px rgba(99, 70, 180, 0.2),
			0 10px 40px rgba(0, 0, 0, 0.6),
			inset 0 0 80px rgba(99, 70, 180, 0.05);
	}

	/* Background Art */
	.art-bg {
		position: absolute;
		inset: 0;
	}

	.bg-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(40%) brightness(35%) contrast(120%);
		opacity: 0.7;
	}

	.art-overlay {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at center, transparent 0%, rgba(8, 6, 16, 0.6) 50%, rgba(8, 6, 16, 0.95) 100%),
			linear-gradient(180deg, rgba(60, 40, 100, 0.1) 0%, transparent 30%, transparent 70%, rgba(60, 40, 100, 0.15) 100%);
	}

	/* Frame Elements */
	.frame-left,
	.frame-right {
		position: absolute;
		top: 40px;
		bottom: 40px;
		width: 3px;
		background: linear-gradient(180deg,
			transparent 0%,
			rgba(139, 92, 246, 0.3) 20%,
			rgba(139, 92, 246, 0.5) 50%,
			rgba(139, 92, 246, 0.3) 80%,
			transparent 100%
		);
	}

	.frame-left { left: 24px; }
	.frame-right { right: 24px; }

	.frame-top,
	.frame-bottom {
		position: absolute;
		left: 40px;
		right: 40px;
		height: 2px;
		background: linear-gradient(90deg,
			transparent 0%,
			rgba(139, 92, 246, 0.3) 20%,
			rgba(139, 92, 246, 0.5) 50%,
			rgba(139, 92, 246, 0.3) 80%,
			transparent 100%
		);
	}

	.frame-top { top: 20px; }
	.frame-bottom { bottom: 20px; }

	/* Corner Ornaments */
	.corner {
		position: absolute;
		width: 20px;
		height: 20px;
	}

	.corner::before,
	.corner::after {
		content: '';
		position: absolute;
		background: rgba(139, 92, 246, 0.6);
	}

	.corner::before {
		width: 12px;
		height: 2px;
	}

	.corner::after {
		width: 2px;
		height: 12px;
	}

	.corner.top-left { top: 16px; left: 20px; }
	.corner.top-left::before { top: 0; left: 0; }
	.corner.top-left::after { top: 0; left: 0; }

	.corner.top-right { top: 16px; right: 20px; }
	.corner.top-right::before { top: 0; right: 0; }
	.corner.top-right::after { top: 0; right: 0; }

	.corner.bottom-left { bottom: 16px; left: 20px; }
	.corner.bottom-left::before { bottom: 0; left: 0; }
	.corner.bottom-left::after { bottom: 0; left: 0; }

	.corner.bottom-right { bottom: 16px; right: 20px; }
	.corner.bottom-right::before { bottom: 0; right: 0; }
	.corner.bottom-right::after { bottom: 0; right: 0; }

	/* Particles */
	.particles {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
	}

	.particle {
		position: absolute;
		border-radius: 50%;
		background: #c4b5fd;
		box-shadow: 0 0 8px rgba(196, 181, 253, 0.8);
	}

	.p1 { width: 3px; height: 3px; top: 15%; left: 12%; animation: drift 6s ease-in-out infinite; }
	.p2 { width: 2px; height: 2px; top: 25%; right: 15%; animation: drift 7s ease-in-out infinite 1s; }
	.p3 { width: 3px; height: 3px; top: 70%; left: 10%; animation: drift 5s ease-in-out infinite 0.5s; }
	.p4 { width: 2px; height: 2px; top: 80%; right: 12%; animation: drift 6s ease-in-out infinite 2s; }
	.p5 { width: 2px; height: 2px; top: 45%; left: 8%; animation: drift 8s ease-in-out infinite 1.5s; }
	.p6 { width: 2px; height: 2px; top: 55%; right: 8%; animation: drift 7s ease-in-out infinite 0.8s; }

	@keyframes drift {
		0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
		50% { transform: translate(5px, -10px) scale(1.3); opacity: 0.8; }
	}

	/* Centered Content */
	.content {
		position: relative;
		z-index: 2;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 50px 60px;
		text-align: center;
		gap: 12px;
	}

	/* Order Badge */
	.order-badge {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.order-line {
		width: 40px;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(167, 139, 250, 0.5));
	}

	.order-line.right {
		background: linear-gradient(90deg, rgba(167, 139, 250, 0.5), transparent);
	}

	.order-num {
		font-size: 1.1rem;
		font-weight: 700;
		color: #a78bfa;
		letter-spacing: 0.2em;
		text-shadow: 0 0 20px rgba(167, 139, 250, 0.6);
	}

	/* Title */
	.title {
		margin: 0;
		font-size: 2rem;
		font-weight: 800;
		color: #ede9fe;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: 1.2;
		text-shadow:
			0 0 30px rgba(139, 92, 246, 0.5),
			0 2px 10px rgba(0, 0, 0, 0.8);
	}

	/* Divider */
	.divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 4px 0;
	}

	.div-wing {
		width: 60px;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.6));
	}

	.div-wing.right {
		background: linear-gradient(90deg, rgba(139, 92, 246, 0.6), transparent);
	}

	.div-diamond {
		width: 8px;
		height: 8px;
		background: #8b5cf6;
		transform: rotate(45deg);
		box-shadow: 0 0 15px rgba(139, 92, 246, 0.8);
	}

	/* Description */
	.description {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 400;
		color: #c4b5fd;
		line-height: 1.6;
		max-width: 420px;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
		display: -webkit-box;
		-webkit-line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Footer */
	.footer {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: auto;
		padding-top: 8px;
	}

	.footer-diamond {
		width: 5px;
		height: 5px;
		background: rgba(139, 92, 246, 0.5);
		transform: rotate(45deg);
	}

	.footer-text {
		font-size: 0.7rem;
		font-weight: 600;
		color: rgba(167, 139, 250, 0.6);
		letter-spacing: 0.15em;
	}

	/* Vignette */
	.vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		box-shadow: inset 0 0 100px rgba(8, 6, 16, 0.8);
	}
</style>
