<script lang="ts">
	/**
	 * V6a: Deep Ocean Arcane
	 * Symmetrical centered layout with teal/ocean mystical theme
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

<div class="ocean-card">
	<!-- Background Art -->
	<div class="art-bg">
		{#if artUrl}
			<img src={artUrl} alt="" class="bg-image" />
		{/if}
		<div class="art-overlay"></div>
	</div>

	<!-- Wave Pattern -->
	<div class="wave-pattern"></div>

	<!-- Frame -->
	<div class="frame-left"></div>
	<div class="frame-right"></div>
	<div class="frame-top"></div>
	<div class="frame-bottom"></div>

	<!-- Corner Runes -->
	<div class="rune top-left"></div>
	<div class="rune top-right"></div>
	<div class="rune bottom-left"></div>
	<div class="rune bottom-right"></div>

	<!-- Bubbles/Particles -->
	<div class="particles">
		<span class="bubble b1"></span>
		<span class="bubble b2"></span>
		<span class="bubble b3"></span>
		<span class="bubble b4"></span>
		<span class="bubble b5"></span>
		<span class="bubble b6"></span>
	</div>

	<!-- Content -->
	<div class="content">
		<div class="order-badge">
			<span class="order-wave left"></span>
			<span class="order-num">{event.order_num}</span>
			<span class="order-wave right"></span>
		</div>

		<h2 class="title">{event.title}</h2>

		<div class="divider">
			<span class="div-curl left"></span>
			<span class="div-gem"></span>
			<span class="div-curl right"></span>
		</div>

		{#if event.description}
			<p class="description">{event.description}</p>
		{/if}

		<div class="footer">
			<span class="footer-gem"></span>
			<span class="footer-text">DEPTHS EVENT</span>
			<span class="footer-gem"></span>
		</div>
	</div>

	<div class="vignette"></div>
</div>

<style>
	.ocean-card {
		width: 600px;
		height: 437px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: linear-gradient(180deg, #051520 0%, #0a2530 50%, #041018 100%);
		border-radius: 4px;
		overflow: hidden;
		border: 2px solid #1a5c6c;
		box-shadow:
			0 0 40px rgba(20, 184, 166, 0.15),
			0 10px 40px rgba(0, 0, 0, 0.6);
	}

	.art-bg {
		position: absolute;
		inset: 0;
	}

	.bg-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(50%) brightness(30%) hue-rotate(160deg);
		opacity: 0.6;
	}

	.art-overlay {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at center, transparent 0%, rgba(5, 21, 32, 0.7) 60%, rgba(4, 16, 24, 0.95) 100%);
	}

	.wave-pattern {
		position: absolute;
		inset: 0;
		opacity: 0.08;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 50 Q25 30 50 50 T100 50 T150 50 T200 50' stroke='%2314b8a6' fill='none' stroke-width='1'/%3E%3Cpath d='M0 70 Q25 50 50 70 T100 70 T150 70 T200 70' stroke='%2314b8a6' fill='none' stroke-width='0.5'/%3E%3C/svg%3E");
		background-size: 200px 100px;
	}

	.frame-left, .frame-right {
		position: absolute;
		top: 40px;
		bottom: 40px;
		width: 2px;
		background: linear-gradient(180deg, transparent 0%, rgba(20, 184, 166, 0.4) 20%, rgba(20, 184, 166, 0.6) 50%, rgba(20, 184, 166, 0.4) 80%, transparent 100%);
	}
	.frame-left { left: 24px; }
	.frame-right { right: 24px; }

	.frame-top, .frame-bottom {
		position: absolute;
		left: 40px;
		right: 40px;
		height: 2px;
		background: linear-gradient(90deg, transparent 0%, rgba(20, 184, 166, 0.4) 20%, rgba(20, 184, 166, 0.6) 50%, rgba(20, 184, 166, 0.4) 80%, transparent 100%);
	}
	.frame-top { top: 20px; }
	.frame-bottom { bottom: 20px; }

	.rune {
		position: absolute;
		width: 16px;
		height: 16px;
		border: 1px solid rgba(20, 184, 166, 0.5);
		border-radius: 50%;
	}
	.rune::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 6px;
		height: 6px;
		background: rgba(20, 184, 166, 0.4);
		border-radius: 50%;
	}
	.rune.top-left { top: 12px; left: 16px; }
	.rune.top-right { top: 12px; right: 16px; }
	.rune.bottom-left { bottom: 12px; left: 16px; }
	.rune.bottom-right { bottom: 12px; right: 16px; }

	.particles {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.bubble {
		position: absolute;
		border-radius: 50%;
		background: rgba(94, 234, 212, 0.6);
		box-shadow: 0 0 8px rgba(94, 234, 212, 0.5);
	}
	.b1 { width: 4px; height: 4px; top: 20%; left: 15%; animation: rise 5s ease-in-out infinite; }
	.b2 { width: 3px; height: 3px; top: 60%; left: 10%; animation: rise 6s ease-in-out infinite 1s; }
	.b3 { width: 3px; height: 3px; top: 75%; right: 12%; animation: rise 5.5s ease-in-out infinite 0.5s; }
	.b4 { width: 4px; height: 4px; top: 40%; right: 15%; animation: rise 7s ease-in-out infinite 2s; }
	.b5 { width: 2px; height: 2px; top: 85%; left: 20%; animation: rise 4s ease-in-out infinite 1.5s; }
	.b6 { width: 2px; height: 2px; top: 30%; right: 8%; animation: rise 6s ease-in-out infinite 0.8s; }

	@keyframes rise {
		0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
		50% { transform: translateY(-15px) scale(1.2); opacity: 0.8; }
	}

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

	.order-badge {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.order-wave {
		width: 40px;
		height: 2px;
		background: linear-gradient(90deg, transparent, rgba(94, 234, 212, 0.5));
		border-radius: 2px;
	}
	.order-wave.right {
		background: linear-gradient(90deg, rgba(94, 234, 212, 0.5), transparent);
	}

	.order-num {
		font-size: 1.1rem;
		font-weight: 700;
		color: #5eead4;
		letter-spacing: 0.2em;
		text-shadow: 0 0 20px rgba(94, 234, 212, 0.6);
	}

	.title {
		margin: 0;
		font-size: 2rem;
		font-weight: 800;
		color: #ccfbf1;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: 1.2;
		text-shadow: 0 0 30px rgba(20, 184, 166, 0.5), 0 2px 10px rgba(0, 0, 0, 0.8);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 4px 0;
	}

	.div-curl {
		width: 50px;
		height: 8px;
		border-bottom: 1px solid rgba(20, 184, 166, 0.5);
		border-radius: 0 0 50% 50%;
	}
	.div-curl.left { border-left: 1px solid rgba(20, 184, 166, 0.5); }
	.div-curl.right { border-right: 1px solid rgba(20, 184, 166, 0.5); }

	.div-gem {
		width: 10px;
		height: 10px;
		background: #14b8a6;
		transform: rotate(45deg);
		box-shadow: 0 0 15px rgba(20, 184, 166, 0.8);
	}

	.description {
		margin: 0;
		font-size: 0.95rem;
		color: #99f6e4;
		line-height: 1.6;
		max-width: 420px;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
		display: -webkit-box;
		-webkit-line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.footer {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: auto;
	}

	.footer-gem {
		width: 5px;
		height: 5px;
		background: rgba(20, 184, 166, 0.5);
		transform: rotate(45deg);
	}

	.footer-text {
		font-size: 0.7rem;
		font-weight: 600;
		color: rgba(94, 234, 212, 0.6);
		letter-spacing: 0.15em;
	}

	.vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		box-shadow: inset 0 0 100px rgba(4, 16, 24, 0.8);
	}
</style>
