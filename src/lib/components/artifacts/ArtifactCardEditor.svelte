<script lang="ts">
	/**
	 * Live editor for artifact card layout positioning
	 * Adjust rune positions, sizes, and other layout parameters with sliders
	 */

	interface Props {
		isOpen: boolean;
	}

	let { isOpen = $bindable(false) }: Props = $props();

	// Layout parameters with defaults matching V17
	let params = $state({
		// Sidebar
		sidebarWidth: 55,

		// Rune stack
		runeStackMarginLeft: -30,
		runeStackTop: 16,
		runeSize: 48,
		runeGap: 6,
		runeOffsetPerIndex: -14,

		// Card dimensions
		cardWidth: 300,
		cardHeight: 225,

		// Content area
		contentPadding: 16,
		contentPaddingRight: 75,

		// Title
		titleFontSize: 18,
		titleMarginBottom: 8,
		sigilSize: 16,
		sigilGap: 8,

		// Divider
		dividerWidth: 80,
		dividerHeight: 2,
		dividerSkew: -20,
		dividerMarginBottom: 10,

		// Benefit text
		benefitFontSize: 11,
		benefitLineHeight: 1.5,

		// Bottom info
		bottomInfoFontSize: 9,
		bottomInfoPaddingTop: 8,
	});

	// Sample data for preview
	const sampleArtifact = {
		name: 'Crystal Memory',
		benefit: 'Gain 2 Water runes at the start of each turn. These runes persist until used.'
	};

	const sampleRecipeIcons = [
		'https://placehold.co/48x48/3b82f6/white?text=1',
		'https://placehold.co/48x48/8b5cf6/white?text=2',
		'https://placehold.co/48x48/ec4899/white?text=3',
		'https://placehold.co/48x48/f59e0b/white?text=4',
	];

	function close() {
		isOpen = false;
	}

	function resetToDefaults() {
		params = {
			sidebarWidth: 55,
			runeStackMarginLeft: -30,
			runeStackTop: 16,
			runeSize: 48,
			runeGap: 6,
			runeOffsetPerIndex: -14,
			cardWidth: 300,
			cardHeight: 225,
			contentPadding: 16,
			contentPaddingRight: 75,
			titleFontSize: 18,
			titleMarginBottom: 8,
			sigilSize: 16,
			sigilGap: 8,
			dividerWidth: 80,
			dividerHeight: 2,
			dividerSkew: -20,
			dividerMarginBottom: 10,
			benefitFontSize: 11,
			benefitLineHeight: 1.5,
			bottomInfoFontSize: 9,
			bottomInfoPaddingTop: 8,
		};
	}

	function copyCSS() {
		const css = `/* Content Area */
.main-area {
	padding: ${params.contentPadding}px;
	padding-right: ${params.contentPaddingRight}px;
}

/* Header */
.header-row {
	gap: ${params.sigilGap}px;
	margin-bottom: ${params.titleMarginBottom}px;
}

.sigil {
	font-size: ${params.sigilSize}px;
}

.artifact-name {
	font-size: ${params.titleFontSize}px;
}

/* Divider */
.slant-divider {
	width: ${params.dividerWidth}%;
	height: ${params.dividerHeight}px;
	transform: skewX(${params.dividerSkew}deg);
	margin-bottom: ${params.dividerMarginBottom}px;
}

/* Benefit */
.benefit {
	font-size: ${params.benefitFontSize}px;
	line-height: ${params.benefitLineHeight};
}

/* Bottom Info */
.bottom-info {
	font-size: ${params.bottomInfoFontSize}px;
	padding-top: ${params.bottomInfoPaddingTop}px;
}

/* Sidebar */
.diagonal-sidebar {
	width: ${params.sidebarWidth}px;
}

/* Rune Stack */
.rune-stack {
	margin-left: ${params.runeStackMarginLeft}px;
	margin-top: ${params.runeStackTop}px;
	gap: ${params.runeGap}px;
}

.rune-slot {
	width: ${params.runeSize}px;
	height: ${params.runeSize}px;
	transform: translateX(calc(var(--index) * ${params.runeOffsetPerIndex}px));
}`;
		navigator.clipboard.writeText(css);
		alert('CSS copied to clipboard!');
	}
</script>

{#if isOpen}
	<div class="editor-backdrop" role="dialog">
		<div class="editor-panel">
			<div class="editor-header">
				<h2>Artifact Card Layout Editor</h2>
				<div class="header-actions">
					<button class="btn secondary" onclick={resetToDefaults}>Reset</button>
					<button class="btn secondary" onclick={copyCSS}>Copy CSS</button>
					<button class="close-btn" onclick={close}>&times;</button>
				</div>
			</div>

			<div class="editor-content">
				<!-- Preview -->
				<div class="preview-section">
					<h3>Live Preview</h3>
					<div class="preview-wrapper">
						<div
							class="card-preview"
							style="
								width: {params.cardWidth}px;
								height: {params.cardHeight}px;
							"
						>
							<div class="main-area" style="padding: {params.contentPadding}px; padding-right: {params.contentPaddingRight}px;">
								<div class="content-zone">
									<div class="header-row" style="gap: {params.sigilGap}px; margin-bottom: {params.titleMarginBottom}px;">
										<span class="sigil" style="font-size: {params.sigilSize}px;">◆</span>
										<h2 class="artifact-name" style="font-size: {params.titleFontSize}px;">{sampleArtifact.name}</h2>
									</div>
									<div
										class="slant-divider"
										style="
											width: {params.dividerWidth}%;
											height: {params.dividerHeight}px;
											transform: skewX({params.dividerSkew}deg);
											margin-bottom: {params.dividerMarginBottom}px;
										"
									></div>
									<p class="benefit" style="font-size: {params.benefitFontSize}px; line-height: {params.benefitLineHeight};">{sampleArtifact.benefit}</p>
									<div class="bottom-info" style="font-size: {params.bottomInfoFontSize}px; padding-top: {params.bottomInfoPaddingTop}px;">
										<span class="guardian">⚔ Aurelia</span>
										<span class="tags">Memory • Water</span>
									</div>
								</div>
							</div>

							<div
								class="diagonal-sidebar"
								style="
									width: {params.sidebarWidth}px;
								"
							>
								<div class="sidebar-bg"></div>
								<div
									class="rune-stack"
									style="
										margin-left: {params.runeStackMarginLeft}px;
										margin-top: {params.runeStackTop}px;
										gap: {params.runeGap}px;
									"
								>
									{#each sampleRecipeIcons as icon, i}
										<div
											class="rune-slot"
											style="
												width: {params.runeSize}px;
												height: {params.runeSize}px;
												transform: translateX({i * params.runeOffsetPerIndex}px);
											"
										>
											<img src={icon} alt="rune {i + 1}" class="rune-icon" />
										</div>
									{/each}
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Controls -->
				<div class="controls-section">
					<h3>Position Controls</h3>

					<div class="controls-scroll">
						<div class="control-group">
							<h4>Content Area</h4>

							<label class="slider-control">
								<span class="label-text">Padding</span>
								<span class="value">{params.contentPadding}px</span>
								<input type="range" min="4" max="32" bind:value={params.contentPadding} />
							</label>

							<label class="slider-control">
								<span class="label-text">Padding Right</span>
								<span class="value">{params.contentPaddingRight}px</span>
								<input type="range" min="40" max="120" bind:value={params.contentPaddingRight} />
							</label>
						</div>

						<div class="control-group">
							<h4>Title</h4>

							<label class="slider-control">
								<span class="label-text">Font Size</span>
								<span class="value">{params.titleFontSize}px</span>
								<input type="range" min="12" max="28" bind:value={params.titleFontSize} />
							</label>

							<label class="slider-control">
								<span class="label-text">Margin Bottom</span>
								<span class="value">{params.titleMarginBottom}px</span>
								<input type="range" min="0" max="20" bind:value={params.titleMarginBottom} />
							</label>

							<label class="slider-control">
								<span class="label-text">Sigil Size</span>
								<span class="value">{params.sigilSize}px</span>
								<input type="range" min="10" max="24" bind:value={params.sigilSize} />
							</label>

							<label class="slider-control">
								<span class="label-text">Sigil Gap</span>
								<span class="value">{params.sigilGap}px</span>
								<input type="range" min="2" max="16" bind:value={params.sigilGap} />
							</label>
						</div>

						<div class="control-group">
							<h4>Divider</h4>

							<label class="slider-control">
								<span class="label-text">Width</span>
								<span class="value">{params.dividerWidth}%</span>
								<input type="range" min="20" max="100" bind:value={params.dividerWidth} />
							</label>

							<label class="slider-control">
								<span class="label-text">Height</span>
								<span class="value">{params.dividerHeight}px</span>
								<input type="range" min="1" max="6" bind:value={params.dividerHeight} />
							</label>

							<label class="slider-control">
								<span class="label-text">Skew</span>
								<span class="value">{params.dividerSkew}°</span>
								<input type="range" min="-45" max="45" bind:value={params.dividerSkew} />
							</label>

							<label class="slider-control">
								<span class="label-text">Margin Bottom</span>
								<span class="value">{params.dividerMarginBottom}px</span>
								<input type="range" min="0" max="24" bind:value={params.dividerMarginBottom} />
							</label>
						</div>

						<div class="control-group">
							<h4>Benefit Text</h4>

							<label class="slider-control">
								<span class="label-text">Font Size</span>
								<span class="value">{params.benefitFontSize}px</span>
								<input type="range" min="8" max="16" bind:value={params.benefitFontSize} />
							</label>

							<label class="slider-control">
								<span class="label-text">Line Height</span>
								<span class="value">{params.benefitLineHeight}</span>
								<input type="range" min="1" max="2" step="0.1" bind:value={params.benefitLineHeight} />
							</label>
						</div>

						<div class="control-group">
							<h4>Bottom Info</h4>

							<label class="slider-control">
								<span class="label-text">Font Size</span>
								<span class="value">{params.bottomInfoFontSize}px</span>
								<input type="range" min="6" max="14" bind:value={params.bottomInfoFontSize} />
							</label>

							<label class="slider-control">
								<span class="label-text">Padding Top</span>
								<span class="value">{params.bottomInfoPaddingTop}px</span>
								<input type="range" min="0" max="20" bind:value={params.bottomInfoPaddingTop} />
							</label>
						</div>

						<div class="control-group">
							<h4>Sidebar</h4>

							<label class="slider-control">
								<span class="label-text">Width</span>
								<span class="value">{params.sidebarWidth}px</span>
								<input type="range" min="40" max="100" bind:value={params.sidebarWidth} />
							</label>
						</div>

						<div class="control-group">
							<h4>Rune Stack</h4>

							<label class="slider-control">
								<span class="label-text">Top Offset</span>
								<span class="value">{params.runeStackTop}px</span>
								<input type="range" min="0" max="80" bind:value={params.runeStackTop} />
							</label>

							<label class="slider-control">
								<span class="label-text">Left Position</span>
								<span class="value">{params.runeStackMarginLeft}px</span>
								<input type="range" min="-100" max="50" bind:value={params.runeStackMarginLeft} />
							</label>

							<label class="slider-control">
								<span class="label-text">Offset Per Rune</span>
								<span class="value">{params.runeOffsetPerIndex}px</span>
								<input type="range" min="-30" max="30" bind:value={params.runeOffsetPerIndex} />
							</label>

							<label class="slider-control">
								<span class="label-text">Rune Size</span>
								<span class="value">{params.runeSize}px</span>
								<input type="range" min="24" max="72" bind:value={params.runeSize} />
							</label>

							<label class="slider-control">
								<span class="label-text">Rune Gap</span>
								<span class="value">{params.runeGap}px</span>
								<input type="range" min="0" max="20" bind:value={params.runeGap} />
							</label>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.editor-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.8);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.editor-panel {
		background: #0f172a;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 12px;
		width: 100%;
		max-width: 900px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.editor-header {
		padding: 1rem 1.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: rgba(15, 23, 42, 0.8);
	}

	.editor-header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: #f8fafc;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.btn {
		padding: 0.5rem 1rem;
		border-radius: 6px;
		font-size: 0.85rem;
		cursor: pointer;
		border: none;
	}

	.btn.secondary {
		background: rgba(148, 163, 184, 0.2);
		color: #f8fafc;
	}

	.btn.secondary:hover {
		background: rgba(148, 163, 184, 0.3);
	}

	.close-btn {
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
	}

	.close-btn:hover {
		color: #f8fafc;
	}

	.editor-content {
		display: grid;
		grid-template-columns: 1fr 280px;
		gap: 1.5rem;
		padding: 1.5rem;
		overflow-y: auto;
	}

	.preview-section h3,
	.controls-section h3 {
		margin: 0 0 1rem;
		font-size: 0.9rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.preview-wrapper {
		background: rgba(30, 41, 59, 0.5);
		border-radius: 8px;
		padding: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 300px;
	}

	/* Card Preview Styles (inline version of V17) */
	.card-preview {
		font-family: 'Opsilon', serif;
		position: relative;
		display: flex;
		background: #1a1520;
		border-radius: 6px;
		overflow: hidden;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
	}

	.main-area {
		flex: 1;
		position: relative;
		display: flex;
		flex-direction: column;
		clip-path: polygon(0 0, 100% 0, 80% 100%, 0 100%);
		background: linear-gradient(135deg, #2a2035 0%, #1a1520 100%);
	}

	.content-zone {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.header-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.sigil {
		font-size: 16px;
		color: #c4a060;
		text-shadow: 0 0 8px rgba(196, 160, 96, 0.5);
	}

	.artifact-name {
		font-size: 18px;
		font-weight: 700;
		color: #e8d4b8;
		margin: 0;
	}

	.slant-divider {
		width: 80%;
		height: 2px;
		background: linear-gradient(90deg, #c4a060 0%, transparent 100%);
		transform: skewX(-20deg);
		margin-bottom: 10px;
	}

	.benefit {
		font-size: 11px;
		color: #a8a0b0;
		line-height: 1.5;
		margin: 0;
		flex: 1;
	}

	.bottom-info {
		display: flex;
		justify-content: space-between;
		font-size: 9px;
		color: #908898;
		padding-top: 8px;
		border-top: 1px solid rgba(180, 140, 100, 0.2);
	}

	.guardian {
		font-weight: 600;
		color: #c4a060;
	}

	.diagonal-sidebar {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		z-index: 2;
	}

	.sidebar-bg {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, #3a2a40 0%, #2a1a30 100%);
		clip-path: polygon(30% 0, 100% 0, 100% 100%, 0% 100%);
		border-left: 2px solid #c4a060;
		transform: skewX(-8deg);
		transform-origin: bottom;
	}

	.rune-stack {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
	}

	.rune-slot {
		background: rgba(0, 0, 0, 0.4);
		border: 2px solid rgba(196, 160, 96, 0.6);
		border-radius: 50%;
		padding: 2px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	/* Controls */
	.controls-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 280px;
	}

	.controls-scroll {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-height: 500px;
		overflow-y: auto;
		padding-right: 0.5rem;
	}

	.control-group {
		background: rgba(30, 41, 59, 0.5);
		border-radius: 8px;
		padding: 1rem;
	}

	.control-group h4 {
		margin: 0 0 0.75rem;
		font-size: 0.8rem;
		color: #cbd5e1;
		font-weight: 600;
	}

	.slider-control {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-rows: auto auto;
		gap: 0.25rem 0.5rem;
		margin-bottom: 0.75rem;
	}

	.slider-control:last-child {
		margin-bottom: 0;
	}

	.label-text {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.value {
		font-size: 0.75rem;
		color: #60a5fa;
		font-weight: 600;
		text-align: right;
	}

	.slider-control input[type="range"] {
		grid-column: 1 / -1;
		width: 100%;
		height: 6px;
		border-radius: 3px;
		background: rgba(148, 163, 184, 0.2);
		outline: none;
		-webkit-appearance: none;
	}

	.slider-control input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
	}

	.slider-control input[type="range"]::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
		border: none;
	}

	@media (max-width: 768px) {
		.editor-content {
			grid-template-columns: 1fr;
		}
	}
</style>
