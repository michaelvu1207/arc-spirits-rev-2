<script lang="ts">
	import type { DiceInfo, CurveParams, FitConstraints, FitResult, ColorTier, DiceAvailabilityMode } from '$lib/features/curve-fitting/types';
	import { fitCurve, resultsToEffectSchema, calculateTotalError, CLASS_PRESETS } from '$lib/features/curve-fitting/curveFitting';
	import { generateCurveValues } from '$lib/features/curve-fitting/curveTypes';
	import { formatCombination } from '$lib/features/curve-fitting/diceCombinations';
	import { supabase } from '$lib/api/supabaseClient';
	import type { ClassInfo } from './+page';

	let { data }: { data: { dice: DiceInfo[]; classes: ClassInfo[] } } = $props();

	// Class-specific configurations
	interface ClassConfig {
		key: string;
		name: string;
		color: string;
		enabled: boolean;
		curveParams: CurveParams;
		traitRange: [number, number];
		maxDice: number;
		runeMultiplier?: number;
		allowedDiceIds: string[];
		colorThresholds: {
			bronze: [number, number];
			silver: [number, number];
			gold: [number, number];
			prismatic: [number, number];
		};
	}

	interface ClassResults {
		key: string;
		name: string;
		color: string;
		results: FitResult[];
		targetCurve: { trait: number; value: number }[];
		totalError: number;
	}

	// State for each class
	let classConfigs: ClassConfig[] = $state([]);
	let classResults: ClassResults[] = $state([]);
	let monotonic = $state(true);
	let selectedClassForTable = $state('swordsman');
	let savingClass = $state<string | null>(null);
	let saveMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let enforceAttackDiceTierRanges = $state(true);
	let basicDiceMin = $state(1);
	let basicDiceMax = $state(5);
	let criticalDiceMin = $state(4);
	let criticalDiceMax = $state(8);
	let exaltedDiceMin = $state(7);
	let exaltedDiceMax = $state(10);

	// Initialize configurations
	$effect(() => {
		if (data.dice.length > 0 && classConfigs.length === 0) {
			initializeConfigs();
		}
	});

	function initializeConfigs() {
		classConfigs = [
			{
				key: 'swordsman',
				name: 'Swordsman',
				color: '#3b82f6', // Blue
				enabled: true,
				curveParams: { ...CLASS_PRESETS.swordsman.curveParams },
				traitRange: [...CLASS_PRESETS.swordsman.traitRange] as [number, number],
				maxDice: 4,
				runeMultiplier: undefined,
				allowedDiceIds: data.dice
					.filter((d) => d.name === 'Basic Attack' || d.name === 'Critical Attack' || d.name === 'Exalted Attack')
					.map((d) => d.id),
				colorThresholds: { ...CLASS_PRESETS.swordsman.colorThresholds }
			},
			{
				key: 'archer',
				name: 'Archer',
				color: '#22c55e', // Green
				enabled: true,
				curveParams: { ...CLASS_PRESETS.archer.curveParams },
				traitRange: [...CLASS_PRESETS.archer.traitRange] as [number, number],
				maxDice: 4,
				runeMultiplier: undefined,
				allowedDiceIds: data.dice
					.filter((d) => d.name === 'Basic Attack' || d.name === 'Critical Attack' || d.name === 'Exalted Attack')
					.map((d) => d.id),
				colorThresholds: { ...CLASS_PRESETS.archer.colorThresholds }
			},
			{
				key: 'sorcerer',
				name: 'Sorcerer',
				color: '#a855f7', // Purple
				enabled: true,
				curveParams: { ...CLASS_PRESETS.sorcerer.curveParams },
				traitRange: [...CLASS_PRESETS.sorcerer.traitRange] as [number, number],
				maxDice: 2,
				runeMultiplier: 3,
				allowedDiceIds: data.dice.map((d) => d.id),
				colorThresholds: { ...CLASS_PRESETS.sorcerer.colorThresholds }
			}
		];
	}

	function toggleDice(classKey: string, diceId: string) {
		const config = classConfigs.find((c) => c.key === classKey);
		if (!config) return;

		if (config.allowedDiceIds.includes(diceId)) {
			config.allowedDiceIds = config.allowedDiceIds.filter((id) => id !== diceId);
		} else {
			config.allowedDiceIds = [...config.allowedDiceIds, diceId];
		}
	}

	function computeAllFits() {
		function normalizeTierRange(minValue: number, maxValue: number): [number, number] {
			const minNum = Number.isFinite(minValue) ? minValue : 1;
			const maxNum = Number.isFinite(maxValue) ? maxValue : minNum;
			const min = Math.trunc(Math.min(minNum, maxNum));
			const max = Math.trunc(Math.max(minNum, maxNum));
			return [min, max];
		}

		classResults = classConfigs
			.filter((config) => config.enabled)
			.map((config) => {
				const diceAvailability: DiceAvailabilityMode = {
					mode: 'global',
					globalAllowed: config.allowedDiceIds
				};

				const constraints: FitConstraints = {
					traitRange: config.traitRange,
					maxDice: config.maxDice,
					runeMultiplier: config.runeMultiplier,
					monotonic,
					diceAvailability,
					colorThresholds: config.colorThresholds,
					enforceAttackDiceTierRanges,
					attackDiceTierRanges: {
						basic: normalizeTierRange(basicDiceMin, basicDiceMax),
						critical: normalizeTierRange(criticalDiceMin, criticalDiceMax),
						exalted: normalizeTierRange(exaltedDiceMin, exaltedDiceMax)
					}
				};

				const results = fitCurve(config.curveParams, constraints, data.dice);
				const targetCurve = generateCurveValues(config.curveParams, config.traitRange);

				return {
					key: config.key,
					name: config.name,
					color: config.color,
					results,
					targetCurve,
					totalError: calculateTotalError(results)
				};
			});
	}

	function copyJSON(classKey: string) {
		const result = classResults.find((r) => r.key === classKey);
		if (!result) return;
		const schema = resultsToEffectSchema(result.results);
		navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
		alert(`Copied ${result.name} effect_schema JSON to clipboard!`);
	}

	async function saveToClass(classKey: string) {
		const result = classResults.find((r) => r.key === classKey);
		if (!result) return;

		// Find the class in the database by matching name
		const dbClass = data.classes.find(
			(c) => c.name.toLowerCase() === result.name.toLowerCase()
		);

		if (!dbClass) {
			saveMessage = {
				type: 'error',
				text: `Class "${result.name}" not found in database. Available classes: ${data.classes.map((c) => c.name).join(', ')}`
			};
			return;
		}

		savingClass = classKey;
		saveMessage = null;

		try {
			const schema = resultsToEffectSchema(result.results);

			const { error } = await supabase
				.from('classes')
				.update({
					effect_schema: schema,
					updated_at: new Date().toISOString()
				})
				.eq('id', dbClass.id);

			if (error) throw error;

			saveMessage = {
				type: 'success',
				text: `Saved ${result.results.length} breakpoints to ${result.name}!`
			};
		} catch (err) {
			console.error('Failed to save:', err);
			saveMessage = {
				type: 'error',
				text: `Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`
			};
		} finally {
			savingClass = null;
		}
	}

	function getColorClass(color: ColorTier): string {
		return `color-${color}`;
	}

	// Chart dimensions
	const chartWidth = 700;
	const chartHeight = 350;
	const chartPadding = { top: 20, right: 30, bottom: 40, left: 50 };

	let innerWidth = $derived(chartWidth - chartPadding.left - chartPadding.right);
	let innerHeight = $derived(chartHeight - chartPadding.top - chartPadding.bottom);

	// Chart uses trait range 2-9 to cover all classes
	const chartTraitRange: [number, number] = [2, 9];

	function xScale(trait: number) {
		const [min, max] = chartTraitRange;
		return chartPadding.left + ((trait - min) / (max - min)) * innerWidth;
	}

	let yMax = $derived(() => {
		let max = 1;
		for (const cr of classResults) {
			for (const p of cr.targetCurve) {
				if (p.value > max) max = p.value;
			}
			for (const r of cr.results) {
				if (r.actualValue > max) max = r.actualValue;
			}
		}
		return max;
	});

	function yScale(value: number) {
		return chartPadding.top + innerHeight - (value / yMax()) * innerHeight;
	}

	function buildPath(points: { x: number; y: number }[]): string {
		if (points.length === 0) return '';
		return `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`;
	}

	let selectedResults = $derived(classResults.find((r) => r.key === selectedClassForTable));
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Curve Fitting Tool</h1>
			<p>Design class breakpoints by fitting dice combinations to target damage curves.</p>
		</div>
	</header>

	<div class="layout">
		<div class="controls-panel">
			{#each classConfigs as config, i}
				<div class="control-section class-config" style="--class-color: {config.color}">
					<div class="class-header">
						<label class="class-toggle">
							<input type="checkbox" bind:checked={config.enabled} />
							<span class="class-name" style="color: {config.color}">{config.name}</span>
						</label>
					</div>

					{#if config.enabled}
						<div class="config-grid">
							<div class="config-row">
								<label>
									<span>Curve Type</span>
									<select bind:value={config.curveParams.type}>
										<option value="sigmoid">S-Curve</option>
										<option value="linear">Linear</option>
									</select>
								</label>
								<label>
									<span>Max Dice</span>
									<input type="number" bind:value={config.maxDice} min="1" max="10" />
								</label>
							</div>

							<div class="config-row">
								<label>
									<span>Min</span>
									<input type="number" step="0.1" bind:value={config.curveParams.min} />
								</label>
								<label>
									<span>Max</span>
									<input type="number" step="0.1" bind:value={config.curveParams.max} />
								</label>
								{#if config.curveParams.type === 'sigmoid'}
									<label>
										<span>Inflection</span>
										<input type="number" step="0.5" bind:value={config.curveParams.inflection} />
									</label>
									<label>
										<span>Steepness</span>
										<input type="number" step="0.1" bind:value={config.curveParams.steepness} />
									</label>
								{/if}
							</div>

							<div class="config-row">
								<label>
									<span>Traits</span>
									<div class="range-inputs">
										<input type="number" bind:value={config.traitRange[0]} min="1" max="20" />
										<span>-</span>
										<input type="number" bind:value={config.traitRange[1]} min="1" max="20" />
									</div>
								</label>
								{#if config.key === 'sorcerer'}
									<label>
										<span>Rune ×</span>
										<input type="number" bind:value={config.runeMultiplier} min="1" max="10" />
									</label>
								{/if}
							</div>

							<div class="dice-selection">
								<span class="dice-label">Dice:</span>
								{#each data.dice as die}
									<label class="dice-chip" class:selected={config.allowedDiceIds.includes(die.id)}>
										<input
											type="checkbox"
											checked={config.allowedDiceIds.includes(die.id)}
											onchange={() => toggleDice(config.key, die.id)}
										/>
										<span>{die.name.replace(' Attack', '')}</span>
									</label>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/each}

			<div class="control-section">
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={monotonic} />
					<span>Enforce Monotonic (damage never decreases)</span>
				</label>
			</div>

			<div class="control-section">
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={enforceAttackDiceTierRanges} />
					<span>Enforce attack dice breakpoint windows</span>
				</label>
				<p class="muted" style="margin-top: 0.5rem;">
					Overlapping windows allow mixing Basic/Critical/Exalted dice on the same breakpoint.
				</p>
				<div class="config-grid">
					<div class="config-row">
						<label>
							<span>Basic (min-max)</span>
							<div class="range-inputs">
								<input type="number" min="1" max="20" bind:value={basicDiceMin} />
								<span>-</span>
								<input type="number" min="1" max="20" bind:value={basicDiceMax} />
							</div>
						</label>
						<label>
							<span>Critical (min-max)</span>
							<div class="range-inputs">
								<input type="number" min="1" max="20" bind:value={criticalDiceMin} />
								<span>-</span>
								<input type="number" min="1" max="20" bind:value={criticalDiceMax} />
							</div>
						</label>
						<label>
							<span>Exalted (min-max)</span>
							<div class="range-inputs">
								<input type="number" min="1" max="20" bind:value={exaltedDiceMin} />
								<span>-</span>
								<input type="number" min="1" max="20" bind:value={exaltedDiceMax} />
							</div>
						</label>
					</div>
				</div>
			</div>

			<button class="btn btn--primary compute-btn" onclick={computeAllFits}>
				Compute All Fits
			</button>
		</div>

		<div class="results-panel">
			{#if classResults.length > 0}
				<div class="chart-section">
					<h3>All Class Curves</h3>
					<svg viewBox="0 0 {chartWidth} {chartHeight}" class="chart">
						<!-- Grid lines -->
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
								font-size="12"
							>
								{((5 - i) / 5 * yMax()).toFixed(1)}
							</text>
						{/each}

						<!-- X-axis labels -->
						{#each Array.from({ length: chartTraitRange[1] - chartTraitRange[0] + 1 }, (_, i) => chartTraitRange[0] + i) as trait}
							<text
								x={xScale(trait)}
								y={chartHeight - 10}
								text-anchor="middle"
								fill="#94a3b8"
								font-size="12"
							>
								{trait}
							</text>
						{/each}

						<!-- Axis labels -->
						<text x={chartWidth / 2} y={chartHeight - 2} text-anchor="middle" fill="#94a3b8" font-size="12">
							Traits
						</text>
						<text x={12} y={chartHeight / 2} text-anchor="middle" fill="#94a3b8" font-size="12" transform="rotate(-90, 12, {chartHeight / 2})">
							Damage
						</text>

						<!-- Target curves (dashed) -->
						{#each classResults as cr}
							{@const targetPoints = cr.targetCurve.map((p) => ({ x: xScale(p.trait), y: yScale(p.value) }))}
							<path d={buildPath(targetPoints)} fill="none" stroke={cr.color} stroke-width="1.5" stroke-dasharray="4,4" opacity="0.5" />
						{/each}

						<!-- Fitted curves (solid) -->
						{#each classResults as cr}
							{@const fittedPoints = cr.results.map((r) => ({ x: xScale(r.trait), y: yScale(r.actualValue) }))}
							<path d={buildPath(fittedPoints)} fill="none" stroke={cr.color} stroke-width="2.5" />
						{/each}

						<!-- Data points -->
						{#each classResults as cr}
							{#each cr.results as result}
								<circle
									cx={xScale(result.trait)}
									cy={yScale(result.actualValue)}
									r="5"
									fill={cr.color}
									stroke="#1e293b"
									stroke-width="2"
								/>
							{/each}
						{/each}
					</svg>

					<div class="chart-legend">
						{#each classResults as cr}
							<span class="legend-item">
								<span class="legend-dot" style="background: {cr.color}"></span>
								{cr.name} (err: {cr.totalError.toFixed(2)})
							</span>
						{/each}
					</div>
				</div>

				<div class="results-section">
					<div class="results-tabs">
						{#each classResults as cr}
							<button
								class="tab-btn"
								class:active={selectedClassForTable === cr.key}
								style="--tab-color: {cr.color}"
								onclick={() => (selectedClassForTable = cr.key)}
							>
								{cr.name}
							</button>
						{/each}
					</div>

					{#if selectedResults}
						<div class="results-header">
							<h3 style="color: {selectedResults.color}">{selectedResults.name} Results</h3>
							<div class="results-stats">
								<span>Total Error: {selectedResults.totalError.toFixed(3)}</span>
							</div>
						</div>

						<table class="results-table">
							<thead>
								<tr>
									<th>Trait</th>
									<th>Target</th>
									<th>Actual</th>
									<th>Dice Combination</th>
									<th>Error</th>
								</tr>
							</thead>
							<tbody>
								{#each selectedResults.results as result}
									<tr class={getColorClass(result.color)}>
										<td class="trait-cell">{result.trait}</td>
										<td>{result.targetValue.toFixed(2)}</td>
										<td>{result.actualValue.toFixed(2)}</td>
										<td class="dice-cell">
											{#if result.dice.length > 0}
												{formatCombination(result.dice)}
											{:else}
												<span class="no-dice">No valid combination</span>
											{/if}
										</td>
										<td class="error-cell" class:high-error={result.error > 0.5}>
											{result.error.toFixed(3)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>

						<div class="results-actions">
							<button class="btn" onclick={() => copyJSON(selectedResults?.key ?? '')}>
								Copy {selectedResults.name} JSON
							</button>
							<button
								class="btn btn--save"
								onclick={() => saveToClass(selectedResults?.key ?? '')}
								disabled={savingClass !== null}
							>
								{#if savingClass === selectedResults?.key}
									Saving...
								{:else}
									Save to {selectedResults.name}
								{/if}
							</button>
						</div>

						{#if saveMessage}
							<div class="save-message" class:success={saveMessage.type === 'success'} class:error={saveMessage.type === 'error'}>
								{saveMessage.text}
							</div>
						{/if}
					{/if}
				</div>
			{:else}
				<div class="no-results">
					<p>Configure your class parameters and click "Compute All Fits" to see results.</p>
				</div>
			{/if}
		</div>
	</div>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.muted {
		font-size: 0.85rem;
		color: #94a3b8;
		margin: 0;
	}

	.layout {
		display: grid;
		grid-template-columns: 380px 1fr;
		gap: 1.5rem;
	}

	@media (max-width: 1024px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.controls-panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.control-section {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 0.75rem;
	}

	.class-config {
		border-left: 3px solid var(--class-color);
	}

	.class-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.class-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.class-name {
		font-weight: 600;
		font-size: 1rem;
	}

	.config-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.15);
	}

	.config-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.config-row label {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		flex: 1;
		min-width: 70px;
	}

	.config-row label span {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.config-row input,
	.config-row select {
		padding: 0.35rem;
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 4px;
		color: #f8fafc;
		font-size: 0.85rem;
	}

	.range-inputs {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.range-inputs input {
		width: 45px;
		text-align: center;
	}

	.range-inputs span {
		color: #94a3b8;
	}

	.dice-selection {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
	}

	.dice-label {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.dice-chip {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.5rem;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 12px;
		font-size: 0.75rem;
		color: #94a3b8;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.dice-chip input {
		display: none;
	}

	.dice-chip.selected {
		background: rgba(59, 130, 246, 0.2);
		border-color: rgba(59, 130, 246, 0.5);
		color: #f8fafc;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #cbd5f5;
		font-size: 0.9rem;
	}

	.compute-btn {
		width: 100%;
		padding: 0.75rem;
		font-size: 1rem;
	}

	.btn--primary {
		background: linear-gradient(135deg, #3b82f6, #8b5cf6);
		border: none;
		color: #f8fafc;
	}

	.results-panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.chart-section {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 1rem;
	}

	.chart-section h3 {
		margin: 0 0 0.75rem;
		color: #f8fafc;
	}

	.chart {
		width: 100%;
		height: auto;
		background: rgba(15, 23, 42, 0.5);
		border-radius: 8px;
	}

	.chart-legend {
		display: flex;
		gap: 1.5rem;
		margin-top: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #cbd5f5;
		font-size: 0.85rem;
	}

	.legend-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}

	.results-section {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 1rem;
	}

	.results-tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.tab-btn {
		padding: 0.5rem 1rem;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 8px;
		color: #cbd5f5;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tab-btn:hover {
		background: rgba(59, 130, 246, 0.2);
	}

	.tab-btn.active {
		background: var(--tab-color);
		border-color: transparent;
		color: #f8fafc;
	}

	.results-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.results-header h3 {
		margin: 0;
	}

	.results-stats {
		color: #94a3b8;
		font-size: 0.9rem;
	}

	.results-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.results-table th,
	.results-table td {
		padding: 0.5rem 0.6rem;
		text-align: left;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
	}

	.results-table th {
		background: rgba(30, 41, 59, 0.5);
		color: #f8fafc;
		font-weight: 500;
	}

	.results-table tr.color-bronze {
		background: rgba(205, 127, 50, 0.1);
	}

	.results-table tr.color-silver {
		background: rgba(192, 192, 192, 0.1);
	}

	.results-table tr.color-gold {
		background: rgba(255, 215, 0, 0.1);
	}

	.results-table tr.color-prismatic {
		background: rgba(168, 85, 247, 0.1);
	}

	.trait-cell {
		font-weight: 600;
		color: #f8fafc;
	}

	.dice-cell {
		color: #cbd5f5;
	}

	.no-dice {
		color: #f87171;
		font-style: italic;
	}

	.error-cell {
		color: #4ade80;
	}

	.error-cell.high-error {
		color: #fbbf24;
	}

	.results-actions {
		margin-top: 1rem;
		display: flex;
		gap: 0.5rem;
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

	.btn--save {
		background: linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(16, 185, 129, 0.3));
		border-color: rgba(34, 197, 94, 0.5);
	}

	.btn--save:hover:not(:disabled) {
		background: linear-gradient(135deg, rgba(34, 197, 94, 0.5), rgba(16, 185, 129, 0.5));
		border-color: rgba(34, 197, 94, 0.7);
	}

	.btn--save:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.save-message {
		margin-top: 0.75rem;
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		font-size: 0.85rem;
	}

	.save-message.success {
		background: rgba(34, 197, 94, 0.15);
		border: 1px solid rgba(34, 197, 94, 0.4);
		color: #4ade80;
	}

	.save-message.error {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: #f87171;
	}

	.no-results {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 3rem;
		text-align: center;
		color: #94a3b8;
	}
</style>
