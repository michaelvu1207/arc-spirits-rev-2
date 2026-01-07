<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Chart from 'chart.js/auto';
	import type { ChartDataset, ChartOptions, TooltipItem } from 'chart.js';

	type TeamRow = {
		teamSize: number;
		dice: number;
		ev: number;
	};

	type CompositionPoint = {
		teamSize: number;
		fighters: number;
		elementalists: number;
		dice: number;
		baseDice: number;
		exaltedDice: number;
		mythicDice: number;
		exaltedCap: number;
		mythicCap: number;
		ev: number;
	};

	type LinearFit = {
		slope: number;
		intercept: number;
		r2: number | null;
	};

	type ChartPoint = { x: number; y: number };

	const SERIES_KEYS = ['optimal', 'e-0', 'e-1', 'e-2', 'e-3', 'e-4'] as const;
	type SeriesKey = (typeof SERIES_KEYS)[number];

	type SeriesDef = {
		key: SeriesKey;
		label: string;
		color: string;
		elementalists: number | null;
	};

	type LineDataset = ChartDataset<'line', ChartPoint[]> & {
		_key: SeriesKey;
		_elementalists: number | null;
	};

	function clampInt(value: unknown, { min = 0, max = Number.POSITIVE_INFINITY } = {}): number {
		const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
		const safe = Number.isFinite(parsed) ? Math.trunc(parsed) : min;
		return Math.min(max, Math.max(min, safe));
	}

	function clampNumber(
		value: unknown,
		{ min = -Number.POSITIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}
	): number {
		const parsed = typeof value === 'number' ? value : Number(String(value ?? ''));
		const safe = Number.isFinite(parsed) ? parsed : 0;
		return Math.min(max, Math.max(min, safe));
	}

	function fitLinear(points: { x: number; y: number }[]): LinearFit | null {
		if (points.length < 2) return null;

		const n = points.length;
		let sumX = 0;
		let sumY = 0;
		let sumXX = 0;
		let sumXY = 0;

		for (const point of points) {
			sumX += point.x;
			sumY += point.y;
			sumXX += point.x * point.x;
			sumXY += point.x * point.y;
		}

		const denom = n * sumXX - sumX * sumX;
		if (denom === 0) return null;

		const slope = (n * sumXY - sumX * sumY) / denom;
		const intercept = (sumY - slope * sumX) / n;

		const meanY = sumY / n;
		let ssTot = 0;
		let ssRes = 0;
		for (const point of points) {
			const predicted = slope * point.x + intercept;
			const residual = point.y - predicted;
			ssRes += residual * residual;
			const centered = point.y - meanY;
			ssTot += centered * centered;
		}
		const r2 = ssTot === 0 ? null : 1 - ssRes / ssTot;

		return { slope, intercept, r2 };
	}

	function formatNumber(value: number, digits = 3): string {
		return Number.isFinite(value) ? value.toFixed(digits) : '—';
	}

	function formatFitEquation(fit: LinearFit): string {
		const slope = formatNumber(fit.slope, 3);
		const interceptAbs = formatNumber(Math.abs(fit.intercept), 3);
		const interceptSign = fit.intercept < 0 ? '-' : '+';
		const equation = `y = ${slope}x ${interceptSign} ${interceptAbs}`;
		if (fit.r2 === null) return equation;
		return `${equation} (R² ${formatNumber(fit.r2, 3)})`;
	}

	// ---------------------
	// Scratch model inputs
	// ---------------------
	let fighterDieEv = $state(1); // EV per Fighter die (default: 1)
	let dicePerFighter = $state(1); // dice contributed per Fighter (default: 1)

	let exaltedDieEv = $state(2); // EV for Exalted Attack dice (default: 2)
	let elementalistUpgradesAt1 = $state(2); // upgrades when Elementalists = 1
	let elementalistUpgradesAt2 = $state(3); // upgrades when Elementalists = 2
	let elementalistUpgradesAt3 = $state(5); // upgrades when Elementalists = 3 (uses 4E dice)
	let mythicDieEv = $state(3); // EV for special 4E dice (default: 3)
	let elementalistMythicUpgradesAt4 = $state(3); // mythic upgrades when Elementalists = 4

	let visibleSeries = $state<Record<SeriesKey, boolean>>({
		optimal: true,
		'e-0': true,
		'e-1': true,
		'e-2': true,
		'e-3': true,
		'e-4': true
	});

	function toggleSeries(key: SeriesKey): void {
		visibleSeries[key] = !visibleSeries[key];
	}

	const teamSizes = $derived((() => {
		return Array.from({ length: 9 }, (_, index) => index + 1);
	})());

	function getElementalistUpgradeCaps(
		elementalists: number,
		exaltedAt1: number,
		exaltedAt2: number,
		exaltedAt3: number,
		mythicAt4: number
	): { exaltedCap: number; mythicCap: number } {
		if (elementalists <= 0) return { exaltedCap: 0, mythicCap: 0 };
		if (elementalists === 1) return { exaltedCap: exaltedAt1, mythicCap: 0 };
		if (elementalists === 2) return { exaltedCap: exaltedAt2, mythicCap: 0 };
		if (elementalists === 3) return { exaltedCap: 0, mythicCap: exaltedAt3 };
		if (elementalists === 4) return { exaltedCap: 0, mythicCap: mythicAt4 };
		return { exaltedCap: 0, mythicCap: 0 };
	}

	const compositionPoints = $derived((() => {
		const per = clampInt(dicePerFighter, { min: 0, max: 999 });
		const fighterEv = clampNumber(fighterDieEv, { min: 0, max: 999 });
		const exaltedEv = clampNumber(exaltedDieEv, { min: 0, max: 999 });
		const mythicEv = clampNumber(mythicDieEv, { min: 0, max: 999 });
		const upgradesAt1 = clampInt(elementalistUpgradesAt1, { min: 0, max: 999 });
		const upgradesAt2 = clampInt(elementalistUpgradesAt2, { min: 0, max: 999 });
		const upgradesAt3 = clampInt(elementalistUpgradesAt3, { min: 0, max: 999 });
		const mythicAt4 = clampInt(elementalistMythicUpgradesAt4, { min: 0, max: 999 });

		const points: CompositionPoint[] = [];
		for (const teamSize of teamSizes) {
			for (const elementalists of [0, 1, 2, 3, 4] as const) {
				const fighters = teamSize - elementalists;
				if (fighters < 0) continue;

				const dice = fighters * per;
				const caps = getElementalistUpgradeCaps(
					elementalists,
					upgradesAt1,
					upgradesAt2,
					upgradesAt3,
					mythicAt4
				);
				const mythicDice = Math.min(dice, caps.mythicCap);
				const exaltedDice = Math.min(dice - mythicDice, caps.exaltedCap);
				const baseDice = Math.max(0, dice - mythicDice - exaltedDice);
				const ev = baseDice * fighterEv + exaltedDice * exaltedEv + mythicDice * mythicEv;

				points.push({
					teamSize,
					fighters,
					elementalists,
					dice,
					baseDice,
					exaltedDice,
					mythicDice,
					exaltedCap: caps.exaltedCap,
					mythicCap: caps.mythicCap,
					ev
				});
			}
		}

		points.sort((a, b) => a.teamSize - b.teamSize || a.elementalists - b.elementalists);
		return points;
	})());

	const fighterOnlyRows = $derived(
		compositionPoints
			.filter((point) => point.elementalists === 0)
			.map((point) => ({ teamSize: point.teamSize, dice: point.dice, ev: point.ev }))
	);

	const closedForm = $derived((() => {
		const per = clampInt(dicePerFighter, { min: 0, max: 999 });
		const ev = clampNumber(fighterDieEv, { min: 0, max: 999 });
		return {
			slope: per * ev,
			intercept: 0
		};
	})());

	const fighterOnlyFit = $derived((() => {
		if (fighterOnlyRows.length < 2) return null;
		return fitLinear(fighterOnlyRows.map((row) => ({ x: row.teamSize, y: row.ev })));
	})());

	// ---------------------
	// Chart.js (no shared helpers)
	// ---------------------
	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let chart = $state<Chart<'line', ChartPoint[]> | null>(null);

	const bestEvByTeamSize = $derived((() => {
		const map = new Map<number, number>();
		for (const point of compositionPoints) {
			const current = map.get(point.teamSize);
			if (current === undefined || point.ev > current) {
				map.set(point.teamSize, point.ev);
			}
		}
		return map;
	})());

	function isBest(point: CompositionPoint): boolean {
		const best = bestEvByTeamSize.get(point.teamSize);
		return best !== undefined && Math.abs(best - point.ev) < 1e-9;
	}

	const chartDomain = $derived((() => {
		const xMin = teamSizes[0] ?? 1;
		const xMax = teamSizes.at(-1) ?? 9;
		const yMax = Math.max(1, ...compositionPoints.map((point) => point.ev));
		return { xMin, xMax, yMax: Math.ceil(yMax) };
	})());

	const seriesDefs = $derived((() => {
		const upgradesAt1 = clampInt(elementalistUpgradesAt1, { min: 0, max: 999 });
		const upgradesAt2 = clampInt(elementalistUpgradesAt2, { min: 0, max: 999 });
		const upgradesAt3 = clampInt(elementalistUpgradesAt3, { min: 0, max: 999 });
		const mythicAt4 = clampInt(elementalistMythicUpgradesAt4, { min: 0, max: 999 });
		const mythicEv = clampNumber(mythicDieEv, { min: 0, max: 999 });

		const defs: SeriesDef[] = [
			{ key: 'e-0', label: '0 Elementalists (all Fighters)', color: '#60a5fa', elementalists: 0 },
			{ key: 'e-1', label: `1 Elementalist (upgrades ${upgradesAt1})`, color: '#f97316', elementalists: 1 },
			{ key: 'e-2', label: `2 Elementalists (upgrades ${upgradesAt2})`, color: '#a78bfa', elementalists: 2 },
			{
				key: 'e-3',
				label: `3 Elementalists (${upgradesAt3} dice @ EV ${formatNumber(mythicEv, 1)})`,
				color: '#22c55e',
				elementalists: 3
			},
			{
				key: 'e-4',
				label: `4 Elementalists (${mythicAt4} dice @ EV ${formatNumber(mythicEv, 1)})`,
				color: '#14b8a6',
				elementalists: 4
			},
			{ key: 'optimal', label: 'Optimal EV (best comp)', color: '#f8fafc', elementalists: null }
		];

		return defs;
	})());

	const optimalByTeamSize = $derived((() => {
		const rows: { teamSize: number; bestEv: number; best: CompositionPoint[] }[] = [];
		for (const teamSize of teamSizes) {
			const candidates = compositionPoints.filter((point) => point.teamSize === teamSize);
			if (candidates.length === 0) continue;
			const bestEv = Math.max(...candidates.map((candidate) => candidate.ev));
			const best = candidates.filter((candidate) => Math.abs(candidate.ev - bestEv) < 1e-9);
			rows.push({ teamSize, bestEv, best });
		}
		return rows;
	})());

	const compositionLookup = $derived((() => {
		const map = new Map<string, CompositionPoint>();
		for (const point of compositionPoints) {
			map.set(`${point.teamSize}-${point.elementalists}`, point);
		}
		return map;
	})());

	const chartDatasets = $derived((() => {
		const datasets: LineDataset[] = [];
		for (const series of seriesDefs) {
			const isOptimal = series.key === 'optimal';
			const hidden = !visibleSeries[series.key];

			if (isOptimal) {
				const data = optimalByTeamSize.map((row) => ({ x: row.teamSize, y: row.bestEv }));
				datasets.push({
					_key: series.key,
					_elementalists: null,
					label: series.label,
					data,
					borderColor: 'rgba(248, 250, 252, 0.85)',
					backgroundColor: 'rgba(248, 250, 252, 0.85)',
					borderWidth: 2.5,
					borderDash: [6, 6],
					pointRadius: 3.5,
					pointHoverRadius: 6,
					pointBorderColor: 'rgba(15, 23, 42, 0.75)',
					pointBorderWidth: 1,
					tension: 0,
					hidden
				});
				continue;
			}

			const elementalists = series.elementalists ?? 0;
			const points = compositionPoints.filter((point) => point.elementalists === elementalists);
			const data = points.map((point) => ({ x: point.teamSize, y: point.ev }));
			const pointRadius = points.map((point) => (isBest(point) ? 6 : 3));
			const pointBorderWidth = points.map((point) => (isBest(point) ? 2 : 1));
			const pointBorderColor = points.map((point) => (isBest(point) ? '#f8fafc' : 'rgba(15, 23, 42, 0.75)'));

			datasets.push({
				_key: series.key,
				_elementalists: elementalists,
				label: series.label,
				data,
				borderColor: series.color,
				backgroundColor: series.color,
				borderWidth: 2,
				pointRadius,
				pointHoverRadius: pointRadius.map((radius) => radius + 2),
				pointBorderWidth,
				pointBorderColor,
				tension: 0.2,
				hidden
			});
		}

		return datasets;
	})());

	const chartOptions = $derived((() => {
		const tickColor = 'rgba(226, 232, 240, 0.6)';
		const labelColor = 'rgba(226, 232, 240, 0.72)';
		const gridColor = 'rgba(148, 163, 184, 0.18)';

		const options: ChartOptions<'line'> = {
			responsive: true,
			maintainAspectRatio: false,
			animation: false,
			parsing: false,
			normalized: true,
			interaction: { mode: 'nearest', intersect: false },
			scales: {
				x: {
					type: 'linear',
					min: chartDomain.xMin,
					max: chartDomain.xMax,
					ticks: { stepSize: 1, color: tickColor },
					grid: { color: gridColor },
					title: { display: true, text: 'Team size (Fighters + Elementalists)', color: labelColor }
				},
				y: {
					beginAtZero: true,
					suggestedMax: chartDomain.yMax,
					ticks: { color: tickColor },
					grid: { color: gridColor },
					title: { display: true, text: 'EV', color: labelColor }
				}
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						title: (items: TooltipItem<'line'>[]) => {
							const teamSize = items[0]?.parsed.x ?? null;
							return teamSize === null ? '' : `Team size: ${teamSize}`;
						},
						label: (item: TooltipItem<'line'>) => {
							const dataset = item.dataset as unknown as LineDataset;
							const ev = item.parsed.y;
							if (ev === null) return `${dataset.label}: —`;
							return `${dataset.label}: ${formatNumber(ev, 3)}`;
						},
						afterLabel: (item: TooltipItem<'line'>) => {
							const dataset = item.dataset as unknown as LineDataset;
							const teamSize = item.parsed.x;
							if (teamSize === null) return '';

							if (dataset._key === 'optimal') {
								const row = optimalByTeamSize.find((entry) => entry.teamSize === teamSize);
								if (!row) return '';
								const comps = row.best.map((point) => `${point.fighters}F + ${point.elementalists}E`).join(', ');
								return `Best: ${comps}`;
							}

							if (dataset._elementalists === null) return '';
							const key = `${teamSize}-${dataset._elementalists}`;
							const point = compositionLookup.get(key);
							if (!point) return '';
							return [
								`${point.fighters}F + ${point.elementalists}E`,
								`${point.dice} dice (${point.baseDice} base, ${point.exaltedDice} exalted, ${point.mythicDice} mythic)`
							];
						}
					}
				}
			}
		};

		return options;
	})());

	onMount(() => {
		if (!chartCanvas) return;
		const ctx = chartCanvas.getContext('2d');
		if (!ctx) return;

		chart = new Chart<'line', ChartPoint[]>(ctx, {
			type: 'line',
			data: { datasets: chartDatasets },
			options: chartOptions
		});
	});

	onDestroy(() => {
		chart?.destroy();
		chart = null;
	});

	$effect(() => {
		if (!chart) return;
		chart.data.datasets = chartDatasets;
		chart.options = chartOptions;
		chart.update();
	});
</script>

<section class="scratch-page">
	<header class="scratch-header">
		<h1>Fighter + Elementalist Scratchpad</h1>
		<p class="muted">
			Self-contained scratch work (no DB, no shared helpers).
		</p>
	</header>

	<section class="top-stack">
		<article class="card inputs-card">
			<h2>Inputs</h2>
			<div class="controls">
				<label>
					<span>Fighter die EV</span>
					<input type="number" step="0.1" min="0" bind:value={fighterDieEv} />
				</label>
				<label>
					<span>Dice per Fighter</span>
					<input type="number" step="1" min="0" bind:value={dicePerFighter} />
				</label>
				<label>
					<span>Exalted die EV</span>
					<input type="number" step="0.1" min="0" bind:value={exaltedDieEv} />
				</label>
				<label>
					<span>Elementalist upgrades (1)</span>
					<input type="number" step="1" min="0" bind:value={elementalistUpgradesAt1} />
				</label>
				<label>
					<span>Elementalist upgrades (2)</span>
					<input type="number" step="1" min="0" bind:value={elementalistUpgradesAt2} />
				</label>
				<label>
					<span>Elementalist upgrades (3)</span>
					<input type="number" step="1" min="0" bind:value={elementalistUpgradesAt3} />
				</label>
				<label>
					<span>3E/4E die EV</span>
					<input type="number" step="0.1" min="0" bind:value={mythicDieEv} />
				</label>
				<label>
					<span>4E upgrades</span>
					<input type="number" step="1" min="0" bind:value={elementalistMythicUpgradesAt4} />
				</label>
			</div>

			<div class="summary">
				<div class="summary-row">
					<span class="summary-label">All Fighters (closed form)</span>
					<span class="summary-value"
						>y = {formatNumber(closedForm.slope, 3)}x + {formatNumber(closedForm.intercept, 3)}</span
					>
				</div>
				{#if fighterOnlyFit}
					<div class="summary-row">
						<span class="summary-label">All Fighters (least squares fit)</span>
						<span class="summary-value">{formatFitEquation(fighterOnlyFit)}</span>
					</div>
				{/if}
				<div class="summary-row">
					<span class="summary-label">Elementalist rules</span>
					<span class="summary-value">
						1E upgrades {clampInt(elementalistUpgradesAt1)} dice, 2E upgrades
						{clampInt(elementalistUpgradesAt2)} dice, 3E upgrades
						{clampInt(elementalistUpgradesAt3)} dice to EV {formatNumber(mythicDieEv, 1)}, 4E upgrades
						{clampInt(elementalistMythicUpgradesAt4)} dice to EV {formatNumber(mythicDieEv, 1)}.
					</span>
				</div>
			</div>
		</article>

		<article class="card chart-card">
			<h2>EV vs Team Size</h2>
			<p class="muted chart-hint">Hover points for details. Toggle series in the legend.</p>
			<div class="legend" aria-label="Chart legend">
				{#each seriesDefs as series (series.key)}
					<button
						type="button"
						class="legend-item"
						class:is-hidden={!visibleSeries[series.key]}
						aria-pressed={visibleSeries[series.key]}
						onclick={() => toggleSeries(series.key)}
					>
						<span class="legend-swatch" style={`--swatch: ${series.color}`}></span>
						<span>{series.label}</span>
					</button>
				{/each}
			</div>

			<div class="chart-frame">
				<canvas
					bind:this={chartCanvas}
					class="chart-canvas"
					aria-label="Expected value by team size for Fighters and Elementalists"
				></canvas>
			</div>
		</article>
	</section>

	<section class="card">
		<h2>Optimal build by team size</h2>
		<table class="table">
			<thead>
				<tr>
					<th>Team</th>
					<th>Best comp(s)</th>
					<th>EV</th>
				</tr>
			</thead>
			<tbody>
				{#each optimalByTeamSize as row (row.teamSize)}
					<tr>
						<td>{row.teamSize}</td>
						<td class="chips-cell">
							{#each row.best as point (point.fighters + '-' + point.elementalists)}
								<span class="chip">{point.fighters}F + {point.elementalists}E</span>
							{/each}
						</td>
						<td>{formatNumber(row.bestEv, 3)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section class="card">
		<h2>Compositions (Fighters + Elementalists)</h2>
		<table class="table">
			<thead>
				<tr>
					<th>Team</th>
					<th>Comp</th>
					<th>Dice</th>
					<th>Dice mix</th>
					<th>EV</th>
				</tr>
			</thead>
			<tbody>
				{#each compositionPoints as point (point.teamSize + '-' + point.elementalists)}
					<tr class:best={isBest(point)}>
						<td>{point.teamSize}</td>
						<td>{point.fighters}F + {point.elementalists}E</td>
						<td>{point.dice}</td>
						<td>{point.baseDice} base, {point.exaltedDice} exalted, {point.mythicDice} mythic</td>
						<td>{formatNumber(point.ev, 3)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</section>

<style>
	.scratch-page {
		padding: 1rem;
		width: 100%;
		flex: 1;
		max-width: none;
		margin: 0;
		color: #e2e8f0;
	}

	.scratch-header h1 {
		margin: 0;
		font-size: 1.6rem;
	}

	.muted {
		color: rgba(226, 232, 240, 0.72);
	}

	.top-stack {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}

	.card {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 0.75rem;
		padding: 0.9rem;
		backdrop-filter: blur(10px);
	}

	.card h2 {
		margin: 0 0 0.6rem 0;
		font-size: 1.05rem;
	}

	.controls {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}

	.controls label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.9rem;
	}

	.controls input {
		width: 100%;
		border-radius: 0.5rem;
		border: 1px solid rgba(148, 163, 184, 0.28);
		background: rgba(2, 6, 23, 0.35);
		color: #e2e8f0;
		padding: 0.4rem 0.5rem;
	}

	.summary {
		margin-top: 0.8rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.9rem;
	}

	.summary-row {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.summary-label {
		color: rgba(226, 232, 240, 0.72);
		font-size: 0.8rem;
	}

	.summary-value {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
			'Courier New', monospace;
	}

	.chart-hint {
		margin: 0.25rem 0 0.75rem;
		font-size: 0.9rem;
	}

	.chart-frame {
		width: 100%;
		height: 380px;
		background: rgba(2, 6, 23, 0.22);
		border-radius: 0.6rem;
		border: 1px solid rgba(148, 163, 184, 0.16);
		padding: 0.5rem;
		box-sizing: border-box;
	}

	@media (min-width: 980px) {
		.chart-frame {
			height: 440px;
		}
	}

	.chart-canvas {
		width: 100%;
		height: 100%;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.75rem;
		margin: 0;
		font-size: 0.85rem;
	}

	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: rgba(226, 232, 240, 0.85);
		background: rgba(2, 6, 23, 0.25);
		border: 1px solid rgba(148, 163, 184, 0.22);
		border-radius: 999px;
		padding: 0.12rem 0.5rem;
		cursor: pointer;
		user-select: none;
		text-align: left;
	}

	.legend-item:hover {
		border-color: rgba(226, 232, 240, 0.5);
	}

	.legend-item:focus-visible {
		outline: 2px solid rgba(59, 130, 246, 0.6);
		outline-offset: 2px;
	}

	.legend-item.is-hidden {
		opacity: 0.45;
		text-decoration: line-through;
	}

	.legend-swatch {
		width: 10px;
		height: 10px;
		border-radius: 999px;
		background: var(--swatch, #60a5fa);
		border: 1px solid rgba(15, 23, 42, 0.65);
	}

	.table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.table th,
	.table td {
		text-align: left;
		padding: 0.4rem 0;
		border-bottom: 1px solid rgba(148, 163, 184, 0.16);
	}

	.table th {
		color: #cbd5f5;
		font-weight: 600;
	}

	.table tr.best td {
		background: rgba(34, 197, 94, 0.08);
	}

	.chips-cell {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		padding: 0.5rem 0;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		padding: 0.12rem 0.45rem;
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.22);
		background: rgba(2, 6, 23, 0.25);
		font-size: 0.8rem;
		white-space: nowrap;
	}
</style>
