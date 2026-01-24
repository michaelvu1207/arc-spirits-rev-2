<script lang="ts">
	/**
	 * V6b: Crimson Mist Arcane
	 * Symmetrical centered layout with deep red/blood mystical theme
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

<div class="crimson-card">
	<!-- Background -->
	<div class="art-bg">
		{#if artUrl}
			<img src={artUrl} alt="" class="bg-image" />
		{/if}
		<div class="art-overlay"></div>
	</div>

	<!-- Mist layers -->
	<div class="mist-layer"></div>

	<!-- Frame -->
	<div class="frame-left"></div>
	<div class="frame-right"></div>
	<div class="frame-top"></div>
	<div class="frame-bottom"></div>

	<!-- Corner flames -->
	<div class="flame top-left"></div>
	<div class="flame top-right"></div>
	<div class="flame bottom-left"></div>
	<div class="flame bottom-right"></div>

	<!-- Embers -->
	<div class="particles">
		<span class="ember e1"></span>
		<span class="ember e2"></span>
		<span class="ember e3"></span>
		<span class="ember e4"></span>
		<span class="ember e5"></span>
		<span class="ember e6"></span>
	</div>

	<!-- Content -->
	<div class="content">
		<div class="order-badge">
			<span class="order-flame left"></span>
			<span class="order-num">{event.order_num}</span>
			<span class="order-flame right"></span>
		</div>

		<h2 class="title">{event.title}</h2>

		<div class="divider">
			<span class="div-thorn left"></span>
			<span class="div-eye"></span>
			<span class="div-thorn right"></span>
		</div>

		{#if event.description}
			<p class="description">{event.description}</p>
		{/if}

		<div class="footer">
			<span class="footer-drop"></span>
			<span class="footer-text">BLOOD EVENT</span>
			<span class="footer-drop"></span>
		</div>
	</div>

	<div class="vignette"></div>
</div>

<style>
	.crimson-card {
		width: 600px;
		height: 437px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: linear-gradient(180deg, #1a0808 0%, #2d0a0a 50%, #120505 100%);
		border-radius: 4px;
		overflow: hidden;
		border: 2px solid #6b2121;
		box-shadow:
			0 0 40px rgba(185, 28, 28, 0.2),
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
		filter: saturate(60%) brightness(25%) sepia(30%);
		opacity: 0.6;
	}

	.art-overlay {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at center, transparent 0%, rgba(26, 8, 8, 0.7) 60%, rgba(18, 5, 5, 0.95) 100%);
	}

	.mist-layer {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 20% 80%, rgba(185, 28, 28, 0.1) 0%, transparent 40%),
			radial-gradient(ellipse at 80% 20%, rgba(185, 28, 28, 0.08) 0%, transparent 35%);
		animation: mistMove 8s ease-in-out infinite;
	}

	@keyframes mistMove {
		0%, 100% { opacity: 0.6; }
		50% { opacity: 1; }
	}

	.frame-left, .frame-right {
		position: absolute;
		top: 40px;
		bottom: 40px;
		width: 2px;
		background: linear-gradient(180deg, transparent 0%, rgba(185, 28, 28, 0.4) 20%, rgba(220, 38, 38, 0.6) 50%, rgba(185, 28, 28, 0.4) 80%, transparent 100%);
	}
	.frame-left { left: 24px; }
	.frame-right { right: 24px; }

	.frame-top, .frame-bottom {
		position: absolute;
		left: 40px;
		right: 40px;
		height: 2px;
		background: linear-gradient(90deg, transparent 0%, rgba(185, 28, 28, 0.4) 20%, rgba(220, 38, 38, 0.6) 50%, rgba(185, 28, 28, 0.4) 80%, transparent 100%);
	}
	.frame-top { top: 20px; }
	.frame-bottom { bottom: 20px; }

	.flame {
		position: absolute;
		width: 12px;
		height: 18px;
		background: linear-gradient(180deg, rgba(220, 38, 38, 0.8) 0%, rgba(185, 28, 28, 0.4) 50%, transparent 100%);
		border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
		animation: flicker 2s ease-in-out infinite;
	}
	.flame.top-left { top: 10px; left: 18px; }
	.flame.top-right { top: 10px; right: 18px; }
	.flame.bottom-left { bottom: 10px; left: 18px; transform: rotate(180deg); }
	.flame.bottom-right { bottom: 10px; right: 18px; transform: rotate(180deg); }

	@keyframes flicker {
		0%, 100% { opacity: 0.6; transform: scaleY(1); }
		50% { opacity: 1; transform: scaleY(1.1); }
	}

	.particles {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.ember {
		position: absolute;
		border-radius: 50%;
		background: #fca5a5;
		box-shadow: 0 0 6px rgba(252, 165, 165, 0.8);
	}
	.e1 { width: 3px; height: 3px; top: 25%; left: 12%; animation: float-up 4s ease-out infinite; }
	.e2 { width: 2px; height: 2px; top: 70%; left: 8%; animation: float-up 5s ease-out infinite 1s; }
	.e3 { width: 3px; height: 3px; top: 80%; right: 10%; animation: float-up 4.5s ease-out infinite 0.5s; }
	.e4 { width: 2px; height: 2px; top: 45%; right: 12%; animation: float-up 6s ease-out infinite 2s; }
	.e5 { width: 2px; height: 2px; top: 60%; left: 15%; animation: float-up 5s ease-out infinite 1.5s; }
	.e6 { width: 2px; height: 2px; top: 35%; right: 8%; animation: float-up 4s ease-out infinite 0.8s; }

	@keyframes float-up {
		0% { transform: translateY(0) scale(1); opacity: 0.8; }
		100% { transform: translateY(-30px) scale(0.5); opacity: 0; }
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

	.order-flame {
		width: 35px;
		height: 3px;
		background: linear-gradient(90deg, transparent, rgba(252, 165, 165, 0.6));
		border-radius: 2px;
	}
	.order-flame.right {
		background: linear-gradient(90deg, rgba(252, 165, 165, 0.6), transparent);
	}

	.order-num {
		font-size: 1.1rem;
		font-weight: 700;
		color: #fca5a5;
		letter-spacing: 0.2em;
		text-shadow: 0 0 20px rgba(220, 38, 38, 0.6);
	}

	.title {
		margin: 0;
		font-size: 2rem;
		font-weight: 800;
		color: #fef2f2;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: 1.2;
		text-shadow: 0 0 30px rgba(185, 28, 28, 0.5), 0 2px 10px rgba(0, 0, 0, 0.8);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 4px 0;
	}

	.div-thorn {
		width: 50px;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(220, 38, 38, 0.6));
	}
	.div-thorn.right {
		background: linear-gradient(90deg, rgba(220, 38, 38, 0.6), transparent);
	}

	.div-eye {
		width: 12px;
		height: 8px;
		border: 2px solid #dc2626;
		border-radius: 50%;
		position: relative;
		box-shadow: 0 0 10px rgba(220, 38, 38, 0.8);
	}
	.div-eye::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 4px;
		height: 4px;
		background: #dc2626;
		border-radius: 50%;
	}

	.description {
		margin: 0;
		font-size: 0.95rem;
		color: #fecaca;
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

	.footer-drop {
		width: 5px;
		height: 8px;
		background: rgba(220, 38, 38, 0.5);
		border-radius: 50% 50% 50% 50% / 30% 30% 70% 70%;
	}

	.footer-text {
		font-size: 0.7rem;
		font-weight: 600;
		color: rgba(252, 165, 165, 0.6);
		letter-spacing: 0.15em;
	}

	.vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		box-shadow: inset 0 0 100px rgba(18, 5, 5, 0.8);
	}
</style>
