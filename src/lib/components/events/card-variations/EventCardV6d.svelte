<script lang="ts">
	/**
	 * V6d: Golden Relic Arcane
	 * Symmetrical centered layout with ancient gold/amber mystical theme
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

<div class="golden-card">
	<!-- Background -->
	<div class="art-bg">
		{#if artUrl}
			<img src={artUrl} alt="" class="bg-image" />
		{/if}
		<div class="art-overlay"></div>
	</div>

	<!-- Ancient pattern -->
	<div class="ancient-pattern"></div>

	<!-- Frame -->
	<div class="frame-left"></div>
	<div class="frame-right"></div>
	<div class="frame-top"></div>
	<div class="frame-bottom"></div>

	<!-- Corner hieroglyphs -->
	<div class="glyph top-left"></div>
	<div class="glyph top-right"></div>
	<div class="glyph bottom-left"></div>
	<div class="glyph bottom-right"></div>

	<!-- Dust particles -->
	<div class="particles">
		<span class="dust d1"></span>
		<span class="dust d2"></span>
		<span class="dust d3"></span>
		<span class="dust d4"></span>
		<span class="dust d5"></span>
		<span class="dust d6"></span>
	</div>

	<!-- Content -->
	<div class="content">
		<div class="order-badge">
			<span class="order-chain left"></span>
			<span class="order-num">{event.order_num}</span>
			<span class="order-chain right"></span>
		</div>

		<h2 class="title">{event.title}</h2>

		<div class="divider">
			<span class="div-scroll left"></span>
			<span class="div-sun"></span>
			<span class="div-scroll right"></span>
		</div>

		{#if event.description}
			<p class="description">{event.description}</p>
		{/if}

		<div class="footer">
			<span class="footer-ankh"></span>
			<span class="footer-text">ANCIENT EVENT</span>
			<span class="footer-ankh"></span>
		</div>
	</div>

	<div class="vignette"></div>
</div>

<style>
	.golden-card {
		width: 600px;
		height: 437px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: linear-gradient(180deg, #1c1507 0%, #2d2310 50%, #161005 100%);
		border-radius: 4px;
		overflow: hidden;
		border: 2px solid #92702d;
		box-shadow:
			0 0 40px rgba(217, 169, 60, 0.15),
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
		filter: saturate(50%) brightness(25%) sepia(60%);
		opacity: 0.5;
	}

	.art-overlay {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at center, transparent 0%, rgba(28, 21, 7, 0.7) 60%, rgba(22, 16, 5, 0.95) 100%);
	}

	.ancient-pattern {
		position: absolute;
		inset: 0;
		opacity: 0.05;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='20' y='20' width='60' height='60' stroke='%23d4a943' fill='none' stroke-width='0.5'/%3E%3Crect x='30' y='30' width='40' height='40' stroke='%23d4a943' fill='none' stroke-width='0.5'/%3E%3Cline x1='50' y1='20' x2='50' y2='80' stroke='%23d4a943' stroke-width='0.3'/%3E%3Cline x1='20' y1='50' x2='80' y2='50' stroke='%23d4a943' stroke-width='0.3'/%3E%3C/svg%3E");
		background-size: 100px 100px;
	}

	.frame-left, .frame-right {
		position: absolute;
		top: 40px;
		bottom: 40px;
		width: 3px;
		background: linear-gradient(180deg, transparent 0%, rgba(212, 169, 67, 0.3) 20%, rgba(245, 208, 97, 0.5) 50%, rgba(212, 169, 67, 0.3) 80%, transparent 100%);
	}
	.frame-left { left: 24px; }
	.frame-right { right: 24px; }

	.frame-top, .frame-bottom {
		position: absolute;
		left: 40px;
		right: 40px;
		height: 2px;
		background: linear-gradient(90deg, transparent 0%, rgba(212, 169, 67, 0.3) 20%, rgba(245, 208, 97, 0.5) 50%, rgba(212, 169, 67, 0.3) 80%, transparent 100%);
	}
	.frame-top { top: 20px; }
	.frame-bottom { bottom: 20px; }

	.glyph {
		position: absolute;
		width: 16px;
		height: 16px;
		border: 1px solid rgba(212, 169, 67, 0.5);
	}
	.glyph::before {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		right: 3px;
		bottom: 3px;
		border: 1px solid rgba(212, 169, 67, 0.3);
	}
	.glyph.top-left { top: 12px; left: 16px; }
	.glyph.top-right { top: 12px; right: 16px; }
	.glyph.bottom-left { bottom: 12px; left: 16px; }
	.glyph.bottom-right { bottom: 12px; right: 16px; }

	.particles {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.dust {
		position: absolute;
		width: 2px;
		height: 2px;
		border-radius: 50%;
		background: #fef3c7;
		box-shadow: 0 0 4px rgba(254, 243, 199, 0.6);
	}
	.d1 { top: 15%; left: 10%; animation: drift-gold 6s linear infinite; }
	.d2 { top: 50%; left: 8%; animation: drift-gold 7s linear infinite 1s; }
	.d3 { top: 80%; right: 12%; animation: drift-gold 5s linear infinite 0.5s; }
	.d4 { top: 30%; right: 10%; animation: drift-gold 8s linear infinite 2s; }
	.d5 { top: 70%; left: 15%; animation: drift-gold 6s linear infinite 1.5s; }
	.d6 { top: 40%; right: 8%; animation: drift-gold 7s linear infinite 0.8s; }

	@keyframes drift-gold {
		0% { transform: translate(0, 0); opacity: 0; }
		20% { opacity: 0.8; }
		80% { opacity: 0.8; }
		100% { transform: translate(10px, -20px); opacity: 0; }
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

	.order-chain {
		width: 40px;
		height: 2px;
		background: repeating-linear-gradient(90deg, rgba(245, 208, 97, 0.5) 0px, rgba(245, 208, 97, 0.5) 4px, transparent 4px, transparent 8px);
	}

	.order-num {
		font-size: 1.1rem;
		font-weight: 700;
		color: #fcd34d;
		letter-spacing: 0.2em;
		text-shadow: 0 0 20px rgba(212, 169, 67, 0.6);
	}

	.title {
		margin: 0;
		font-size: 2rem;
		font-weight: 800;
		color: #fefce8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: 1.2;
		text-shadow: 0 0 30px rgba(212, 169, 67, 0.5), 0 2px 10px rgba(0, 0, 0, 0.8);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 4px 0;
	}

	.div-scroll {
		width: 50px;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(212, 169, 67, 0.5));
		position: relative;
	}
	.div-scroll.right {
		background: linear-gradient(90deg, rgba(212, 169, 67, 0.5), transparent);
	}
	.div-scroll::before, .div-scroll::after {
		content: '';
		position: absolute;
		top: -2px;
		width: 5px;
		height: 5px;
		border: 1px solid rgba(212, 169, 67, 0.4);
		border-radius: 50%;
	}
	.div-scroll.left::before { right: 0; }
	.div-scroll.left::after { right: 12px; }
	.div-scroll.right::before { left: 0; }
	.div-scroll.right::after { left: 12px; }

	.div-sun {
		width: 14px;
		height: 14px;
		background: radial-gradient(circle, #f5d061 0%, #d4a943 50%, transparent 70%);
		border-radius: 50%;
		box-shadow: 0 0 20px rgba(245, 208, 97, 0.8);
	}

	.description {
		margin: 0;
		font-size: 0.95rem;
		color: #fef3c7;
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

	.footer-ankh {
		width: 6px;
		height: 10px;
		border: 1px solid rgba(212, 169, 67, 0.5);
		border-radius: 50% 50% 0 0;
		position: relative;
	}
	.footer-ankh::after {
		content: '';
		position: absolute;
		bottom: -4px;
		left: 50%;
		transform: translateX(-50%);
		width: 1px;
		height: 6px;
		background: rgba(212, 169, 67, 0.5);
	}

	.footer-text {
		font-size: 0.7rem;
		font-weight: 600;
		color: rgba(252, 211, 77, 0.6);
		letter-spacing: 0.15em;
	}

	.vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		box-shadow: inset 0 0 100px rgba(22, 16, 5, 0.8);
	}
</style>
