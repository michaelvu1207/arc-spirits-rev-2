<script lang="ts">
	/**
	 * V6c: Emerald Grove Arcane
	 * Symmetrical centered layout with nature/forest mystical theme
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

<div class="emerald-card">
	<!-- Background -->
	<div class="art-bg">
		{#if artUrl}
			<img src={artUrl} alt="" class="bg-image" />
		{/if}
		<div class="art-overlay"></div>
	</div>

	<!-- Vine pattern -->
	<div class="vine-pattern"></div>

	<!-- Frame -->
	<div class="frame-left"></div>
	<div class="frame-right"></div>
	<div class="frame-top"></div>
	<div class="frame-bottom"></div>

	<!-- Corner leaves -->
	<div class="leaf top-left"></div>
	<div class="leaf top-right"></div>
	<div class="leaf bottom-left"></div>
	<div class="leaf bottom-right"></div>

	<!-- Fireflies -->
	<div class="particles">
		<span class="firefly f1"></span>
		<span class="firefly f2"></span>
		<span class="firefly f3"></span>
		<span class="firefly f4"></span>
		<span class="firefly f5"></span>
		<span class="firefly f6"></span>
	</div>

	<!-- Content -->
	<div class="content">
		<div class="order-badge">
			<span class="order-vine left"></span>
			<span class="order-num">{event.order_num}</span>
			<span class="order-vine right"></span>
		</div>

		<h2 class="title">{event.title}</h2>

		<div class="divider">
			<span class="div-branch left"></span>
			<span class="div-seed"></span>
			<span class="div-branch right"></span>
		</div>

		{#if event.description}
			<p class="description">{event.description}</p>
		{/if}

		<div class="footer">
			<span class="footer-leaf"></span>
			<span class="footer-text">GROVE EVENT</span>
			<span class="footer-leaf"></span>
		</div>
	</div>

	<div class="vignette"></div>
</div>

<style>
	.emerald-card {
		width: 600px;
		height: 437px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: linear-gradient(180deg, #052e16 0%, #064e3b 50%, #022c22 100%);
		border-radius: 4px;
		overflow: hidden;
		border: 2px solid #166534;
		box-shadow:
			0 0 40px rgba(34, 197, 94, 0.15),
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
		filter: saturate(60%) brightness(25%) hue-rotate(60deg);
		opacity: 0.5;
	}

	.art-overlay {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at center, transparent 0%, rgba(5, 46, 22, 0.7) 60%, rgba(2, 44, 34, 0.95) 100%);
	}

	.vine-pattern {
		position: absolute;
		inset: 0;
		opacity: 0.06;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 90 Q30 70 25 50 T40 20' stroke='%2322c55e' fill='none' stroke-width='1'/%3E%3Cpath d='M90 10 Q70 30 75 50 T60 80' stroke='%2322c55e' fill='none' stroke-width='1'/%3E%3C/svg%3E");
		background-size: 150px 150px;
	}

	.frame-left, .frame-right {
		position: absolute;
		top: 40px;
		bottom: 40px;
		width: 2px;
		background: linear-gradient(180deg, transparent 0%, rgba(34, 197, 94, 0.3) 20%, rgba(34, 197, 94, 0.5) 50%, rgba(34, 197, 94, 0.3) 80%, transparent 100%);
	}
	.frame-left { left: 24px; }
	.frame-right { right: 24px; }

	.frame-top, .frame-bottom {
		position: absolute;
		left: 40px;
		right: 40px;
		height: 2px;
		background: linear-gradient(90deg, transparent 0%, rgba(34, 197, 94, 0.3) 20%, rgba(34, 197, 94, 0.5) 50%, rgba(34, 197, 94, 0.3) 80%, transparent 100%);
	}
	.frame-top { top: 20px; }
	.frame-bottom { bottom: 20px; }

	.leaf {
		position: absolute;
		width: 14px;
		height: 14px;
		background: rgba(34, 197, 94, 0.4);
		border-radius: 0 70% 0 70%;
	}
	.leaf.top-left { top: 12px; left: 16px; transform: rotate(-45deg); }
	.leaf.top-right { top: 12px; right: 16px; transform: rotate(45deg); }
	.leaf.bottom-left { bottom: 12px; left: 16px; transform: rotate(-135deg); }
	.leaf.bottom-right { bottom: 12px; right: 16px; transform: rotate(135deg); }

	.particles {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.firefly {
		position: absolute;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: #bbf7d0;
		box-shadow: 0 0 10px rgba(187, 247, 208, 0.8), 0 0 20px rgba(187, 247, 208, 0.4);
	}
	.f1 { top: 20%; left: 12%; animation: glow 3s ease-in-out infinite; }
	.f2 { top: 65%; left: 8%; animation: glow 4s ease-in-out infinite 0.5s; }
	.f3 { top: 75%; right: 10%; animation: glow 3.5s ease-in-out infinite 1s; }
	.f4 { top: 35%; right: 12%; animation: glow 4.5s ease-in-out infinite 1.5s; }
	.f5 { top: 50%; left: 6%; animation: glow 3s ease-in-out infinite 2s; }
	.f6 { top: 25%; right: 8%; animation: glow 4s ease-in-out infinite 0.8s; }

	@keyframes glow {
		0%, 100% { opacity: 0.2; transform: scale(0.8); }
		50% { opacity: 1; transform: scale(1.2); }
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

	.order-vine {
		width: 40px;
		height: 2px;
		background: linear-gradient(90deg, transparent, rgba(134, 239, 172, 0.5));
		border-radius: 2px;
	}
	.order-vine.right {
		background: linear-gradient(90deg, rgba(134, 239, 172, 0.5), transparent);
	}

	.order-num {
		font-size: 1.1rem;
		font-weight: 700;
		color: #86efac;
		letter-spacing: 0.2em;
		text-shadow: 0 0 20px rgba(34, 197, 94, 0.6);
	}

	.title {
		margin: 0;
		font-size: 2rem;
		font-weight: 800;
		color: #dcfce7;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: 1.2;
		text-shadow: 0 0 30px rgba(34, 197, 94, 0.5), 0 2px 10px rgba(0, 0, 0, 0.8);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 4px 0;
	}

	.div-branch {
		width: 50px;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.5));
		position: relative;
	}
	.div-branch.right {
		background: linear-gradient(90deg, rgba(34, 197, 94, 0.5), transparent);
	}
	.div-branch::after {
		content: '';
		position: absolute;
		top: -3px;
		width: 6px;
		height: 6px;
		background: rgba(34, 197, 94, 0.3);
		border-radius: 0 50% 0 50%;
	}
	.div-branch.left::after { right: 0; transform: rotate(45deg); }
	.div-branch.right::after { left: 0; transform: rotate(-45deg); }

	.div-seed {
		width: 10px;
		height: 10px;
		background: #22c55e;
		border-radius: 50%;
		box-shadow: 0 0 15px rgba(34, 197, 94, 0.8);
	}

	.description {
		margin: 0;
		font-size: 0.95rem;
		color: #bbf7d0;
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

	.footer-leaf {
		width: 8px;
		height: 6px;
		background: rgba(34, 197, 94, 0.4);
		border-radius: 0 50% 0 50%;
		transform: rotate(45deg);
	}

	.footer-text {
		font-size: 0.7rem;
		font-weight: 600;
		color: rgba(134, 239, 172, 0.6);
		letter-spacing: 0.15em;
	}

	.vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		box-shadow: inset 0 0 100px rgba(2, 44, 34, 0.8);
	}
</style>
