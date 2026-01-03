<script lang="ts">
	// Reward row controls
	let showKillReward = $state(true);
	let killRewardIconCount = $state(3);
	let showDefeatReward = $state(true);
	let defeatRewardIconCount = $state(2);

	// Generate placeholder icons based on count
	const killIcons = ['R1', 'R2', 'R3', 'R4', 'R5'];
	const defeatIcons = ['D1', 'D2', 'D3', 'D4', 'D5'];

	// Reactive reward rows based on controls
	let resolvedRewardRows = $derived.by(() => {
		const rows: any[] = [];
		if (showKillReward) {
			rows.push({
				type: 'all_in_combat' as const,
				icon_ids: killIcons.slice(0, killRewardIconCount),
				label: undefined,
				icon_urls: killIcons.slice(0, killRewardIconCount).map(t => `https://placehold.co/32x32/fbbf24/000?text=${t}`)
			});
		}
		if (showDefeatReward) {
			rows.push({
				type: 'all_losers' as const,
				icon_ids: defeatIcons.slice(0, defeatRewardIconCount),
				label: undefined,
				icon_urls: defeatIcons.slice(0, defeatRewardIconCount).map(t => `https://placehold.co/32x32/f87171/000?text=${t}`)
			});
		}
		return rows;
	});

	// Invade location control
	let invadeLocationName = $state('Dark Forest');

	// Sample monster for preview
	let monster = $derived.by(() => ({
		name: 'Blood Fiend',
		damage: 9,
		barrier: 4,
		state: 'boss' as const,
		icon: '',
		icon_url: '',
		art_url: '',
		effects: [
			{ name: 'Bloodlust', description: 'Heals 2 HP on kill', color: '#dc2626' },
			{ name: 'Crimson Rage', description: 'Gains +1 damage when below 50% HP', color: '' }
		],
		resolved_reward_rows: resolvedRewardRows,
		invade_location_name: invadeLocationName || null
	}));

	// Theme configuration with defaults (matching your config)
	let theme = $state({
		// Card dimensions
		cardWidth: 600,
		cardHeight: 437,
		borderRadius: 4,
		borderWidth: 2,

		// Background colors
		bgGradient1: '#1a0505',
		bgGradient2: '#430d4a',
		bgGradient3: '#0d0202',
		borderColor: '#3d0363',

		// Main area
		mainAreaBg1: 'rgba(45, 10, 10, 0.9)',
		mainAreaBg2: 'rgba(26, 5, 5, 0.95)',

		// Vein overlay
		veinsEnabled: true,
		veinsOpacity: 0.8,
		veinColor: '#450a0a',

		// Slash marks
		slashEnabled: true,
		slashColor: 'rgba(220, 38, 38, 0.2)',

		// Text colors
		nameColor: '#fecaca',
		nameFontSize: 2.1,
		nameGlow: 'rgba(220, 38, 38, 0.5)',
		effectNameColor: '#fca5a5',
		effectDescColor: '#a8a0b0',
		footerColor: '#991b1b',

		// State badge
		badgeSlashColor: '#7f1d1d',

		// Divider
		dividerColor: '#db4d4d',
		dividerStrokeWidth: 2,

		// Effects section
		effectsBorderColor: '#dc2626',
		effectsBorderWidth: 3,
		effectsBulletColor: '#dc2626',

		// Floating stat bar
		statBarBorderRadius: 6,
		statBarPadding: 6,
		statBarGap: 6,
		statBarBottom: 12,
		statBarRight: 12,

		// Stat slots
		statSlotSize: 54,

		// Art panel
		artSaturation: 80,
		artContrast: 120,
		artBrightness: 90,
		artGradientOpacity: 0.9,

		// Glow effects
		outerGlow1: 'rgba(220, 38, 38, 0.3)',
		outerGlow2: 'rgba(127, 29, 29, 0.2)',

		// Rewards
		rewardBorderColor: '#dc2626',
		rewardIconBorder: '#7f1d1d'
	});

	// State colors
	const stateColors: Record<string, string> = {
		tainted: '#dc2626',
		corrupt: '#991b1b',
		fallen: '#7f1d1d',
		boss: '#450a0a'
	};

	let stateColor = $derived(stateColors[monster.state ?? 'tainted'] ?? '#dc2626');
	let killRewardRow = $derived((monster.resolved_reward_rows ?? []).find(row => row.type === 'all_in_combat' && row.icon_urls?.some(Boolean)));
	let defeatRewardRow = $derived((monster.resolved_reward_rows ?? []).find(row => row.type === 'all_losers' && row.icon_urls?.some(Boolean)));

	// Export theme as JSON
	function exportTheme() {
		const json = JSON.stringify(theme, null, 2);
		navigator.clipboard.writeText(json);
		alert('Theme copied to clipboard!');
	}

	// Reset to defaults
	function resetTheme() {
		location.reload();
	}
</script>

<svelte:head>
	<title>Monster Card Editor | Arc Spirits</title>
</svelte:head>

<div class="editor-page">
	<header class="editor-header">
		<h1>Monster Card Theme Editor</h1>
		<div class="header-actions">
			<button class="btn-export" onclick={exportTheme}>Export Theme</button>
			<button class="btn-reset" onclick={resetTheme}>Reset</button>
		</div>
	</header>

	<div class="editor-layout">
		<!-- Controls Panel -->
		<aside class="controls-panel">
			<!-- Dimensions -->
			<details class="control-section" open>
				<summary>Dimensions</summary>
				<div class="control-group">
					<label>
						<span>Card Width: {theme.cardWidth}px</span>
						<input type="range" bind:value={theme.cardWidth} min="400" max="800" />
					</label>
					<label>
						<span>Card Height: {theme.cardHeight}px</span>
						<input type="range" bind:value={theme.cardHeight} min="300" max="600" />
					</label>
					<label>
						<span>Border Radius: {theme.borderRadius}px</span>
						<input type="range" bind:value={theme.borderRadius} min="0" max="24" />
					</label>
					<label>
						<span>Border Width: {theme.borderWidth}px</span>
						<input type="range" bind:value={theme.borderWidth} min="0" max="8" />
					</label>
				</div>
			</details>

			<!-- Background Colors -->
			<details class="control-section">
				<summary>Background Colors</summary>
				<div class="control-group">
					<label>
						<span>Gradient Start</span>
						<input type="color" bind:value={theme.bgGradient1} />
					</label>
					<label>
						<span>Gradient Middle</span>
						<input type="color" bind:value={theme.bgGradient2} />
					</label>
					<label>
						<span>Gradient End</span>
						<input type="color" bind:value={theme.bgGradient3} />
					</label>
					<label>
						<span>Border Color</span>
						<input type="color" bind:value={theme.borderColor} />
					</label>
				</div>
			</details>

			<!-- Overlay Effects -->
			<details class="control-section">
				<summary>Overlay Effects</summary>
				<div class="control-group">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={theme.veinsEnabled} />
						<span>Enable Veins</span>
					</label>
					<label>
						<span>Veins Opacity: {theme.veinsOpacity}</span>
						<input type="range" bind:value={theme.veinsOpacity} min="0" max="1" step="0.1" />
					</label>
					<label>
						<span>Vein Color</span>
						<input type="color" bind:value={theme.veinColor} />
					</label>
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={theme.slashEnabled} />
						<span>Enable Slash Marks</span>
					</label>
				</div>
			</details>

			<!-- Typography -->
			<details class="control-section">
				<summary>Typography</summary>
				<div class="control-group">
					<label>
						<span>Name Color</span>
						<input type="color" bind:value={theme.nameColor} />
					</label>
					<label>
						<span>Name Size: {theme.nameFontSize}rem</span>
						<input type="range" bind:value={theme.nameFontSize} min="1" max="2.5" step="0.1" />
					</label>
					<label>
						<span>Effect Name Color</span>
						<input type="color" bind:value={theme.effectNameColor} />
					</label>
					<label>
						<span>Effect Desc Color</span>
						<input type="color" bind:value={theme.effectDescColor} />
					</label>
					<label>
						<span>Footer Color</span>
						<input type="color" bind:value={theme.footerColor} />
					</label>
				</div>
			</details>

			<!-- Floating Stat Bar -->
			<details class="control-section">
				<summary>Floating Stat Bar</summary>
				<div class="control-group">
					<label>
						<span>Bar Border Radius: {theme.statBarBorderRadius}px</span>
						<input type="range" bind:value={theme.statBarBorderRadius} min="0" max="16" />
					</label>
					<label>
						<span>Bar Padding: {theme.statBarPadding}px</span>
						<input type="range" bind:value={theme.statBarPadding} min="4" max="16" />
					</label>
					<label>
						<span>Slot Gap: {theme.statBarGap}px</span>
						<input type="range" bind:value={theme.statBarGap} min="0" max="16" />
					</label>
					<label>
						<span>Bottom Offset: {theme.statBarBottom}px</span>
						<input type="range" bind:value={theme.statBarBottom} min="0" max="40" />
					</label>
					<label>
						<span>Right Offset: {theme.statBarRight}px</span>
						<input type="range" bind:value={theme.statBarRight} min="0" max="40" />
					</label>
					<label>
						<span>Stat Slot Size: {theme.statSlotSize}px</span>
						<input type="range" bind:value={theme.statSlotSize} min="40" max="70" />
					</label>
				</div>
			</details>

			<!-- Art Panel -->
			<details class="control-section">
				<summary>Art Panel</summary>
				<div class="control-group">
					<label>
						<span>Saturation: {theme.artSaturation}%</span>
						<input type="range" bind:value={theme.artSaturation} min="0" max="200" />
					</label>
					<label>
						<span>Contrast: {theme.artContrast}%</span>
						<input type="range" bind:value={theme.artContrast} min="50" max="200" />
					</label>
					<label>
						<span>Brightness: {theme.artBrightness}%</span>
						<input type="range" bind:value={theme.artBrightness} min="50" max="150" />
					</label>
					<label>
						<span>Gradient Opacity: {theme.artGradientOpacity}</span>
						<input type="range" bind:value={theme.artGradientOpacity} min="0" max="1" step="0.1" />
					</label>
				</div>
			</details>

			<!-- Glow Effects -->
			<details class="control-section">
				<summary>Glow & Borders</summary>
				<div class="control-group">
					<label>
						<span>Divider Color</span>
						<input type="color" bind:value={theme.dividerColor} />
					</label>
					<label>
						<span>Effects Border</span>
						<input type="color" bind:value={theme.effectsBorderColor} />
					</label>
					<label>
						<span>Reward Border</span>
						<input type="color" bind:value={theme.rewardBorderColor} />
					</label>
				</div>
			</details>

			<!-- Reward Rows -->
			<details class="control-section">
				<summary>Reward Rows</summary>
				<div class="control-group">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={showKillReward} />
						<span>Show "On kill" reward</span>
					</label>
					<label>
						<span>Kill reward icons: {killRewardIconCount}</span>
						<input type="range" bind:value={killRewardIconCount} min="1" max="5" />
					</label>
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={showDefeatReward} />
						<span>Show "On defeat" reward</span>
					</label>
					<label>
						<span>Defeat reward icons: {defeatRewardIconCount}</span>
						<input type="range" bind:value={defeatRewardIconCount} min="1" max="5" />
					</label>
				</div>
			</details>

			<!-- Invade Location -->
			<details class="control-section">
				<summary>Invade Location</summary>
				<div class="control-group">
					<label>
						<span>Location Name</span>
						<input type="text" bind:value={invadeLocationName} placeholder="e.g. Dark Forest" class="text-input" />
					</label>
				</div>
			</details>
		</aside>

		<!-- Preview Panel -->
		<main class="preview-panel">
			<div class="preview-container">
				<div
					class="blood-card"
					style="
						--card-width: {theme.cardWidth}px;
						--card-height: {theme.cardHeight}px;
						--border-radius: {theme.borderRadius}px;
						--border-width: {theme.borderWidth}px;
						--bg-gradient-1: {theme.bgGradient1};
						--bg-gradient-2: {theme.bgGradient2};
						--bg-gradient-3: {theme.bgGradient3};
						--border-color: {theme.borderColor};
						--veins-opacity: {theme.veinsOpacity};
						--vein-color: {theme.veinColor};
						--name-color: {theme.nameColor};
						--name-font-size: {theme.nameFontSize}rem;
						--effect-name-color: {theme.effectNameColor};
						--effect-desc-color: {theme.effectDescColor};
						--footer-color: {theme.footerColor};
						--badge-slash-color: {theme.badgeSlashColor};
						--divider-color: {theme.dividerColor};
						--effects-border-color: {theme.effectsBorderColor};
						--effects-bullet-color: {theme.effectsBulletColor};
						--stat-bar-border-radius: {theme.statBarBorderRadius}px;
						--stat-bar-padding: {theme.statBarPadding}px;
						--stat-bar-gap: {theme.statBarGap}px;
						--stat-bar-bottom: {theme.statBarBottom}px;
						--stat-bar-right: {theme.statBarRight}px;
						--stat-slot-size: {theme.statSlotSize}px;
						--art-saturation: {theme.artSaturation}%;
						--art-contrast: {theme.artContrast}%;
						--art-brightness: {theme.artBrightness}%;
						--art-gradient-opacity: {theme.artGradientOpacity};
						--reward-border-color: {theme.rewardBorderColor};
						--reward-icon-border: {theme.rewardIconBorder};
						--state-color: {stateColor};
					"
				>
					<!-- Vein Pattern Overlay -->
					{#if theme.veinsEnabled}
						<div class="vein-overlay"></div>
					{/if}

					<!-- Main Content Area -->
					<div class="main-area">
						{#if theme.slashEnabled}
							<div class="slash-marks"></div>
						{/if}

						<div class="content-zone">
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

							{#if monster.effects && monster.effects.length > 0}
								<div class="effects-section">
									{#each monster.effects.slice(0, 2) as effect (effect.name)}
										<div class="effect-item">
											<span class="effect-bullet"></span>
											<span class="effect-name">{effect.name}:</span>
											<span class="effect-desc">{effect.description}</span>
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

							<div class="card-footer">
								<span class="footer-label">Arc Spirits // Monster</span>
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
								<span class="stat-label">DMG</span>
							</div>
							<div class="stat-slot barrier">
								<span class="stat-value">{monster.barrier ?? 0}</span>
								<span class="stat-label">BAR</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</main>
	</div>
</div>

<style>
	.editor-page {
		min-height: 100vh;
		background: #0a0a0f;
		color: #e2e8f0;
	}

	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 24px;
		background: #111118;
		border-bottom: 1px solid #2a2a35;
	}

	.editor-header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
	}

	.header-actions {
		display: flex;
		gap: 12px;
	}

	.btn-export, .btn-reset {
		padding: 8px 16px;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		border: none;
	}

	.btn-export {
		background: #dc2626;
		color: white;
	}

	.btn-reset {
		background: #374151;
		color: #e2e8f0;
	}

	.editor-layout {
		display: grid;
		grid-template-columns: 320px 1fr;
		height: calc(100vh - 65px);
	}

	.controls-panel {
		background: #111118;
		border-right: 1px solid #2a2a35;
		overflow-y: auto;
		padding: 16px;
	}

	.control-section {
		margin-bottom: 8px;
		border: 1px solid #2a2a35;
		border-radius: 8px;
		overflow: hidden;
	}

	.control-section summary {
		padding: 12px 16px;
		background: #1a1a22;
		cursor: pointer;
		font-weight: 600;
		font-size: 0.875rem;
		user-select: none;
	}

	.control-section summary:hover {
		background: #222230;
	}

	.control-group {
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.control-group label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.control-group label span {
		display: flex;
		justify-content: space-between;
	}

	.control-group input[type="range"] {
		width: 100%;
		height: 6px;
		background: #2a2a35;
		border-radius: 3px;
		cursor: pointer;
		accent-color: #dc2626;
	}

	.control-group input[type="color"] {
		width: 100%;
		height: 32px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		background: #2a2a35;
	}

	.checkbox-label {
		flex-direction: row !important;
		align-items: center;
		gap: 8px !important;
	}

	.checkbox-label input[type="checkbox"] {
		width: 16px;
		height: 16px;
		accent-color: #dc2626;
	}

	.text-input {
		width: 100%;
		padding: 8px 12px;
		background: #2a2a35;
		border: 1px solid #3a3a45;
		border-radius: 4px;
		color: #e2e8f0;
		font-size: 0.875rem;
	}

	.text-input:focus {
		outline: none;
		border-color: #dc2626;
	}

	.preview-panel {
		display: flex;
		align-items: center;
		justify-content: center;
		background: #0a0a0f;
		overflow: auto;
		padding: 40px;
	}

	.preview-container {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Card Styles */
	.blood-card {
		width: var(--card-width);
		height: var(--card-height);
		font-family: 'Opsilon', serif;
		position: relative;
		display: grid;
		grid-template-columns: 1.2fr 0.8fr;
		background: linear-gradient(135deg, var(--bg-gradient-1) 0%, var(--bg-gradient-2) 50%, var(--bg-gradient-3) 100%);
		border-radius: var(--border-radius);
		overflow: hidden;
		box-shadow:
			0 4px 24px rgba(220, 38, 38, 0.3),
			0 0 60px rgba(127, 29, 29, 0.2),
			inset 0 0 100px rgba(0, 0, 0, 0.5);
		border: var(--border-width) solid var(--border-color);
	}

	.vein-overlay {
		position: absolute;
		inset: 0;
		background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10,50 Q30,20 50,50 T90,50' stroke='%23450a0a' stroke-width='1' fill='none' opacity='0.3'/%3E%3Cpath d='M20,30 Q40,60 60,30 T100,30' stroke='%23450a0a' stroke-width='0.5' fill='none' opacity='0.2'/%3E%3C/svg%3E");
		pointer-events: none;
		opacity: var(--veins-opacity);
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
		font-size: var(--name-font-size);
		font-weight: 800;
		color: var(--name-color);
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
		border-left: 3px solid var(--effects-border-color);
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
		background: var(--effects-bullet-color);
		transform: rotate(45deg);
		flex-shrink: 0;
		margin-top: 5px;
	}

	.effect-name {
		font-weight: 700;
		color: var(--effect-name-color);
	}

	.effect-desc {
		color: var(--effect-desc-color);
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
		color: var(--footer-color);
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
		filter: saturate(var(--art-saturation)) contrast(var(--art-contrast)) brightness(var(--art-brightness));
	}

	.no-art {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, #1a0505, #0d0202);
	}

	.art-gradient {
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, rgba(26, 5, 5, var(--art-gradient-opacity)) 0%, rgba(45, 10, 10, 0.4) 30%, transparent 60%);
		pointer-events: none;
	}

	/* Floating Stat Bar */
	.floating-stat-bar {
		position: absolute;
		bottom: var(--stat-bar-bottom);
		right: var(--stat-bar-right);
		display: flex;
		gap: var(--stat-bar-gap);
		padding: var(--stat-bar-padding);
		background: linear-gradient(135deg, rgba(20, 8, 8, 0.92) 0%, rgba(15, 5, 5, 0.95) 100%);
		border: 1px solid rgba(120, 40, 40, 0.6);
		border-radius: var(--stat-bar-border-radius);
		backdrop-filter: blur(6px);
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
		z-index: 10;
	}

	.stat-slot {
		width: var(--stat-slot-size);
		height: var(--stat-slot-size);
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid rgba(100, 30, 30, 0.7);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		position: relative;
		border-radius: 4px;
	}

	.stat-slot.damage {
		background: linear-gradient(135deg, rgba(80, 20, 20, 0.6), rgba(20, 5, 5, 0.7));
		border-color: rgba(140, 50, 50, 0.7);
	}

	.stat-slot.barrier {
		background: linear-gradient(135deg, rgba(60, 25, 25, 0.5), rgba(20, 5, 5, 0.7));
		border-color: rgba(100, 40, 40, 0.6);
	}

	.stat-label {
		font-size: 0.5rem;
		font-weight: 600;
		color: rgba(180, 140, 140, 0.8);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.stat-value {
		font-size: 1.3rem;
		font-weight: 800;
		color: rgba(240, 220, 220, 0.95);
		line-height: 1;
	}
</style>
