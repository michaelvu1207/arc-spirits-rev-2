<script lang="ts">
	/**
	 * Event Card Preview - Styled Event Card
	 * Supports multiple visual styles defined in cardStyleDefinitions.ts
	 */
	import type { Event } from './types';
	import { onMount } from 'svelte';
	import { publicAssetUrl, bustUrl } from '$lib/utils/storage';
	import { eventCardBackground } from '$lib/stores/eventCardBackground';
	import {
		defaultEventCardBackgroundSettings,
		type EventCardBackgroundSettings
	} from '$lib/settings/eventCardBackground';
	import { DEFAULT_EVENT_TYPE, eventTypeLabel } from '$lib/types/eventTypes';
	import { loadIconPool, getIconPoolUrl } from '$lib/utils/iconPool';
	import type { RewardRow } from '$lib/types/gameData';
	import { REWARD_ROW_CONFIG } from '$lib/types/gameData';
	import { getEventStyleDefinition, type CardStyleDefinition } from '$lib/types/cardStyleDefinitions';

	interface Props {
		event: Event;
		backgroundSettingsOverride?: EventCardBackgroundSettings | null;
		styleId?: string;
	}

	let { event, backgroundSettingsOverride = null, styleId = 'event_v6' }: Props = $props();

	let storeBackgroundSettings: EventCardBackgroundSettings = $state(defaultEventCardBackgroundSettings);
	let iconPoolLoaded = $state(false);

	// Get the full style definition
	const styleDef = $derived(getEventStyleDefinition(styleId));

	// Use override if provided, otherwise fall back to store
	const backgroundSettings = $derived(backgroundSettingsOverride ?? storeBackgroundSettings);

	onMount(() => {
		const unsubscribe = eventCardBackground.subscribe((value) => {
			storeBackgroundSettings = value;
		});
		void loadIconPool()
			.catch(() => null)
			.finally(() => {
				iconPoolLoaded = true;
			});
		return unsubscribe;
	});

	function hexToRgba(hex: string, alpha: number) {
		const sanitized = /^#([A-Fa-f0-9]{6})$/.test(hex) ? hex : '#8b5cf6';
		const r = parseInt(sanitized.slice(1, 3), 16);
		const g = parseInt(sanitized.slice(3, 5), 16);
		const b = parseInt(sanitized.slice(5, 7), 16);
		const a = Math.max(0, Math.min(1, alpha));
		return `rgba(${r}, ${g}, ${b}, ${a})`;
	}

	// Derive colors from style definition or fallback to background settings
	const bgAccentA = $derived(
		hexToRgba(
			styleDef?.background.gradientColors[0]?.match(/#[A-Fa-f0-9]{6}/)?.[0] ?? backgroundSettings.gradient.accentAHex,
			styleDef?.background.gradientColors[0]?.match(/[\d.]+(?=\))/)?.[0] ? parseFloat(styleDef.background.gradientColors[0].match(/[\d.]+(?=\))/)?.[0] ?? '0.22') : backgroundSettings.gradient.accentAAlpha
		)
	);
	const bgAccentB = $derived(
		hexToRgba(
			styleDef?.background.gradientColors[1]?.match(/#[A-Fa-f0-9]{6}/)?.[0] ?? backgroundSettings.gradient.accentBHex,
			styleDef?.background.gradientColors[1]?.match(/[\d.]+(?=\))/)?.[0] ? parseFloat(styleDef.background.gradientColors[1].match(/[\d.]+(?=\))/)?.[0] ?? '0.16') : backgroundSettings.gradient.accentBAlpha
		)
	);

	const bgImageUrl = $derived(
		backgroundSettings.mode === 'image'
			? backgroundSettings.image.source === 'storage'
				? publicAssetUrl(backgroundSettings.image.path, {
						bucket: backgroundSettings.image.bucket,
						updatedAt: backgroundSettings.image.version
					})
				: bustUrl(backgroundSettings.image.url, backgroundSettings.image.version)
			: null
	);

	const typeText = $derived(`${eventTypeLabel(event.stage ?? DEFAULT_EVENT_TYPE).toUpperCase()} EVENT`);
	const typeBadgeText = $derived(eventTypeLabel(event.stage ?? DEFAULT_EVENT_TYPE).toUpperCase());

	const rewardRows = $derived.by(() => ((event as Event & { reward_rows?: RewardRow[] }).reward_rows ?? []) as RewardRow[]);
	const allPlayersRewardRow = $derived.by(
		() =>
			rewardRows.find((row) => row.type === 'all_players') ??
			rewardRows.find((row) => (row.icon_ids?.length ?? 0) > 0) ??
			null
	);

	const allPlayersRewardLabel = $derived.by(() => {
		if (!allPlayersRewardRow) return null;
		const config = REWARD_ROW_CONFIG[allPlayersRewardRow.type];
		return allPlayersRewardRow.label?.trim() || config.label;
	});

	const stageCompletionText = $derived.by(() => null);

	// Build CSS variables from style definition
	const styleVars = $derived.by(() => {
		const s = styleDef;
		return `
			--style-base-bg: ${s.background.baseColor};
			--style-accent-a: ${bgAccentA};
			--style-accent-b: ${bgAccentB};
			--style-primary: ${s.colors.primary};
			--style-secondary: ${s.colors.secondary};
			--style-accent: ${s.colors.accent};
			--style-text: ${s.colors.text};
			--style-text-secondary: ${s.colors.textSecondary};
			--style-glow: ${s.colors.glow};
			--style-shadow: ${s.colors.shadow};
			--style-frame-color: ${s.frame.color};
			--style-frame-secondary: ${s.frame.secondaryColor ?? s.frame.color};
			--style-title-glow: ${s.typography.titleGlow};
			--style-title-glow-strength: ${s.typography.titleGlowStrength}px;
			--style-title-weight: ${s.typography.titleWeight};
			--style-title-spacing: ${s.typography.titleLetterSpacing};
			--style-badge-color: ${s.typography.badgeColor};
			--style-badge-bg: ${s.typography.badgeBgColor};
			--style-badge-border: ${s.typography.badgeBorderColor};
			--style-divider-color: ${s.divider.color};
			--style-particle-color: ${s.particles.color};
			--style-vignette-strength: ${s.background.vignetteStrength};
		`;
	});

	// Determine frame type for conditional rendering
	const frameType = $derived(styleDef.frame.type);
	const particleType = $derived(styleDef.particles.type);
</script>

<div
	class="event-card style-{styleId.replace('event_v6_', '').replace('event_v6', 'arcane')}"
	style={styleVars}
>
	<!-- Background -->
	<div class="art-bg">
		{#if bgImageUrl}
			<img src={bgImageUrl} alt="" class="bg-image" />
		{/if}
		<div class="art-overlay"></div>

		<!-- Pattern overlay based on style -->
		{#if styleDef.background.pattern !== 'none'}
			<div class="pattern-overlay pattern-{styleDef.background.pattern}"></div>
		{/if}
	</div>

	<!-- Frame Elements - vary by style -->
	{#if frameType === 'double-line' || frameType === 'simple'}
		<div class="frame-left"></div>
		<div class="frame-right"></div>
		<div class="frame-top"></div>
		<div class="frame-bottom"></div>
		<div class="corner top-left"></div>
		<div class="corner top-right"></div>
		<div class="corner bottom-left"></div>
		<div class="corner bottom-right"></div>
	{:else if frameType === 'cracked'}
		<div class="frame-cracked left"></div>
		<div class="frame-cracked right"></div>
		<div class="crack-pattern"></div>
	{:else if frameType === 'crystalline'}
		<div class="frame-crystal top"></div>
		<div class="frame-crystal bottom"></div>
		<div class="hex-corner top-left"></div>
		<div class="hex-corner top-right"></div>
		<div class="hex-corner bottom-left"></div>
		<div class="hex-corner bottom-right"></div>
	{:else if frameType === 'organic'}
		<div class="vine-frame left"></div>
		<div class="vine-frame right"></div>
	{:else if frameType === 'dissolving'}
		<div class="mist-edge left"></div>
		<div class="mist-edge right"></div>
	{:else if frameType === 'radiant'}
		<div class="rays-container">
			{#each Array(5) as _, i}
				<div class="ray" style="--ray-index: {i}"></div>
			{/each}
		</div>
		<div class="baroque-corner top-left"></div>
		<div class="baroque-corner top-right"></div>
	{:else if frameType === 'spiked'}
		<div class="spike-frame top"></div>
		<div class="spike-frame bottom"></div>
		<div class="thorn-side left"></div>
		<div class="thorn-side right"></div>
	{:else if frameType === 'warped'}
		<div class="warp-border top"></div>
		<div class="warp-border bottom"></div>
		<div class="impossible-corner top-left"></div>
		<div class="impossible-corner top-right"></div>
	{/if}

	<!-- Floating Particles - vary by style -->
	{#if particleType !== 'none'}
		<div class="particles particles-{particleType}">
			{#each Array(styleDef.particles.count) as _, i}
				<span class="particle p{i + 1}" style="--p-delay: {i * 0.3}s; --p-duration: {5 + i % 3}s"></span>
			{/each}
		</div>
	{/if}

	<!-- Centered Content -->
	<div class="content">
		<!-- Type Badge -->
		<div class="order-badge">
			<span class="order-line left"></span>
			<span class="order-num">{typeBadgeText}</span>
			<span class="order-line right"></span>
		</div>

		<!-- Title -->
		<h2 class="title">{event.title}</h2>

		<!-- Decorative Divider - varies by style -->
		<div class="divider divider-{styleDef.divider.type}">
			<span class="div-wing left"></span>
			<span class="div-center"></span>
			<span class="div-wing right"></span>
		</div>

		<!-- Description -->
		<div class="description-wrapper">
			{#if event.description}
				<p class="description">{event.description}</p>
			{/if}
		</div>

		{#if allPlayersRewardRow && (allPlayersRewardRow.icon_ids?.length ?? 0) > 0}
			<div class="rewards">
				<div class="rewards-divider" aria-hidden="true"></div>
				<div class="rewards-row">
					{#if allPlayersRewardLabel}
						<div class="rewards-title">{allPlayersRewardLabel}</div>
					{/if}
					{#if iconPoolLoaded}
						<div class="reward-icons" aria-label={allPlayersRewardLabel ?? 'Rewards'}>
							{#each allPlayersRewardRow.icon_ids as iconId, iconIdx (`${iconId}:${iconIdx}`)}
								{@const url = getIconPoolUrl(iconId)}
								{#if url}
									<img src={url} alt="" loading="lazy" decoding="async" />
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}

		{#if stageCompletionText}
			<div class="stage-completion">
				<div class="stage-completion__label">STAGE COMPLETION</div>
				<div class="stage-completion__text">{stageCompletionText}</div>
			</div>
		{/if}
	</div>

	<!-- Footer -->
	<div class="footer">
		<span class="footer-accent"></span>
		<span class="footer-accent"></span>
	</div>

	<!-- Vignette -->
	<div class="vignette"></div>
</div>

<style>
	.event-card {
		width: 600px;
		height: 437px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: var(--style-base-bg, #080610);
		border-radius: 4px;
		overflow: hidden;
		border: 2px solid color-mix(in srgb, var(--style-primary) 40%, transparent);
		box-shadow:
			0 0 40px color-mix(in srgb, var(--style-primary) 20%, transparent),
			0 10px 40px rgba(0, 0, 0, 0.6),
			inset 0 0 80px color-mix(in srgb, var(--style-primary) 5%, transparent);
	}

	/* ========== BACKGROUND ========== */
	.art-bg {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 25% 20%, var(--style-accent-a), transparent 55%),
			radial-gradient(circle at 75% 70%, var(--style-accent-b), transparent 60%),
			radial-gradient(circle at 55% 45%, color-mix(in srgb, var(--style-primary) 10%, transparent), transparent 65%),
			linear-gradient(180deg, color-mix(in srgb, var(--style-base-bg) 95%, transparent) 0%, color-mix(in srgb, var(--style-base-bg) 92%, transparent) 40%, color-mix(in srgb, var(--style-base-bg) 98%, transparent) 100%),
			var(--style-base-bg);
	}

	.bg-image {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(45%) brightness(35%) contrast(120%);
		opacity: 0.85;
	}

	.art-overlay {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at center, transparent 0%, color-mix(in srgb, var(--style-base-bg) 60%, transparent) 50%, color-mix(in srgb, var(--style-base-bg) 95%, transparent) 100%),
			linear-gradient(180deg, color-mix(in srgb, var(--style-secondary) 10%, transparent) 0%, transparent 30%, transparent 70%, color-mix(in srgb, var(--style-secondary) 15%, transparent) 100%);
	}

	.pattern-overlay {
		position: absolute;
		inset: 0;
		opacity: 0.08;
		pointer-events: none;
	}

	/* Pattern variations */
	.pattern-arcane-circles {
		background: repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 40px, var(--style-primary) 41px, transparent 42px);
	}

	.pattern-cracks {
		background:
			linear-gradient(45deg, var(--style-primary) 1px, transparent 1px) 0 0 / 30px 30px,
			linear-gradient(-45deg, var(--style-primary) 1px, transparent 1px) 0 0 / 30px 30px;
	}

	.pattern-crystals {
		background:
			conic-gradient(from 30deg at 50% 50%, transparent 0deg, var(--style-primary) 60deg, transparent 60deg) 0 0 / 40px 40px;
	}

	.pattern-stars {
		background: radial-gradient(circle at 20% 30%, var(--style-accent) 1px, transparent 1px) 0 0 / 50px 50px,
			radial-gradient(circle at 70% 60%, var(--style-accent) 0.5px, transparent 0.5px) 25px 25px / 50px 50px;
	}

	/* ========== FRAME STYLES ========== */

	/* Double-line / Simple frame */
	.frame-left, .frame-right {
		position: absolute;
		top: 40px;
		bottom: 40px;
		width: 3px;
		background: linear-gradient(180deg,
			transparent 0%,
			var(--style-frame-secondary) 20%,
			var(--style-frame-color) 50%,
			var(--style-frame-secondary) 80%,
			transparent 100%
		);
	}
	.frame-left { left: 24px; }
	.frame-right { right: 24px; }

	.frame-top, .frame-bottom {
		position: absolute;
		left: 40px;
		right: 40px;
		height: 2px;
		background: linear-gradient(90deg,
			transparent 0%,
			var(--style-frame-secondary) 20%,
			var(--style-frame-color) 50%,
			var(--style-frame-secondary) 80%,
			transparent 100%
		);
	}
	.frame-top { top: 20px; }
	.frame-bottom { bottom: 20px; }

	.corner {
		position: absolute;
		width: 20px;
		height: 20px;
	}
	.corner::before, .corner::after {
		content: '';
		position: absolute;
		background: var(--style-frame-color);
	}
	.corner::before { width: 12px; height: 2px; }
	.corner::after { width: 2px; height: 12px; }
	.corner.top-left { top: 16px; left: 20px; }
	.corner.top-left::before, .corner.top-left::after { top: 0; left: 0; }
	.corner.top-right { top: 16px; right: 20px; }
	.corner.top-right::before, .corner.top-right::after { top: 0; right: 0; }
	.corner.bottom-left { bottom: 16px; left: 20px; }
	.corner.bottom-left::before, .corner.bottom-left::after { bottom: 0; left: 0; }
	.corner.bottom-right { bottom: 16px; right: 20px; }
	.corner.bottom-right::before, .corner.bottom-right::after { bottom: 0; right: 0; }

	/* Cracked frame */
	.frame-cracked {
		position: absolute;
		top: 30px;
		bottom: 30px;
		width: 4px;
		background: linear-gradient(180deg,
			var(--style-frame-color) 0%,
			var(--style-frame-secondary) 25%,
			var(--style-frame-color) 50%,
			var(--style-frame-secondary) 75%,
			var(--style-frame-color) 100%
		);
		clip-path: polygon(0 0, 100% 2%, 80% 15%, 100% 30%, 70% 45%, 100% 60%, 80% 75%, 100% 90%, 0 100%);
	}
	.frame-cracked.left { left: 15px; }
	.frame-cracked.right { right: 15px; transform: scaleX(-1); }

	.crack-pattern {
		position: absolute;
		inset: 0;
		opacity: 0.15;
		background:
			linear-gradient(45deg, var(--style-frame-color) 1px, transparent 1px) 0 0 / 60px 60px,
			linear-gradient(-30deg, var(--style-frame-secondary) 1px, transparent 1px) 10px 10px / 40px 40px;
	}

	/* Crystal frame */
	.frame-crystal {
		position: absolute;
		left: 30px;
		right: 30px;
		height: 3px;
	}
	.frame-crystal.top {
		top: 18px;
		clip-path: polygon(0 100%, 5% 0, 10% 100%, 15% 0, 20% 100%, 25% 0, 30% 100%, 35% 0, 40% 100%, 45% 0, 50% 100%, 55% 0, 60% 100%, 65% 0, 70% 100%, 75% 0, 80% 100%, 85% 0, 90% 100%, 95% 0, 100% 100%);
		background: var(--style-frame-color);
	}
	.frame-crystal.bottom {
		bottom: 15px;
		background: var(--style-frame-color);
		clip-path: polygon(0 0, 5% 100%, 10% 30%, 15% 100%, 20% 20%, 25% 100%, 30% 0, 35% 100%, 40% 20%, 45% 100%, 50% 0, 55% 100%, 60% 20%, 65% 100%, 70% 0, 75% 100%, 80% 20%, 85% 100%, 90% 30%, 95% 100%, 100% 0);
	}

	.hex-corner {
		position: absolute;
		width: 16px;
		height: 16px;
		background: var(--style-frame-color);
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
	}
	.hex-corner.top-left { top: 22px; left: 22px; }
	.hex-corner.top-right { top: 22px; right: 22px; }
	.hex-corner.bottom-left { bottom: 22px; left: 22px; }
	.hex-corner.bottom-right { bottom: 22px; right: 22px; }

	/* Organic/Vine frame */
	.vine-frame {
		position: absolute;
		top: 40px;
		bottom: 40px;
		width: 8px;
	}
	.vine-frame.left {
		left: 18px;
		background:
			radial-gradient(circle at 50% 20%, var(--style-frame-color) 3px, transparent 3px),
			radial-gradient(circle at 50% 40%, var(--style-frame-color) 3px, transparent 3px),
			radial-gradient(circle at 50% 60%, var(--style-frame-color) 3px, transparent 3px),
			radial-gradient(circle at 50% 80%, var(--style-frame-color) 3px, transparent 3px),
			linear-gradient(180deg, transparent 0%, var(--style-frame-secondary) 10%, var(--style-frame-color) 50%, var(--style-frame-secondary) 90%, transparent 100%) 50% 0 / 2px 100% no-repeat;
	}
	.vine-frame.right {
		right: 18px;
		background:
			radial-gradient(circle at 50% 25%, var(--style-frame-color) 3px, transparent 3px),
			radial-gradient(circle at 50% 45%, var(--style-frame-color) 3px, transparent 3px),
			radial-gradient(circle at 50% 65%, var(--style-frame-color) 3px, transparent 3px),
			radial-gradient(circle at 50% 85%, var(--style-frame-color) 3px, transparent 3px),
			linear-gradient(180deg, transparent 0%, var(--style-frame-secondary) 10%, var(--style-frame-color) 50%, var(--style-frame-secondary) 90%, transparent 100%) 50% 0 / 2px 100% no-repeat;
	}

	/* Dissolving/Mist frame */
	.mist-edge {
		position: absolute;
		top: 30px;
		bottom: 30px;
		width: 40px;
	}
	.mist-edge.left {
		left: 0;
		background: linear-gradient(90deg, var(--style-frame-color), transparent);
		mask: linear-gradient(180deg, transparent 0%, white 20%, white 80%, transparent 100%);
		opacity: 0.3;
	}
	.mist-edge.right {
		right: 0;
		background: linear-gradient(-90deg, var(--style-frame-color), transparent);
		mask: linear-gradient(180deg, transparent 0%, white 20%, white 80%, transparent 100%);
		opacity: 0.3;
	}

	/* Radiant frame */
	.rays-container {
		position: absolute;
		top: 0;
		left: 0;
		width: 100px;
		height: 100px;
		overflow: hidden;
	}
	.ray {
		position: absolute;
		top: 0;
		left: 0;
		width: 100px;
		height: 2px;
		background: linear-gradient(90deg, var(--style-frame-color), transparent);
		transform-origin: 0 0;
		transform: rotate(calc(var(--ray-index) * 15deg));
		opacity: 0.6;
	}

	.baroque-corner {
		position: absolute;
		width: 30px;
		height: 30px;
		border: 2px solid var(--style-frame-color);
		border-radius: 0 0 50% 0;
	}
	.baroque-corner.top-left { top: 15px; left: 15px; border-radius: 0 0 50% 0; border-top: none; border-left: none; }
	.baroque-corner.top-right { top: 15px; right: 15px; border-radius: 0 0 0 50%; border-top: none; border-right: none; }

	/* Spiked frame */
	.spike-frame {
		position: absolute;
		left: 30px;
		right: 30px;
		height: 15px;
	}
	.spike-frame.top {
		top: 5px;
		background: repeating-linear-gradient(90deg, transparent 0, transparent 10px, var(--style-frame-color) 10px, var(--style-frame-color) 12px, transparent 12px, transparent 25px);
		clip-path: polygon(0 100%, 4% 0, 8% 100%, 12% 0, 16% 100%, 20% 0, 24% 100%, 28% 0, 32% 100%, 36% 0, 40% 100%, 44% 0, 48% 100%, 52% 0, 56% 100%, 60% 0, 64% 100%, 68% 0, 72% 100%, 76% 0, 80% 100%, 84% 0, 88% 100%, 92% 0, 96% 100%, 100% 0, 100% 100%);
	}
	.spike-frame.bottom {
		bottom: 5px;
		background: repeating-linear-gradient(90deg, transparent 0, transparent 10px, var(--style-frame-color) 10px, var(--style-frame-color) 12px, transparent 12px, transparent 25px);
		clip-path: polygon(0 0, 4% 100%, 8% 0, 12% 100%, 16% 0, 20% 100%, 24% 0, 28% 100%, 32% 0, 36% 100%, 40% 0, 44% 100%, 48% 0, 52% 100%, 56% 0, 60% 100%, 64% 0, 68% 100%, 72% 0, 76% 100%, 80% 0, 84% 100%, 88% 0, 92% 100%, 96% 0, 100% 100%, 100% 0);
	}

	.thorn-side {
		position: absolute;
		top: 40px;
		bottom: 40px;
		width: 15px;
	}
	.thorn-side.left {
		left: 5px;
		background: repeating-linear-gradient(180deg, transparent 0, transparent 15px, var(--style-frame-color) 15px, transparent 30px);
		clip-path: polygon(100% 0, 0 5%, 100% 10%, 0 15%, 100% 20%, 0 25%, 100% 30%, 0 35%, 100% 40%, 0 45%, 100% 50%, 0 55%, 100% 60%, 0 65%, 100% 70%, 0 75%, 100% 80%, 0 85%, 100% 90%, 0 95%, 100% 100%);
	}
	.thorn-side.right {
		right: 5px;
		background: repeating-linear-gradient(180deg, transparent 0, transparent 15px, var(--style-frame-color) 15px, transparent 30px);
		clip-path: polygon(0 0, 100% 5%, 0 10%, 100% 15%, 0 20%, 100% 25%, 0 30%, 100% 35%, 0 40%, 100% 45%, 0 50%, 100% 55%, 0 60%, 100% 65%, 0 70%, 100% 75%, 0 80%, 100% 85%, 0 90%, 100% 95%, 0 100%);
	}

	/* Warped frame */
	.warp-border {
		position: absolute;
		left: 20px;
		right: 20px;
		height: 2px;
		background: var(--style-frame-color);
	}
	.warp-border.top {
		top: 22px;
		clip-path: polygon(0 50%, 10% 0, 20% 80%, 30% 20%, 40% 70%, 50% 30%, 60% 60%, 70% 10%, 80% 90%, 90% 40%, 100% 50%);
	}
	.warp-border.bottom {
		bottom: 22px;
		clip-path: polygon(0 50%, 10% 100%, 20% 20%, 30% 80%, 40% 30%, 50% 70%, 60% 40%, 70% 90%, 80% 10%, 90% 60%, 100% 50%);
	}

	.impossible-corner {
		position: absolute;
		width: 25px;
		height: 25px;
		border: 2px solid var(--style-frame-color);
	}
	.impossible-corner.top-left {
		top: 12px;
		left: 12px;
		clip-path: polygon(0 0, 100% 0, 100% 50%, 50% 50%, 50% 100%, 0 100%);
	}
	.impossible-corner.top-right {
		top: 12px;
		right: 12px;
		clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 100%, 50% 50%, 0 50%);
	}

	/* ========== PARTICLES ========== */
	.particles {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
	}

	.particle {
		position: absolute;
		border-radius: 50%;
		background: var(--style-particle-color);
		box-shadow: 0 0 8px var(--style-particle-color);
		animation: drift var(--p-duration, 6s) ease-in-out infinite;
		animation-delay: var(--p-delay, 0s);
	}

	/* Distribute particles */
	.particle.p1 { width: 3px; height: 3px; top: 15%; left: 12%; }
	.particle.p2 { width: 2px; height: 2px; top: 25%; right: 15%; }
	.particle.p3 { width: 3px; height: 3px; top: 70%; left: 10%; }
	.particle.p4 { width: 2px; height: 2px; top: 80%; right: 12%; }
	.particle.p5 { width: 2px; height: 2px; top: 45%; left: 8%; }
	.particle.p6 { width: 2px; height: 2px; top: 55%; right: 8%; }
	.particle.p7 { width: 3px; height: 3px; top: 35%; left: 15%; }
	.particle.p8 { width: 2px; height: 2px; top: 65%; right: 18%; }
	.particle.p9 { width: 2px; height: 2px; top: 20%; left: 20%; }
	.particle.p10 { width: 3px; height: 3px; top: 85%; left: 25%; }
	.particle.p11 { width: 2px; height: 2px; top: 40%; right: 22%; }
	.particle.p12 { width: 2px; height: 2px; top: 75%; right: 25%; }

	/* Ember particles - larger, more glow */
	.particles-embers .particle {
		background: radial-gradient(circle, #fff 0%, var(--style-particle-color) 40%, transparent 70%);
		box-shadow: 0 0 12px var(--style-particle-color), 0 0 24px color-mix(in srgb, var(--style-particle-color) 50%, transparent);
		border-radius: 50% 50% 50% 0;
		transform: rotate(45deg);
	}

	/* Snowflake particles - star shape */
	.particles-snowflakes .particle {
		background: transparent;
		box-shadow:
			0 0 0 1px var(--style-particle-color),
			2px 0 0 var(--style-particle-color),
			-2px 0 0 var(--style-particle-color),
			0 2px 0 var(--style-particle-color),
			0 -2px 0 var(--style-particle-color);
		border-radius: 0;
	}

	/* Wisp particles - soft blur */
	.particles-wisps .particle {
		width: 20px !important;
		height: 20px !important;
		background: radial-gradient(circle, var(--style-particle-color), transparent 70%);
		box-shadow: none;
		filter: blur(4px);
	}

	/* Star particles - twinkling */
	.particles-stars .particle {
		box-shadow:
			0 0 2px var(--style-particle-color),
			0 0 4px var(--style-particle-color);
	}

	/* Sparkle particles - fairy dust with bright centers */
	.particles-sparkles .particle {
		background: radial-gradient(circle, #fff 0%, var(--style-particle-color) 30%, transparent 70%);
		box-shadow:
			0 0 6px var(--style-particle-color),
			0 0 12px var(--style-particle-color),
			0 0 18px color-mix(in srgb, var(--style-particle-color) 40%, transparent);
		animation: sparkle-drift var(--p-duration, 6s) ease-in-out infinite;
		animation-delay: var(--p-delay, 0s);
	}

	@keyframes sparkle-drift {
		0%, 100% { transform: translate(0, 0) scale(0.8); opacity: 0.4; }
		25% { transform: translate(3px, -8px) scale(1.2); opacity: 1; }
		50% { transform: translate(-2px, -12px) scale(0.9); opacity: 0.6; }
		75% { transform: translate(4px, -6px) scale(1.4); opacity: 1; }
	}

	@keyframes drift {
		0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
		50% { transform: translate(5px, -10px) scale(1.3); opacity: 0.8; }
	}

	/* ========== CONTENT ========== */
	.content {
		position: absolute;
		z-index: 2;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 50px;
		text-align: center;
		gap: 0;
	}

	.order-badge {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
		flex-shrink: 0;
	}

	.order-line {
		width: 40px;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--style-badge-color));
	}
	.order-line.right {
		background: linear-gradient(90deg, var(--style-badge-color), transparent);
	}

	.order-num {
		font-size: 14px;
		font-weight: 700;
		color: var(--style-badge-color);
		letter-spacing: 0.1em;
		white-space: nowrap;
		text-shadow: 0 0 20px var(--style-glow);
		padding: 2px 8px;
		background: var(--style-badge-bg);
		border: 1px solid var(--style-badge-border);
		border-radius: 2px;
	}

	.title {
		margin: 0;
		font-size: 32px;
		font-weight: var(--style-title-weight, 800);
		color: var(--style-text);
		text-transform: uppercase;
		letter-spacing: var(--style-title-spacing, 0.04em);
		line-height: 1.1;
		max-width: 500px;
		text-shadow:
			0 0 var(--style-title-glow-strength) var(--style-title-glow),
			0 2px 10px var(--style-shadow);
		flex-shrink: 0;
	}

	/* Divider variations */
	.divider {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 6px 0 10px 0;
		flex-shrink: 0;
	}

	.div-wing {
		width: 60px;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--style-divider-color));
	}
	.div-wing.right {
		background: linear-gradient(90deg, var(--style-divider-color), transparent);
	}

	.div-center {
		width: 8px;
		height: 8px;
		background: var(--style-primary);
		transform: rotate(45deg);
		box-shadow: 0 0 15px var(--style-glow);
	}

	/* Divider type variations */
	.divider-flames .div-center {
		clip-path: polygon(50% 0%, 0% 100%, 25% 60%, 50% 100%, 75% 60%, 100% 100%);
		transform: none;
		width: 16px;
		height: 12px;
	}

	.divider-icicles .div-center {
		clip-path: polygon(50% 100%, 0% 0%, 100% 0%);
		transform: none;
		width: 12px;
		height: 10px;
	}

	.divider-halo .div-center {
		border-radius: 50%;
		box-shadow: 0 0 20px var(--style-glow), 0 0 40px var(--style-glow);
	}

	.divider-chains .div-center {
		width: 12px;
		height: 8px;
		border-radius: 50%;
		background: transparent;
		border: 2px solid var(--style-primary);
		transform: none;
	}

	.divider-tentacles .div-wing {
		height: 3px;
		background: repeating-linear-gradient(90deg, var(--style-divider-color), var(--style-divider-color) 5px, transparent 5px, transparent 8px);
	}

	.description-wrapper {
		flex: 1 1 0;
		min-height: 0;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		overflow: hidden;
		width: 100%;
	}

	.description {
		margin: 0;
		font-family: 'Inria Sans', sans-serif;
		font-size: 17px;
		font-weight: 400;
		color: var(--style-text-secondary);
		line-height: 1.5;
		max-width: 480px;
		text-shadow: 0 2px 8px var(--style-shadow);
		overflow: hidden;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 7;
	}

	.footer {
		position: absolute;
		bottom: 35px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 140px;
		z-index: 3;
	}

	.footer-accent {
		width: 5px;
		height: 5px;
		background: var(--style-primary);
		opacity: 0.5;
		transform: rotate(45deg);
	}

	.rewards {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
		max-width: 520px;
		align-items: center;
		flex-shrink: 0;
		padding-top: 4px;
	}

	.rewards-divider {
		width: 280px;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--style-divider-color), transparent);
		opacity: 0.9;
	}

	.rewards-row {
		display: flex;
		align-items: center;
		gap: 16px;
		justify-content: center;
	}

	.rewards-title {
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--style-text) 88%, transparent);
		text-shadow: 0 2px 10px var(--style-shadow);
		white-space: nowrap;
	}

	.reward-icons {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		justify-content: flex-start;
	}

	.reward-icons img {
		width: 44px;
		height: 44px;
		object-fit: contain;
		filter:
			drop-shadow(1px 0 0 #2b1a12)
			drop-shadow(-1px 0 0 #2b1a12)
			drop-shadow(0 1px 0 #2b1a12)
			drop-shadow(0 -1px 0 #2b1a12)
			drop-shadow(1px 1px 0 #2b1a12)
			drop-shadow(-1px 1px 0 #2b1a12)
			drop-shadow(1px -1px 0 #2b1a12)
			drop-shadow(-1px -1px 0 #2b1a12)
			drop-shadow(2px 0 0 #2b1a12)
			drop-shadow(-2px 0 0 #2b1a12)
			drop-shadow(0 2px 0 #2b1a12)
			drop-shadow(0 -2px 0 #2b1a12);
	}

	.stage-completion {
		margin-top: 10px;
		width: 100%;
		max-width: 520px;
		padding: 8px 12px;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid color-mix(in srgb, var(--style-primary) 22%, transparent);
		box-shadow: inset 0 0 0 1px rgba(15, 10, 26, 0.25);
	}

	.stage-completion__label {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--style-text) 82%, transparent);
		margin-bottom: 4px;
	}

	.stage-completion__text {
		font-family: 'Inria Sans', sans-serif;
		font-size: 13px;
		font-weight: 600;
		line-height: 1.25;
		color: var(--style-text);
		text-shadow: 0 2px 10px var(--style-shadow);
	}

	.vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		box-shadow: inset 0 0 100px color-mix(in srgb, var(--style-base-bg) calc(var(--style-vignette-strength) * 100%), transparent);
	}
</style>
