<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { ClassRow } from '$lib/types/gameData';
	import { parseEffectSchema } from '$lib/features/classes/classes';
	import { fetchDiceRecords } from '$lib/features/dice/dice';
import {
	simulateClassBreakpoints,
	getScaledDiceQuantity,
	type BreakpointSimulationResult,
	type ClassSimulationOptions
} from '$lib/features/classes/simulation';
import type { CustomDiceWithSides } from '$lib/features/dice/dice';
import type { EffectBreakpoint, DiceEffect } from '$lib/types/effects';
import Chart from 'chart.js/auto';
import type { ChartDataset } from 'chart.js';
	Chart.defaults.color = '#e2e8f0';
	Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.15)';
	Chart.defaults.font.family = 'Inter, system-ui, sans-serif';

	const TARGET_CLASSES = ['Swordsman', 'Archer', 'Sorcerer'];

	let loading = true;
	let error: string | null = null;
	let classes: ClassRow[] = [];
	let diceRecords: CustomDiceWithSides[] = [];
	type ClassSimulationVariant = {
		key: string;
		label: string;
		runeCount?: number;
		results: BreakpointSimulationResult[];
		breakdown: EffectBreakdownRow[];
	};
	type EffectBreakdownRow = { label: string; items: string[] };
	let classStats = new Map<string, ClassSimulationVariant[]>();

	const sorcererName = 'Sorcerer';
	const sorcererRuneOptions = [1, 2, 3, 4];
	let selectedRuneCounts = [3];
	let diceNameLookup = new Map<string, string>();
	const MIN_BREAKPOINTS = 3;
	const MAX_BREAKPOINTS = 9;
	let breakpointLimit = MAX_BREAKPOINTS;

	let chartCanvas: HTMLCanvasElement;
let chart: Chart<'line', { x: number; y: number }[]> | null = null;

	onMount(async () => {
		await loadData();
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
			chart = null;
		}
	});

	async function loadData() {
		loading = true;
		error = null;
		try {
			const [{ data: classData, error: classError }, diceData] = await Promise.all([
				supabase
					.from('classes')
					.select('*')
					.in('name', TARGET_CLASSES)
					.order('position', { ascending: true }),
				fetchDiceRecords()
			]);

			if (classError) throw classError;
			classes = (classData ?? []).filter((entry) => TARGET_CLASSES.includes(entry.name));
			diceRecords = diceData;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	$: if (!loading && !error && chartCanvas && classStats.size > 0) {
		renderChart();
	}

	$: if (!loading && !error && classes.length && diceRecords.length) {
		computeStats(selectedRuneCounts);
	}

	$: {
		diceNameLookup = new Map(
			diceRecords.map((record) => [record.id, record.name ?? record.id])
		);
	}

	function toggleRuneCount(count: number) {
		const isSelected = selectedRuneCounts.includes(count);
		if (isSelected) {
			if (selectedRuneCounts.length === 1) {
				return;
			}
			selectedRuneCounts = selectedRuneCounts.filter((value) => value !== count);
		} else {
			selectedRuneCounts = [...selectedRuneCounts, count].sort((a, b) => a - b);
		}
	}

	function computeStats(runeCounts: number[]) {
		const stats = new Map<string, ClassSimulationVariant[]>();
		classes.forEach((entry) => {
			const breakpoints = parseEffectSchema(entry.effect_schema);
			// Sort breakpoints by count before simulation
			const sortedBreakpoints = [...breakpoints].sort((a, b) => {
				const aNum = typeof a.count === 'number' ? a.count : parseInt(String(a.count), 10);
				const bNum = typeof b.count === 'number' ? b.count : parseInt(String(b.count), 10);
				const aValid = Number.isFinite(aNum);
				const bValid = Number.isFinite(bNum);
				if (!aValid && !bValid) return 0;
				if (!aValid) return 1;
				if (!bValid) return -1;
				return aNum - bNum;
			});
			const variants: ClassSimulationVariant[] = [];
			if (entry.name === sorcererName) {
				runeCounts.forEach((runeCount) => {
					const limitedBreakpoints = sortedBreakpoints.slice(0, breakpointLimit);
					const results = simulateClassBreakpoints(limitedBreakpoints, diceRecords, {
							trials: 1000,
							className: entry.name,
							runeCount
						});
					variants.push({
						key: `sorcerer-${runeCount}`,
						label: `${runeCount} Rune${runeCount > 1 ? 's' : ''}`,
						runeCount,
						results,
						breakdown: buildEffectBreakdown(limitedBreakpoints, results, {
							className: entry.name,
							runeCount
						})
					});
				});
			} else {
				const limitedBreakpoints = sortedBreakpoints.slice(0, breakpointLimit);
				const results = simulateClassBreakpoints(limitedBreakpoints, diceRecords, {
					trials: 1000,
					className: entry.name
				});
				variants.push({
					key: `${entry.id}-default`,
					label: 'Default',
					results,
					breakdown: buildEffectBreakdown(limitedBreakpoints, results, {
						className: entry.name
					})
				});
			}
			stats.set(entry.id, variants);
		});
		classStats = stats;
	}

	function renderChart() {
		if (!chartCanvas) {
			console.warn('Chart canvas not available');
			return;
		}
		if (chart) chart.destroy();

		const colors = ['#ef4444', '#3b82f6', '#f97316', '#10b981', '#6366f1', '#ec4899'];
		const datasets: ChartDataset<'line', { x: number; y: number }[]>[] = [];

		let datasetIndex = 0;
		classes.forEach((entry) => {
			const variants = classStats.get(entry.id) ?? [];
			variants.forEach((variant) => {
				const numericStats = variant.results
					.filter((stat) => stat.numericCount !== null)
					.map((stat) => ({ ...stat, numericCount: Number(stat.numericCount) }));
				console.debug(
					`${entry.name} (${variant.label}): ${numericStats.length} data points`,
					numericStats
				);
				if (!numericStats.length) return;

				const color = colors[datasetIndex % colors.length];
				datasetIndex += 1;

				const label =
					entry.name === sorcererName
						? `${entry.name} (${variant.label})`
						: entry.name;

				datasets.push({
					label,
					data: numericStats.map((stat) => ({
						x: Number(stat.numericCount),
						y: stat.mean
					})),
					borderColor: color,
					backgroundColor: color + '33',
					borderWidth: 2,
					tension: 0.25,
					fill: false,
					parsing: false,
					pointRadius: 3,
					pointBackgroundColor: color
				});
			});
		});

		if (datasets.length === 0) {
			console.warn('No chart datasets available - no data to display');
			chart = null;
			return;
		}

		const context = chartCanvas.getContext('2d');
		if (!context) {
			console.error('Failed to get 2D context from canvas');
			return;
		}
		console.debug('Rendering class analysis chart with', datasets.length, 'datasets');
		chart = new Chart<'line', { x: number; y: number }[]>(context, {
			type: 'line',
			data: { datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						type: 'linear',
						title: { display: true, text: 'Breakpoint Count' },
						ticks: { stepSize: 1, color: '#e2e8f0' },
						grid: { color: 'rgba(148, 163, 184, 0.15)' }
					},
					y: {
						title: { display: true, text: 'Average Attack (EV)' },
						beginAtZero: true,
						ticks: { color: '#e2e8f0' },
						grid: { color: 'rgba(148, 163, 184, 0.15)' }
					}
				},
				plugins: {
					legend: {
						position: 'bottom',
						labels: { color: '#f1f5f9' }
					},
					title: {
						display: true,
						text: 'Class Damage Simulation (1000 trials)',
						color: '#f8fafc'
					}
				}
			}
		});
	}

	function formatNumber(value: number): string {
		return value.toFixed(2);
	}

	function buildEffectBreakdown(
		breakpoints: EffectBreakpoint[],
		results: BreakpointSimulationResult[],
		options: ClassSimulationOptions
	): EffectBreakdownRow[] {
		return breakpoints.map((bp, index) => {
			const label =
				results[index]?.countLabel ||
				(results[index]?.numericCount !== null
					? String(results[index]?.numericCount)
					: String(index + 1));
			const items = bp.effects
				.filter((effect): effect is DiceEffect => effect.type === 'dice')
				.map((effect) => describeDiceEffect(effect, options));
			return { label, items };
		});
	}

	function describeDiceEffect(effect: DiceEffect, options: ClassSimulationOptions): string {
		const diceName = resolveDiceName(effect);
		const scaledQuantity = getScaledDiceQuantity(effect, options);
		const baseQuantity = Math.max(0, Math.floor(effect.quantity ?? 0));

		if (
			options.className === sorcererName &&
			options.runeCount !== undefined &&
			scaledQuantity !== baseQuantity
		) {
			return `${diceName} × ${scaledQuantity} (base ${baseQuantity} × ${options.runeCount}/4 runes)`;
		}

		return `${diceName} × ${scaledQuantity}`;
	}

	function resolveDiceName(effect: DiceEffect): string {
		if (effect.dice_name && effect.dice_name.trim().length) {
			return effect.dice_name;
		}
		if (effect.dice_id && diceNameLookup.has(effect.dice_id)) {
			return diceNameLookup.get(effect.dice_id) ?? 'Custom Dice';
		}
		return 'Custom Dice';
	}

	function handleBreakpointLimitChange(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (Number.isFinite(value)) {
			breakpointLimit = Math.min(MAX_BREAKPOINTS, Math.max(MIN_BREAKPOINTS, Math.floor(value)));
			computeStats(selectedRuneCounts);
		}
	}
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Class Analysis</h1>
			<p>Monte Carlo damage simulation for core classes across breakpoint counts.</p>
		</div>
	</header>

	<section class="card controls-card">
		<header>
			<h2>Display Controls</h2>
			<p class="muted">Choose how many breakpoints to include in charts and summaries.</p>
		</header>
		<div class="slider-control">
			<label for="breakpointLimit">
				<span>Breakpoints shown</span>
				<strong>{breakpointLimit}</strong>
			</label>
			<input
				id="breakpointLimit"
				type="range"
				min={MIN_BREAKPOINTS}
				max={MAX_BREAKPOINTS}
				step="1"
				value={breakpointLimit}
				on:input={handleBreakpointLimitChange}
			/>
			<div class="slider-scale">
				<span>{MIN_BREAKPOINTS}</span>
				<span>{MAX_BREAKPOINTS}</span>
			</div>
		</div>
	</section>

	{#if classes.some((entry) => entry.name === sorcererName)}
		<section class="card rune-controls">
			<header>
				<h2>Sorcerer Rune Loadout</h2>
				<p class="muted">Toggle rune counts to compare Sorcerer outcomes.</p>
			</header>
			<div class="rune-toggle">
				{#each sorcererRuneOptions as option}
					<button
						type="button"
						class:selected={selectedRuneCounts.includes(option)}
						on:click={() => toggleRuneCount(option)}
					>
						{option} Rune{option > 1 ? 's' : ''}
					</button>
				{/each}
			</div>
		</section>
	{/if}

	{#if loading}
		<div class="card loading">Simulating class damage…</div>
	{:else if error}
		<div class="card error">{error}</div>
	{:else}
		<section class="card chart-card">
			<canvas bind:this={chartCanvas}></canvas>
		</section>

		<section class="card-grid stats-grid">
			{#each classes as entry (entry.id)}
				{@const variants = classStats.get(entry.id) ?? []}
				<article class="card stats-card">
					<h2>{entry.name}</h2>
					{#if variants.length === 0}
						<p class="muted">No breakpoint data available.</p>
					{:else}
						{#each variants as variant (variant.key)}
							{#if variants.length > 1}
								<h3 class="variant-label">{variant.label}</h3>
							{/if}
							<table>
								<thead>
									<tr>
										<th>Count</th>
										<th>Mean</th>
										<th>SD</th>
									</tr>
								</thead>
								<tbody>
									{#each variant.results as stat, index}
										<tr>
											<td>{stat.countLabel || (stat.numericCount ?? index + 1)}</td>
											<td>{formatNumber(stat.mean)}</td>
											<td>{formatNumber(stat.sd)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
							{#if variant.breakdown.some((row) => row.items.length)}
								<div class="effect-breakdown">
									{#each variant.breakdown as row, rowIndex}
										<div class="effect-breakdown__row">
											<span class="effect-breakdown__label">
												{row.label || (variant.results[rowIndex]?.numericCount ?? rowIndex + 1)}
											</span>
											<ul>
												{#each row.items as item}
													<li>{item}</li>
												{/each}
											</ul>
										</div>
									{/each}
								</div>
							{/if}
						{/each}
					{/if}
				</article>
			{/each}
		</section>
	{/if}
</section>

<style>
	.chart-card {
		height: 420px;
		padding: 1rem;
	}

	.chart-card canvas {
		width: 100%;
		height: 100%;
	}

	.rune-controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.rune-controls header {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.rune-toggle {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.rune-toggle button {
		padding: 0.45rem 0.85rem;
		border-radius: 0.5rem;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: transparent;
		color: #e2e8f0;
		transition: background 0.2s ease, border-color 0.2s ease;
	}

	.rune-toggle button.selected {
		background: rgba(99, 102, 241, 0.18);
		border-color: rgba(99, 102, 241, 0.65);
	}

	.stats-grid {
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.75rem;
	}

	.stats-card {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.stats-card h2 {
		margin: 0;
	}

	.stats-card table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.stats-card th,
	.stats-card td {
		text-align: left;
		padding: 0.35rem 0;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
	}

	.stats-card th {
		font-weight: 600;
		color: #cbd5f5;
	}

	.variant-label {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: #a5b4fc;
	}

	.stats-card td {
		color: #e2e8f0;
	}

	.controls-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.controls-card header {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.slider-control {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.slider-control label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.9rem;
		color: #cbd5f5;
	}

	.slider-control input[type='range'] {
		appearance: none;
		width: 100%;
		height: 4px;
		background: rgba(148, 163, 184, 0.35);
		border-radius: 999px;
		outline: none;
	}

	.slider-control input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #6366f1;
		cursor: pointer;
	}

	.slider-control input[type='range']::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: none;
		background: #6366f1;
		cursor: pointer;
	}

	.slider-scale {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.effect-breakdown {
		margin-top: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.effect-breakdown__row {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.effect-breakdown__label {
		min-width: 60px;
		font-weight: 600;
		color: #f8fafc;
	}

	.effect-breakdown__row ul {
		margin: 0;
		padding-left: 1rem;
		list-style: disc;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		color: #cbd5f5;
		font-size: 0.85rem;
	}
</style>
