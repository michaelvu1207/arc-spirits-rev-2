<script lang="ts">
	import type { DiceInfo } from '$lib/features/curve-fitting/types';
	import type { ClassTargets } from '$lib/features/alternative-dice/types';
	import {
		optimizeGlobally,
		formatUnlockLevel,
		type GlobalOptimizationResult
	} from '$lib/features/alternative-dice/globalOptimizer';

	let { data }: { data: { dice: DiceInfo[]; classTargets: ClassTargets[] } } = $props();

	// Configuration
	let maxDice = $state(10);
	let iterations = $state(20);
	let variancePenalty = $state(2.0); // Higher = prefer more dice (lower variance)

	// Results
	let result = $state<GlobalOptimizationResult | null>(null);

	function runOptimization() {
		result = optimizeGlobally(data.classTargets, {
			numFaces: 6,
			maxDice,
			iterations,
			variancePenalty
		});
	}

	function copyResultsJSON() {
		if (!result) return;
		const json = JSON.stringify(result, null, 2);
		navigator.clipboard.writeText(json);
		alert('Results copied to clipboard!');
	}

	// Chart dimensions
	const chartWidth = 700;
	const chartHeight = 320;
	const chartPadding = { top: 20, right: 30, bottom: 40, left: 50 };
	let innerWidth = $derived(chartWidth - chartPadding.left - chartPadding.right);
	let innerHeight = $derived(chartHeight - chartPadding.top - chartPadding.bottom);

	const traitRange: [number, number] = [2, 9];

	function xScale(trait: number) {
		const [min, max] = traitRange;
		return chartPadding.left + ((trait - min) / (max - min)) * innerWidth;
	}

	let yMax = $derived(() => {
		if (!result) return 8;
		let max = 1;
		for (const cls of result.classes) {
			for (const t of cls.traits) {
				if (t.targetEV > max) max = t.targetEV;
				if (t.actualEV > max) max = t.actualEV;
			}
		}
		return Math.ceil(max * 1.1);
	});

	function yScale(value: number) {
		return chartPadding.top + innerHeight - (value / yMax()) * innerHeight;
	}

	function buildPath(points: { x: number; y: number }[]): string {
		if (points.length === 0) return '';
		return `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`;
	}
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Alternative Dice Experiment</h1>
			<p>
				Unified 6-sided attack die optimized across all classes.
				<strong>Experimental - no database changes.</strong>
			</p>
		</div>
	</header>

	<div class="concept-box">
		<h3>Concept</h3>
		<p>
			<strong>Goal:</strong> Replace Basic, Critical, Exalted, Arcane dice with a single unified die.
			Each face has a value. At lower traits, only some faces are "active" (others count as 0).
			As traits increase, more faces unlock.
		</p>
		<p>
			<strong>Optimization:</strong> Finds optimal face values, dice counts per trait, and unlock
			levels that best match the original system's expected values across all three classes.
		</p>
	</div>

	<div class="controls-row">
		<label>
			<span>Max Dice per Trait</span>
			<input type="number" bind:value={maxDice} min="1" max="10" />
		</label>
		<label>
			<span>Optimization Iterations</span>
			<input type="number" bind:value={iterations} min="5" max="50" />
		</label>
		<label class="variance-control">
			<span>Variance Penalty <span class="hint">(higher = more dice)</span></span>
			<div class="slider-row">
				<input type="range" bind:value={variancePenalty} min="0" max="5" step="0.5" />
				<span class="slider-value">{variancePenalty.toFixed(1)}</span>
			</div>
		</label>
		<button class="btn btn--primary" onclick={runOptimization}>
			Optimize Unified Die
		</button>
	</div>

	{#if result}
		<div class="results-grid">
			<!-- Die Design -->
			<div class="result-card die-card">
				<h3>Unified Die Design</h3>
				<div class="die-visual">
					{#each result.die.faces as face, i}
						<div class="die-face">
							<span class="face-number">Face {i + 1}</span>
							<span class="face-value">{face.value}</span>
						</div>
					{/each}
				</div>
				<div class="die-stats">
					<span>Total Error: <strong>{result.totalError.toFixed(3)}</strong></span>
					<span>MSE: <strong>{result.meanSquaredError.toFixed(4)}</strong></span>
				</div>
				<p class="die-hint">
					Face values are optimized to be non-decreasing. Lower faces unlock first.
				</p>
			</div>

			<!-- Chart -->
			<div class="result-card chart-card">
				<h3>EV Comparison (All Classes)</h3>
				<svg viewBox="0 0 {chartWidth} {chartHeight}" class="chart">
					<!-- Grid -->
					{#each Array.from({ length: 6 }, (_, i) => i) as i}
						<line
							x1={chartPadding.left}
							y1={chartPadding.top + (i * innerHeight) / 5}
							x2={chartPadding.left + innerWidth}
							y2={chartPadding.top + (i * innerHeight) / 5}
							stroke="rgba(148, 163, 184, 0.2)"
						/>
					{/each}

					<!-- Y-axis labels -->
					{#each Array.from({ length: 6 }, (_, i) => i) as i}
						<text
							x={chartPadding.left - 10}
							y={chartPadding.top + (i * innerHeight) / 5 + 4}
							text-anchor="end"
							fill="#94a3b8"
							font-size="11"
						>
							{((5 - i) / 5 * yMax()).toFixed(1)}
						</text>
					{/each}

					<!-- X-axis labels -->
					{#each Array.from({ length: 8 }, (_, i) => i + 2) as trait}
						<text
							x={xScale(trait)}
							y={chartHeight - 10}
							text-anchor="middle"
							fill="#94a3b8"
							font-size="11"
						>
							{trait}
						</text>
					{/each}

					<!-- Draw each class -->
					{#each result.classes as cls}
						<!-- Target curve (dashed) -->
						<path
							d={buildPath(cls.traits.map((t) => ({ x: xScale(t.trait), y: yScale(t.targetEV) })))}
							fill="none"
							stroke={cls.color}
							stroke-width="1.5"
							stroke-dasharray="4,4"
							opacity="0.5"
						/>
						<!-- Actual curve (solid) -->
						<path
							d={buildPath(cls.traits.map((t) => ({ x: xScale(t.trait), y: yScale(t.actualEV) })))}
							fill="none"
							stroke={cls.color}
							stroke-width="2.5"
						/>
						<!-- Points -->
						{#each cls.traits as t}
							<circle
								cx={xScale(t.trait)}
								cy={yScale(t.actualEV)}
								r="5"
								fill={cls.color}
								stroke="#1e293b"
								stroke-width="2"
							/>
						{/each}
					{/each}
				</svg>

				<div class="chart-legend">
					{#each result.classes as cls}
						<span class="legend-item">
							<span class="legend-dot" style="background: {cls.color}"></span>
							{cls.name}
						</span>
					{/each}
					<span class="legend-item">
						<span class="legend-line dashed"></span>
						Target
					</span>
				</div>
			</div>
		</div>

		<!-- Class Breakpoint Tables -->
		<div class="class-tables">
			{#each result.classes as cls}
				<div class="class-table-card" style="--class-color: {cls.color}">
					<div class="class-header">
						<h3>{cls.name}</h3>
						<span class="class-error">Error: {cls.totalError.toFixed(3)}</span>
					</div>
					<table class="breakpoint-table">
						<thead>
							<tr>
								<th>Trait</th>
								<th>Tier</th>
								<th>Dice</th>
								<th>Unlocked</th>
								<th>Target</th>
								<th>Actual</th>
								<th>Error</th>
							</tr>
						</thead>
						<tbody>
							{#each cls.traits as t}
								<tr class="tier-{t.color}">
									<td class="trait-cell">{t.trait}</td>
									<td class="tier-cell">
										<span class="tier-badge tier-{t.color}">{t.color}</span>
									</td>
									<td class="dice-cell">{t.diceCount}d6</td>
									<td class="unlock-cell">
										<span class="unlock-badge">{formatUnlockLevel(t.unlockedFaces)}</span>
									</td>
									<td>{t.targetEV.toFixed(2)}</td>
									<td>{t.actualEV.toFixed(2)}</td>
									<td class:high-error={t.error > 0.3}>{t.error.toFixed(3)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/each}
		</div>

		<!-- Summary -->
		<div class="summary-card">
			<h3>How It Works</h3>
			<div class="summary-content">
				<div class="summary-section">
					<h4>Die Mechanics</h4>
					<ul>
						<li>Roll the number of dice shown in the "Dice" column</li>
						<li>"Unlocked" shows how many faces are active at that trait</li>
						<li>Locked faces (beyond the unlocked count) count as 0</li>
						<li>EV = (sum of unlocked face values) / 6 × dice count</li>
					</ul>
				</div>
				<div class="summary-section">
					<h4>Face Unlock Progression</h4>
					<div class="unlock-example">
						{#each [2, 3, 4, 5, 6] as unlocked}
							<div class="unlock-row">
								<span class="unlock-label">{unlocked}/6:</span>
								<span class="unlock-faces">
									{#each result.die.faces as face, i}
										<span class="mini-face" class:locked={i >= unlocked}>
											{i < unlocked ? face.value : '—'}
										</span>
									{/each}
								</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<div class="actions">
			<button class="btn" onclick={copyResultsJSON}>Copy Full Results JSON</button>
		</div>
	{:else}
		<div class="no-results">
			<p>Click "Optimize Unified Die" to find optimal face values and configurations.</p>
			<p class="hint">
				The optimizer will find face values, dice counts, and unlock levels that best match
				the original multi-dice system across all three classes.
			</p>
		</div>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.concept-box {
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.3);
		border-radius: 12px;
		padding: 1rem;
	}

	.concept-box h3 {
		margin: 0 0 0.5rem;
		color: #60a5fa;
		font-size: 1rem;
	}

	.concept-box p {
		margin: 0.3rem 0;
		font-size: 0.85rem;
		color: #cbd5f5;
	}

	.controls-row {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
		flex-wrap: wrap;
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 1rem;
	}

	.controls-row label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.controls-row label span {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.controls-row input[type='number'] {
		padding: 0.4rem 0.6rem;
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 6px;
		color: #f8fafc;
		width: 80px;
	}

	.variance-control {
		min-width: 160px;
	}

	.variance-control .hint {
		font-size: 0.65rem;
		color: #64748b;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.slider-row input[type='range'] {
		flex: 1;
		height: 6px;
		background: rgba(30, 41, 59, 0.8);
		border-radius: 3px;
		cursor: pointer;
	}

	.slider-value {
		min-width: 32px;
		font-size: 0.85rem;
		color: #60a5fa;
		font-weight: 500;
	}

	.btn {
		padding: 0.5rem 1rem;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 8px;
		color: #f8fafc;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn:hover {
		background: rgba(59, 130, 246, 0.2);
		border-color: rgba(59, 130, 246, 0.4);
	}

	.btn--primary {
		background: linear-gradient(135deg, #3b82f6, #8b5cf6);
		border: none;
		padding: 0.6rem 1.5rem;
	}

	.results-grid {
		display: grid;
		grid-template-columns: 300px 1fr;
		gap: 1rem;
	}

	@media (max-width: 900px) {
		.results-grid {
			grid-template-columns: 1fr;
		}
	}

	.result-card {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 1rem;
	}

	.result-card h3 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
		color: #f8fafc;
	}

	.die-visual {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.die-face {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.6rem;
		background: rgba(30, 41, 59, 0.8);
		border: 2px solid rgba(148, 163, 184, 0.3);
		border-radius: 10px;
	}

	.face-number {
		font-size: 0.65rem;
		color: #94a3b8;
		margin-bottom: 0.2rem;
	}

	.face-value {
		font-size: 1.2rem;
		font-weight: 600;
		color: #f8fafc;
	}

	.die-stats {
		display: flex;
		justify-content: space-between;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(148, 163, 184, 0.15);
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.die-hint {
		margin: 0.5rem 0 0;
		font-size: 0.7rem;
		color: #64748b;
		font-style: italic;
	}

	.chart {
		width: 100%;
		height: auto;
		background: rgba(15, 23, 42, 0.5);
		border-radius: 8px;
	}

	.chart-legend {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: #cbd5f5;
	}

	.legend-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.legend-line {
		width: 20px;
		height: 2px;
	}

	.legend-line.dashed {
		background: repeating-linear-gradient(
			to right,
			#94a3b8,
			#94a3b8 3px,
			transparent 3px,
			transparent 6px
		);
	}

	.class-tables {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1rem;
	}

	.class-table-card {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid var(--class-color);
		border-radius: 12px;
		padding: 1rem;
	}

	.class-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.class-header h3 {
		margin: 0;
		color: var(--class-color);
		font-size: 1.1rem;
	}

	.class-error {
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.breakpoint-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}

	.breakpoint-table th,
	.breakpoint-table td {
		padding: 0.4rem 0.35rem;
		text-align: left;
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}

	.breakpoint-table th {
		background: rgba(30, 41, 59, 0.5);
		color: #f8fafc;
		font-weight: 500;
		font-size: 0.7rem;
		text-transform: uppercase;
	}

	.trait-cell {
		font-weight: 600;
		color: #f8fafc;
	}

	.tier-badge {
		display: inline-block;
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		font-size: 0.65rem;
		text-transform: uppercase;
	}

	.tier-badge.tier-bronze {
		background: rgba(205, 127, 50, 0.3);
		color: #cd7f32;
	}

	.tier-badge.tier-silver {
		background: rgba(192, 192, 192, 0.3);
		color: #c0c0c0;
	}

	.tier-badge.tier-gold {
		background: rgba(255, 215, 0, 0.3);
		color: #ffd700;
	}

	.tier-badge.tier-prismatic {
		background: rgba(168, 85, 247, 0.3);
		color: #a855f7;
	}

	.dice-cell {
		font-weight: 500;
		color: #60a5fa;
	}

	.unlock-badge {
		display: inline-block;
		padding: 0.1rem 0.3rem;
		background: rgba(34, 197, 94, 0.2);
		border-radius: 4px;
		font-size: 0.75rem;
		color: #4ade80;
	}

	.high-error {
		color: #fbbf24;
	}

	.summary-card {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 1rem;
	}

	.summary-card h3 {
		margin: 0 0 0.75rem;
		color: #f8fafc;
	}

	.summary-content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	@media (max-width: 700px) {
		.summary-content {
			grid-template-columns: 1fr;
		}
	}

	.summary-section h4 {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
		color: #94a3b8;
	}

	.summary-section ul {
		margin: 0;
		padding-left: 1.2rem;
		font-size: 0.8rem;
		color: #cbd5f5;
	}

	.summary-section li {
		margin: 0.3rem 0;
	}

	.unlock-example {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.unlock-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.unlock-label {
		width: 35px;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.unlock-faces {
		display: flex;
		gap: 0.25rem;
	}

	.mini-face {
		width: 32px;
		padding: 0.2rem;
		text-align: center;
		background: rgba(34, 197, 94, 0.15);
		border: 1px solid rgba(34, 197, 94, 0.3);
		border-radius: 4px;
		font-size: 0.7rem;
		color: #4ade80;
	}

	.mini-face.locked {
		background: rgba(100, 116, 139, 0.15);
		border-color: rgba(100, 116, 139, 0.3);
		color: #64748b;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.no-results {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 3rem;
		text-align: center;
		color: #94a3b8;
	}

	.no-results .hint {
		margin-top: 0.5rem;
		font-size: 0.85rem;
		color: #64748b;
	}
</style>
