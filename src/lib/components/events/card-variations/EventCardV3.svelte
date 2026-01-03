<script lang="ts">
	/**
	 * V3: Ancient Stone Tablet Event Card
	 * Weathered stone with carved runes and mystical inscriptions
	 * Archaeological artifact aesthetic
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

<div class="tablet-event-card">
	<!-- Stone Texture Background -->
	<div class="stone-texture"></div>
	<div class="weathering"></div>
	<div class="cracks"></div>

	<!-- Carved Border -->
	<div class="carved-border">
		<div class="rune-mark top-left"></div>
		<div class="rune-mark top-right"></div>
		<div class="rune-mark bottom-left"></div>
		<div class="rune-mark bottom-right"></div>
	</div>

	<!-- Content Area -->
	<div class="tablet-content">
		<!-- Header with Order Number -->
		<div class="tablet-header">
			<div class="order-cartouche">
				<span class="cartouche-top"></span>
				<span class="order-value">{event.order_num}</span>
				<span class="cartouche-bottom"></span>
			</div>
			<div class="header-text">
				<h2 class="event-title">{event.title}</h2>
			</div>
		</div>

		<!-- Carved Divider -->
		<div class="carved-divider">
			<span class="divider-rune"></span>
			<span class="divider-line"></span>
			<span class="divider-rune"></span>
		</div>

		<!-- Main Content Grid -->
		<div class="content-grid">
			<!-- Description Panel -->
			<div class="inscription-panel">
				{#if event.description}
					<p class="inscription-text">{event.description}</p>
				{:else}
					<p class="inscription-text faded">The ancient text has worn away...</p>
				{/if}
			</div>

			<!-- Art Carving -->
			<div class="art-carving">
				<div class="carving-frame">
					{#if artUrl}
						<img src={artUrl} alt={event.title} class="event-art" />
					{:else}
						<div class="no-art">
							<span class="worn-symbol"></span>
						</div>
					{/if}
					<div class="carving-depth"></div>
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class="tablet-footer">
			<span class="footer-rune"></span>
			<span class="footer-text">ARC SPIRITS // EVENT</span>
			<span class="footer-rune"></span>
		</div>
	</div>

	<!-- Edge Erosion -->
	<div class="erosion top"></div>
	<div class="erosion bottom"></div>
	<div class="erosion left"></div>
	<div class="erosion right"></div>
</div>

<style>
	.tablet-event-card {
		width: 600px;
		height: 400px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: linear-gradient(
			145deg,
			#8a8478 0%,
			#7a7468 20%,
			#6a6458 40%,
			#7a7468 60%,
			#8a8478 80%,
			#9a9488 100%
		);
		border-radius: 8px;
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.4),
			inset 0 2px 4px rgba(255, 255, 255, 0.1),
			inset 0 -2px 4px rgba(0, 0, 0, 0.2);
	}

	.stone-texture {
		position: absolute;
		inset: 0;
		opacity: 0.15;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)'/%3E%3C/svg%3E");
		pointer-events: none;
		border-radius: 8px;
	}

	.weathering {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 20% 20%, rgba(0, 0, 0, 0.1) 0%, transparent 40%),
			radial-gradient(ellipse at 80% 30%, rgba(255, 255, 255, 0.05) 0%, transparent 30%),
			radial-gradient(ellipse at 30% 80%, rgba(0, 0, 0, 0.08) 0%, transparent 35%),
			radial-gradient(ellipse at 70% 70%, rgba(255, 255, 255, 0.03) 0%, transparent 25%);
		pointer-events: none;
		border-radius: 8px;
	}

	.cracks {
		position: absolute;
		inset: 0;
		opacity: 0.1;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 30 L45 60 L40 90 M150 20 L160 50 L155 80 M30 150 L50 170 L45 190 M170 140 L180 160' stroke='%23000' stroke-width='0.5' fill='none'/%3E%3C/svg%3E");
		pointer-events: none;
		border-radius: 8px;
	}

	.carved-border {
		position: absolute;
		inset: 12px;
		border: 4px solid rgba(90, 80, 70, 0.4);
		border-radius: 4px;
		box-shadow:
			inset 2px 2px 4px rgba(0, 0, 0, 0.3),
			inset -1px -1px 2px rgba(255, 255, 255, 0.1);
	}

	.rune-mark {
		position: absolute;
		width: 24px;
		height: 24px;
		background: rgba(60, 50, 40, 0.3);
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.4);
	}

	.rune-mark::before {
		content: '';
		font-size: 14px;
		color: rgba(40, 30, 20, 0.6);
	}

	.rune-mark.top-left { top: -12px; left: -12px; }
	.rune-mark.top-right { top: -12px; right: -12px; }
	.rune-mark.bottom-left { bottom: -12px; left: -12px; }
	.rune-mark.bottom-right { bottom: -12px; right: -12px; }

	.tablet-content {
		position: relative;
		width: 100%;
		height: 100%;
		padding: 28px 32px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 16px;
		z-index: 1;
	}

	.tablet-header {
		display: flex;
		align-items: flex-start;
		gap: 16px;
	}

	.order-cartouche {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 8px 12px;
		background: linear-gradient(180deg, rgba(60, 50, 40, 0.4), rgba(40, 30, 20, 0.5));
		border-radius: 6px;
		box-shadow:
			inset 2px 2px 4px rgba(0, 0, 0, 0.4),
			inset -1px -1px 2px rgba(255, 255, 255, 0.05);
	}

	.cartouche-top::before,
	.cartouche-bottom::before {
		content: '';
		font-size: 8px;
		color: rgba(150, 140, 120, 0.6);
	}

	.order-value {
		font-size: 1.8rem;
		font-weight: 800;
		color: #3a3028;
		text-shadow:
			1px 1px 0 rgba(255, 255, 255, 0.2),
			-1px -1px 0 rgba(0, 0, 0, 0.3);
	}

	.header-text {
		flex: 1;
	}

	.event-title {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 700;
		color: #2a2018;
		text-shadow:
			1px 1px 0 rgba(255, 255, 255, 0.15),
			-1px -1px 0 rgba(0, 0, 0, 0.2);
		line-height: 1.2;
		letter-spacing: 0.5px;
	}

	.carved-divider {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.divider-rune::before {
		content: '';
		font-size: 12px;
		color: rgba(60, 50, 40, 0.5);
	}

	.divider-line {
		flex: 1;
		height: 3px;
		background: linear-gradient(
			90deg,
			transparent,
			rgba(60, 50, 40, 0.4) 20%,
			rgba(60, 50, 40, 0.5) 50%,
			rgba(60, 50, 40, 0.4) 80%,
			transparent
		);
		box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.3);
	}

	.content-grid {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}

	.inscription-panel {
		padding: 16px;
		background: linear-gradient(145deg, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.15));
		border-radius: 6px;
		box-shadow: inset 2px 2px 6px rgba(0, 0, 0, 0.25);
	}

	.inscription-text {
		margin: 0;
		font-size: 0.95rem;
		color: #3a3028;
		line-height: 1.6;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.inscription-text.faded {
		font-style: italic;
		opacity: 0.6;
	}

	.art-carving {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.carving-frame {
		width: 100%;
		height: 100%;
		position: relative;
		background: linear-gradient(145deg, rgba(40, 30, 20, 0.6), rgba(30, 20, 10, 0.7));
		border-radius: 8px;
		overflow: hidden;
		box-shadow:
			inset 3px 3px 8px rgba(0, 0, 0, 0.5),
			inset -2px -2px 4px rgba(255, 255, 255, 0.05);
	}

	.event-art {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: sepia(40%) saturate(70%) contrast(90%);
		opacity: 0.85;
	}

	.no-art {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.worn-symbol::before {
		content: '';
		font-size: 48px;
		color: rgba(100, 90, 80, 0.3);
	}

	.carving-depth {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.4) 100%);
		pointer-events: none;
	}

	.tablet-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding-top: 10px;
	}

	.footer-rune::before {
		content: '';
		font-size: 10px;
		color: rgba(60, 50, 40, 0.4);
	}

	.footer-text {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.15em;
		color: #4a4038;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.erosion {
		position: absolute;
		pointer-events: none;
	}

	.erosion.top {
		top: 0;
		left: 20%;
		right: 20%;
		height: 4px;
		background: linear-gradient(180deg, rgba(0, 0, 0, 0.15), transparent);
		border-radius: 8px 8px 0 0;
	}

	.erosion.bottom {
		bottom: 0;
		left: 20%;
		right: 20%;
		height: 4px;
		background: linear-gradient(0deg, rgba(0, 0, 0, 0.15), transparent);
		border-radius: 0 0 8px 8px;
	}

	.erosion.left {
		left: 0;
		top: 20%;
		bottom: 20%;
		width: 4px;
		background: linear-gradient(90deg, rgba(0, 0, 0, 0.15), transparent);
		border-radius: 8px 0 0 8px;
	}

	.erosion.right {
		right: 0;
		top: 20%;
		bottom: 20%;
		width: 4px;
		background: linear-gradient(-90deg, rgba(0, 0, 0, 0.15), transparent);
		border-radius: 0 8px 8px 0;
	}
</style>
