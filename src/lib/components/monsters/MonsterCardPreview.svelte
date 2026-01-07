<script lang="ts">
	/**
	 * Blood Crimson Monster Card
	 * Dark red/purple theme with full-width bottom damage bar
	 */
	import type { MonsterRow, SpecialEffectRow, SpecialEffectType } from '$lib/types/gameData';
	import { getIconPoolUrl } from '$lib/utils/iconPool';

	type Monster = MonsterRow & {
		icon_url?: string | null;
		art_url?: string | null;
		effects?: SpecialEffectRow[];
		invade_location_name?: string | null;
	};

	export let monster: Monster;
	export let orderNum: number | undefined = undefined;
	export let footerLabel: string = 'Monster';
	export let renderMode: 'full' | 'fast' = 'full';

	const stateColors: Record<string, string> = {
		tainted: '#dc2626',
		corrupt: '#991b1b',
		fallen: '#7f1d1d',
		arcane: '#0ea5e9',
		inactive: '#64748b'
	};

	const classificationLabels: Record<string, string> = {
		monster: 'Monster',
		abyss_guardian: 'Abyss Guardian',
		boss: 'Boss'
	};

	const classificationColors: Record<string, string> = {
		abyss_guardian: '#0ea5e9',
		boss: '#450a0a'
	};

	const effectTypeLabels: Record<SpecialEffectType, string> = {
		before_combat: 'BEFORE COMBAT',
		during_combat: 'DURING COMBAT',
		after_combat: 'AFTER COMBAT',
		combat_type: 'COMBAT TYPE'
	};

	const effectTypeColors: Record<SpecialEffectType, string> = {
		before_combat: '#f59e0b',
		during_combat: '#ef4444',
		after_combat: '#22c55e',
		combat_type: '#8b5cf6'
	};

	let rewardSlots: string[][] = [];
	let showTutorial = true;
	let participationIconIds: string[] = [];
	let trackSlotCount = 0;

	$: stateColor = stateColors[monster.state ?? 'tainted'] ?? '#dc2626';
	$: classification = monster.monster_classification ?? 'monster';
	$: classificationLabel = classificationLabels[classification] ?? 'Monster';
	$: classificationColor = classificationColors[classification] ?? '#334155';
	$: barrierCount = Math.max(0, Math.round(monster.barrier ?? 0));
	$: killedBarrierIndex = Math.max(1, barrierCount);

	function normalizeRewardTrack(track: unknown, killedIndex: number): string[][] {
		const targetLen = killedIndex + 1; // includes slot0 participation
		const safe: string[][] = Array.isArray(track)
			? track.map((slot) =>
					Array.isArray(slot)
						? slot
								.filter((id): id is string => typeof id === 'string')
								.map((id) => id.trim())
								.filter(Boolean)
						: []
				)
			: [];

		while (safe.length < targetLen) safe.push([]);
		return safe.slice(0, targetLen);
	}

	$: rewardSlots = normalizeRewardTrack((monster as { reward_track?: unknown }).reward_track, killedBarrierIndex);
	$: showTutorial = (monster as { show_tutorial?: boolean | null }).show_tutorial ?? true;
	$: participationIconIds = rewardSlots[0] ?? [];
	$: trackSlotCount = killedBarrierIndex; // excludes participation (slot 0), includes KILLED

	// Calculate gradient color from red to black
	// totalSteps = marker-start (0) to killed (killedBarrierIndex + 1)
	$: totalSteps = killedBarrierIndex;
	function getGradientColor(step: number): string {
		const t = totalSteps > 0 ? step / totalSteps : 1;
		const r = Math.round(74 * (1 - t));
		const g = Math.round(21 * (1 - t));
		const b = Math.round(21 * (1 - t));
		const r2 = Math.round(45 * (1 - t));
		const g2 = Math.round(10 * (1 - t));
		const b2 = Math.round(10 * (1 - t));
		return `linear-gradient(180deg, rgb(${r}, ${g}, ${b}) 0%, rgb(${r2}, ${g2}, ${b2}) 100%)`;
	}
</script>

<div class="blood-card" class:fast={renderMode === 'fast'}>
	<!-- Vein Pattern Overlay -->
	<div class="vein-overlay"></div>

	<!-- Main Content Area -->
	<div class="main-area">
		<div class="slash-marks"></div>

		<div class="content-zone">
			<!-- Header -->
			<div class="header-row">
				{#if monster.icon_url}
					<img src={monster.icon_url} alt="" class="monster-icon" loading="lazy" decoding="async" />
				{:else if monster.icon}
					<div class="monster-icon-emoji">{monster.icon}</div>
				{/if}
				<div class="name-block">
					<h3 class="monster-name">{monster.name}</h3>
					<div class="name-tags">
						{#if classification !== 'monster'}
							<span class="classification-badge" style="--badge-color: {classificationColor}">
								{classificationLabel.toUpperCase()}
							</span>
						{/if}
						<span class="state-badge" style="--state-color: {stateColor}">
							{(monster.state ?? 'tainted').toUpperCase()}
						</span>
					</div>
					{#if monster.invade_location_name}
						<div class="invade-subtitle">Invades: {monster.invade_location_name}</div>
					{/if}
				</div>
			</div>

			<!-- Effects -->
			<div class="effects-section">
				{#if monster.effects && monster.effects.length > 0}
					{#each monster.effects.slice(0, 2) as effect}
						<div class="effect-item">
							<span
								class="effect-type-badge"
								style="--type-color: {effectTypeColors[effect.effect_type] ?? effectTypeColors.during_combat}"
							>
								{effectTypeLabels[effect.effect_type] ?? 'DURING COMBAT'}
							</span>
							<div class="effect-content">
								<span class="effect-bullet"></span>
								<span class="effect-name">{effect.name}:</span>
								<span class="effect-desc">{@html effect.description || ''}</span>
							</div>
						</div>
					{/each}
				{:else}
					<div class="effects-empty">No special effects.</div>
				{/if}
			</div>

		</div>
	</div>

	<!-- Art Panel -->
	<div class="art-panel">
		{#if monster.art_url}
			<img src={monster.art_url} alt={monster.name} class="monster-art" loading="lazy" decoding="async" />
		{:else}
			<div class="no-art"></div>
		{/if}
		<div class="art-gradient"></div>

	</div>

		<!-- Bottom Damage Bar (spans entire card) -->
	<div class="bottom-bar">
		<div class="barrier-track" style="--slot-count: {trackSlotCount + 1};">
			<div class="barrier-segment marker-start" style="background: {getGradientColor(0)};">
				<div class="barrier-hint">Marker<br/>Start</div>
			</div>
			{#each Array.from({ length: trackSlotCount }, (_, i) => i + 1) as slotIndex (slotIndex)}
				{@const iconIds = rewardSlots[slotIndex] ?? []}
				{@const isKilled = slotIndex === killedBarrierIndex}
				{@const hasIcons = iconIds.length > 0}
				<div
					class="barrier-segment"
					class:killed={isKilled}
					style="background: {getGradientColor(slotIndex)};"
				>
					<div class="barrier-hint">
						{#if isKilled}
							KILLED
						{:else}
							Damage {slotIndex}
						{/if}
					</div>
					{#if hasIcons}
						<div class="barrier-icons">
							{#each iconIds as iconId}
								{@const url = getIconPoolUrl(iconId)}
								{#if url}
									<img src={url} alt="" loading="lazy" decoding="async" class="barrier-icon" />
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/each}
			</div>
	</div>

	<div class="tutorial-float">
		<div class="tutorial-block">
			{#if showTutorial}
				<div class="tutorial-title">Tutorial</div>
				<div class="tutorial-text">Deal damage to move the marker right, gaining rewards along the way.</div>
			{:else}
				<div class="tutorial-title">Participation</div>
				{#if participationIconIds.length === 0}
					<div class="tutorial-text">No participation rewards.</div>
				{:else}
					<div class="tutorial-icons">
						{#each participationIconIds as iconId}
							{@const url = getIconPoolUrl(iconId)}
							{#if url}
								<img src={url} alt="" loading="lazy" decoding="async" />
							{/if}
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>

	<div class="damage-float">
		<div class="stats-block">
			<div class="stat-column">
				<div class="stat-value">{barrierCount}</div>
				<div class="stat-label">BARRIER</div>
			</div>
			<div class="stat-divider"></div>
			<div class="stat-column">
				<div class="stat-value">{monster.damage ?? 0}</div>
				<div class="stat-label">DAMAGE</div>
			</div>
		</div>
	</div>
</div>

<style>
	.blood-card {
		width: 600px;
		height: 437px;
		font-family: 'Opsilon', serif;
		position: relative;
		display: grid;
		grid-template-columns: 1.2fr 0.8fr;
		grid-template-rows: 1fr 72px;
		background: linear-gradient(135deg, #1a0505 0%, #430d4a 50%, #0d0202 100%);
		border-radius: 4px;
		overflow: hidden;
		box-shadow:
			0 4px 24px rgba(220, 38, 38, 0.3),
			0 0 60px rgba(127, 29, 29, 0.2),
			inset 0 0 100px rgba(0, 0, 0, 0.5);
		border: 2px solid #3d0363;
	}

	.blood-card.fast {
		box-shadow: none;
	}

	.blood-card.fast .monster-art {
		filter: none;
	}

	.vein-overlay {
		position: absolute;
		inset: 0;
		background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10,50 Q30,20 50,50 T90,50' stroke='%23450a0a' stroke-width='1' fill='none' opacity='0.3'/%3E%3Cpath d='M20,30 Q40,60 60,30 T100,30' stroke='%23450a0a' stroke-width='0.5' fill='none' opacity='0.2'/%3E%3C/svg%3E");
		pointer-events: none;
		opacity: 0.8;
	}

	.main-area {
		position: relative;
		padding: 20px;
		display: flex;
		flex-direction: column;
		background: linear-gradient(135deg, rgba(45, 10, 10, 0.9) 0%, rgba(26, 5, 5, 0.95) 100%);
		z-index: 2;
		grid-row: 1;
	}

	.slash-marks {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 60px;
		height: 80px;
		background: repeating-linear-gradient(
			-45deg,
			transparent,
			transparent 8px,
			rgba(220, 38, 38, 0.2) 8px,
			rgba(220, 38, 38, 0.2) 10px
		);
		pointer-events: none;
	}

	.content-zone {
		flex: 1;
		display: flex;
		flex-direction: column;
		position: relative;
		z-index: 1;
		gap: 10px;
	}

	.header-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.monster-icon {
		width: 52px;
		height: 52px;
		object-fit: contain;
		border-radius: 4px;
		border: 2px solid #991b1b;
		background: rgba(0, 0, 0, 0.5);
		box-shadow: 0 0 15px rgba(220, 38, 38, 0.4);
	}

	.monster-icon-emoji {
		font-size: 2.8rem;
		width: 52px;
		height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		filter: drop-shadow(0 0 8px rgba(220, 38, 38, 0.6));
	}

	.name-block {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.name-tags {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.monster-name {
		font-size: 2.1rem;
		font-weight: 800;
		color: #fecaca;
		margin: 0;
		letter-spacing: 1px;
		text-shadow:
			0 0 10px rgba(220, 38, 38, 0.5),
			0 2px 4px rgba(0, 0, 0, 0.5);
		text-transform: uppercase;
	}

	.invade-subtitle {
		font-size: 0.75rem;
		font-weight: 600;
		color: #b89090;
		letter-spacing: 0.03em;
		font-style: italic;
	}

	.state-badge {
		padding: 4px 10px;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		background: var(--state-color);
		color: #fecaca;
		border-radius: 3px;
	}

	.footer-badges {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.classification-badge {
		padding: 4px 10px;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		background: var(--badge-color);
		color: #e2e8f0;
		border-radius: 3px;
	}

	.effects-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex: 1;
		padding: 12px;
		background: rgba(0, 0, 0, 0.4);
		border-left: 3px solid #dc2626;
		clip-path: polygon(0 0, 100% 0, 98% 100%, 0 100%);
	}

	.effects-empty {
		font-size: 0.8rem;
		color: rgba(148, 163, 184, 0.8);
		line-height: 1.3;
	}

	.effect-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.effect-type-badge {
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--type-color);
		text-transform: uppercase;
		opacity: 0.9;
	}

	.effect-content {
		font-size: 0.8rem;
		line-height: 1.4;
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}

	.effect-bullet {
		width: 6px;
		height: 6px;
		background: #dc2626;
		transform: rotate(45deg);
		flex-shrink: 0;
		margin-top: 5px;
	}

	.effect-name {
		font-weight: 700;
		color: #fca5a5;
	}

	.effect-desc {
		color: #a8a0b0;
	}

	.reward-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.reward-label {
		font-size: 0.65rem;
		font-weight: 600;
		color: #b89090;
		letter-spacing: 0.02em;
	}

	.reward-icons {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.reward-icon {
		width: 36px;
		height: 36px;
		object-fit: contain;
		border-radius: 4px;
	}

	.art-panel {
		position: relative;
		overflow: hidden;
		z-index: 1;
		grid-row: 1;
	}

	.monster-art {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(80%) contrast(120%) brightness(90%);
	}

	.no-art {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, #1a0505, #0d0202);
	}

	.art-gradient {
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, rgba(26, 5, 5, 0.9) 0%, rgba(45, 10, 10, 0.4) 30%, transparent 60%);
		pointer-events: none;
	}

	.bottom-bar {
		grid-column: 1 / -1;
		grid-row: 2;
		display: flex;
		align-items: stretch;
		gap: 0;
		background: #0a0404;
		z-index: 3;
		position: relative;
	}

	.damage-float {
		position: absolute;
		right: 12px;
		bottom: 72px;
		z-index: 4;
	}

	.stats-block {
		display: flex;
		align-items: stretch;
		height: 55px;
		background: linear-gradient(180deg, #4a0a0a 0%, #2a0606 50%, #1a0404 100%);
		border: 2px solid #7f1d1d;
		border-bottom: none;
		border-radius: 8px 8px 0 0;
	}

	.stat-column {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4px 14px;
	}

	.stat-divider {
		width: 1px;
		background: rgba(127, 29, 29, 0.6);
		margin: 8px 0;
	}

	.stat-value {
		font-size: 1.8rem;
		font-weight: 800;
		color: #fecaca;
		line-height: 1;
		text-shadow: 0 0 20px rgba(220, 38, 38, 0.6), 0 2px 4px rgba(0, 0, 0, 0.8);
	}

	.stat-label {
		margin-top: 2px;
		font-size: 0.55rem;
		font-weight: 700;
		color: rgba(248, 250, 252, 0.7);
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.barrier-track {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(var(--slot-count), 1fr);
		gap: 2px;
		align-items: stretch;
		min-width: 0;
		padding: 4px;
		background: #0a0404;
	}

	.barrier-segment {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		padding: 4px 2px;
		background: linear-gradient(180deg, #4a1515 0%, #2d0a0a 100%);
		border-radius: 3px;
	}

	.barrier-hint {
		font-size: 0.75rem;
		line-height: 1;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: rgba(248, 250, 252, 0.6);
		text-transform: uppercase;
		text-align: center;
	}

	.barrier-icons {
		display: flex;
		gap: 4px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.barrier-segment .barrier-icon {
		width: 32px;
		height: 32px;
		object-fit: contain;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
	}

	.no-reward {
		font-size: 0.7rem;
		font-weight: 600;
		color: rgba(248, 250, 252, 0.35);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-align: center;
	}

	.barrier-segment.marker-start {
		min-width: 50px;
	}

	.barrier-segment.killed {
		min-width: 80px;
	}

	.tutorial-float {
		position: absolute;
		left: 12px;
		bottom: 72px;
		z-index: 4;
	}

	.tutorial-block {
		width: 200px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		background: linear-gradient(180deg, #4a0a0a 0%, #2a0606 50%, #1a0404 100%);
		border: 2px solid #7f1d1d;
		border-bottom: none;
		border-radius: 8px 8px 0 0;
	}

	.tutorial-title {
		font-size: 0.85rem;
		font-weight: 800;
		color: rgba(248, 250, 252, 0.7);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		text-align: center;
	}

	.tutorial-text {
		font-size: 0.7rem;
		line-height: 1.3;
		font-weight: 500;
		color: rgba(248, 250, 252, 0.5);
		text-align: center;
		font-style: italic;
	}

	.tutorial-icons {
		display: flex;
		gap: 6px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.tutorial-icons img {
		width: 34px;
		height: 34px;
		object-fit: contain;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
	}

	.kill-rewards {
		display: flex;
		gap: 4px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.kill-reward-icon {
		width: 28px;
		height: 28px;
		object-fit: contain;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
	}

</style>
