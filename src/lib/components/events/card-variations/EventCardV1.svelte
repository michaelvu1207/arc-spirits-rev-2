<script lang="ts">
	/**
	 * V1: Mystical Tome Event Card
	 * Open book design with aged pages and ornate borders
	 * Text appears as if written on ancient parchment
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

<div class="tome-event-card">
	<!-- Book Spine -->
	<div class="book-spine">
		<div class="spine-detail top"></div>
		<div class="spine-detail bottom"></div>
	</div>

	<!-- Left Page (Content) -->
	<div class="left-page">
		<div class="page-stains"></div>
		<div class="page-content">
			<!-- Order Badge -->
			<div class="chapter-badge">
				<span class="chapter-label">CHAPTER</span>
				<span class="chapter-num">{event.order_num}</span>
			</div>

			<!-- Title -->
			<h2 class="event-title">{event.title}</h2>

			<!-- Decorative Divider -->
			<div class="quill-divider">
				<span class="quill-wing"></span>
				<span class="quill-center"></span>
				<span class="quill-wing"></span>
			</div>

			<!-- Description -->
			{#if event.description}
				<p class="event-description">{event.description}</p>
			{/if}

			<!-- Footer -->
			<div class="page-footer">
				<span class="footer-ornament"></span>
				Arc Spirits // Event
				<span class="footer-ornament"></span>
			</div>
		</div>
		<div class="page-edge"></div>
	</div>

	<!-- Right Page (Art) -->
	<div class="right-page">
		<div class="illustration-frame">
			{#if artUrl}
				<img src={artUrl} alt={event.title} class="event-art" />
			{:else}
				<div class="no-art">
					<span class="no-art-icon"></span>
					<span class="no-art-text">No illustration</span>
				</div>
			{/if}
			<div class="frame-corner tl"></div>
			<div class="frame-corner tr"></div>
			<div class="frame-corner bl"></div>
			<div class="frame-corner br"></div>
		</div>
		<div class="page-stains"></div>
	</div>
</div>

<style>
	.tome-event-card {
		width: 600px;
		height: 400px;
		font-family: 'Opsilon', serif;
		display: grid;
		grid-template-columns: 20px 1fr 1fr;
		filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.4));
		border-radius: 4px 12px 12px 4px;
		overflow: hidden;
	}

	.book-spine {
		background: linear-gradient(90deg, #5a3a20 0%, #7a4a2a 50%, #6a4025 100%);
		position: relative;
		box-shadow: inset -2px 0 4px rgba(0, 0, 0, 0.3);
	}

	.spine-detail {
		position: absolute;
		left: 4px;
		right: 4px;
		height: 30px;
		background: linear-gradient(90deg, transparent, rgba(212, 164, 36, 0.3), transparent);
		border-radius: 4px;
	}

	.spine-detail.top { top: 20px; }
	.spine-detail.bottom { bottom: 20px; }

	.left-page {
		background: linear-gradient(135deg, #f4e4c1 0%, #e8d4a8 50%, #dcc89a 100%);
		position: relative;
		display: flex;
		flex-direction: column;
	}

	.page-stains {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 15% 25%, rgba(139, 90, 43, 0.08) 0%, transparent 50%),
			radial-gradient(ellipse at 85% 75%, rgba(101, 67, 33, 0.06) 0%, transparent 40%),
			radial-gradient(ellipse at 50% 95%, rgba(139, 90, 43, 0.04) 0%, transparent 30%);
		pointer-events: none;
	}

	.page-content {
		flex: 1;
		padding: 24px 28px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		position: relative;
		z-index: 1;
	}

	.chapter-badge {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: fit-content;
		padding: 8px 16px;
		background: rgba(139, 90, 43, 0.12);
		border: 2px solid rgba(139, 90, 43, 0.35);
		border-radius: 8px;
	}

	.chapter-label {
		font-size: 0.6rem;
		font-weight: 700;
		color: #8b5a2b;
		letter-spacing: 0.15em;
	}

	.chapter-num {
		font-size: 1.8rem;
		font-weight: 800;
		color: #4a3520;
		line-height: 1;
	}

	.event-title {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 700;
		color: #4a3520;
		text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.5);
		line-height: 1.2;
	}

	.quill-divider {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #8b5a2b;
		opacity: 0.6;
	}

	.quill-wing {
		flex: 1;
		height: 2px;
		background: linear-gradient(90deg, transparent, #8b5a2b, transparent);
	}

	.quill-center::before {
		content: '';
		font-size: 12px;
	}

	.event-description {
		margin: 0;
		font-size: 0.95rem;
		color: #5a4030;
		line-height: 1.5;
		flex: 1;
		font-style: italic;
	}

	.page-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding-top: 10px;
		font-size: 0.7rem;
		color: #6b5030;
		border-top: 1px dashed rgba(139, 90, 43, 0.3);
	}

	.footer-ornament::before {
		content: '';
		font-size: 8px;
		color: rgba(139, 90, 43, 0.5);
	}

	.page-edge {
		position: absolute;
		right: 0;
		top: 10px;
		bottom: 10px;
		width: 3px;
		background: linear-gradient(180deg,
			transparent,
			rgba(139, 90, 43, 0.15) 10%,
			rgba(139, 90, 43, 0.2) 50%,
			rgba(139, 90, 43, 0.15) 90%,
			transparent
		);
	}

	.right-page {
		background: linear-gradient(135deg, #e8d4a8 0%, #dcc89a 50%, #d4c490 100%);
		position: relative;
		padding: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.illustration-frame {
		width: 100%;
		height: 100%;
		position: relative;
		border: 4px solid #8b5a2b;
		border-radius: 8px;
		overflow: hidden;
		background: #2a1810;
		box-shadow:
			inset 0 0 20px rgba(0, 0, 0, 0.5),
			0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.event-art {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: sepia(20%) saturate(90%);
	}

	.no-art {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: #8b7355;
	}

	.no-art-icon::before {
		content: '';
		font-size: 32px;
		opacity: 0.5;
	}

	.no-art-text {
		font-size: 0.8rem;
		opacity: 0.7;
	}

	.frame-corner {
		position: absolute;
		width: 24px;
		height: 24px;
		border: 3px solid #c4a060;
	}

	.frame-corner.tl { top: 8px; left: 8px; border-right: none; border-bottom: none; }
	.frame-corner.tr { top: 8px; right: 8px; border-left: none; border-bottom: none; }
	.frame-corner.bl { bottom: 8px; left: 8px; border-right: none; border-top: none; }
	.frame-corner.br { bottom: 8px; right: 8px; border-left: none; border-top: none; }
</style>
