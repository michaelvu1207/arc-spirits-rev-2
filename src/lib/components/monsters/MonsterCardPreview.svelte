<script lang="ts">
	/**
	 * Blood Crimson Monster Card
	 * Dark red/purple theme with floating stat bar over art
	 */
	import type { MonsterRow, SpecialEffectRow, RewardRow } from '$lib/types/gameData';
	import { REWARD_ROW_CONFIG } from '$lib/types/gameData';

	type ResolvedRewardRow = RewardRow & {
		icon_urls: (string | null)[];
	};

	type Monster = MonsterRow & {
		icon_url?: string | null;
		art_url?: string | null;
		resolved_reward_rows?: ResolvedRewardRow[];
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
		boss: '#450a0a'
	};

	$: stateColor = stateColors[monster.state ?? 'tainted'] ?? '#dc2626';
	$: killRewardRow = (monster.resolved_reward_rows ?? []).find(row => row.type === 'all_in_combat' && row.icon_urls?.some(Boolean));
	$: defeatRewardRow = (monster.resolved_reward_rows ?? []).find(row => row.type === 'all_losers' && row.icon_urls?.some(Boolean));
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
					<img src={monster.icon_url} alt="" class="monster-icon" />
				{:else if monster.icon}
					<div class="monster-icon-emoji">{monster.icon}</div>
				{/if}
				<div class="name-block">
					<h3 class="monster-name">{monster.name}</h3>
					{#if monster.invade_location_name}
						<div class="invade-subtitle">Invades: {monster.invade_location_name}</div>
					{/if}
				</div>
			</div>

			<!-- Effects -->
			{#if monster.effects && monster.effects.length > 0}
				<div class="effects-section">
					{#each monster.effects.slice(0, 2) as effect}
						<div class="effect-item">
							<span class="effect-bullet"></span>
							<span class="effect-name">{effect.name}:</span>
							<span class="effect-desc">{@html effect.description || ''}</span>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Kill Reward Row -->
			{#if killRewardRow}
				<div class="reward-section">
					<div class="reward-label">On kill, all in combat gain:</div>
					<div class="reward-icons">
						{#each killRewardRow.icon_urls.filter(Boolean) as iconUrl}
							<img src={iconUrl} alt="" class="reward-icon" />
						{/each}
					</div>
				</div>
			{/if}

			<!-- Defeat Reward Row -->
			{#if defeatRewardRow}
				<div class="reward-section">
					<div class="reward-label">All in monster combat gain:</div>
					<div class="reward-icons">
						{#each defeatRewardRow.icon_urls.filter(Boolean) as iconUrl}
							<img src={iconUrl} alt="" class="reward-icon" />
						{/each}
					</div>
				</div>
			{/if}

			<!-- Footer -->
			<div class="card-footer">
				<span class="footer-label">Arc Spirits // {footerLabel}</span>
				<span class="state-badge" style="--state-color: {stateColor}">
					{(monster.state ?? 'tainted').toUpperCase()}
				</span>
			</div>
		</div>
	</div>

	<!-- Art Panel with Floating Stats -->
	<div class="art-panel">
		{#if monster.art_url}
			<img src={monster.art_url} alt={monster.name} class="monster-art" />
		{:else}
			<div class="no-art"></div>
		{/if}
		<div class="art-gradient"></div>

		<!-- Floating Stat Bar -->
		<div class="floating-stat-bar">
			<div class="stat-slot damage">
				<span class="stat-value">{monster.damage ?? 0}</span>
				<span class="stat-label">DAMAGE</span>
			</div>
			<div class="stat-slot barrier">
				<span class="stat-value">{(monster as any).barrier ?? 0}</span>
				<span class="stat-label">BARRIER</span>
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

	.blood-card.fast .floating-stat-bar {
		backdrop-filter: none;
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

	.effect-item {
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

	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 10px;
		border-top: 1px solid rgba(220, 38, 38, 0.3);
	}

	.footer-label {
		font-size: 0.7rem;
		color: #991b1b;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	.art-panel {
		position: relative;
		overflow: hidden;
		z-index: 1;
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

	/* Floating Stat Bar */
	.floating-stat-bar {
		position: absolute;
		left: 50%;
		bottom: 12px;
		transform: translateX(-50%);
		display: flex;
		gap: 9px;
		padding: 9px 12px;
		background: linear-gradient(135deg, rgba(20, 8, 8, 0.92) 0%, rgba(15, 5, 5, 0.95) 100%);
		border: 1px solid rgba(120, 40, 40, 0.6);
		border-radius: 9px;
		backdrop-filter: blur(6px);
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
		z-index: 10;
	}

	.stat-slot {
		width: 81px;
		height: 81px;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		position: relative;
		border-radius: 6px;
	}

	.stat-slot.damage {
		background: linear-gradient(135deg, rgba(80, 20, 20, 0.6), rgba(20, 5, 5, 0.7));
	}

	.stat-slot.barrier {
		background: linear-gradient(135deg, rgba(60, 25, 25, 0.5), rgba(20, 5, 5, 0.7));
	}

	.stat-label {
		margin-top: 6px;
		padding: 2px 10px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.55);
		font-size: 0.75rem;
		font-weight: 800;
		color: rgba(248, 250, 252, 0.95);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
	}

	.stat-value {
		font-size: 1.95rem;
		font-weight: 800;
		color: rgba(240, 220, 220, 0.95);
		line-height: 1;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.65);
	}
</style>
