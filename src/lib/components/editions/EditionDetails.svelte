<script lang="ts">
	import type { EditionRow, OriginRow, HexSpiritRow } from '$lib/types/gameData';
	import { DEFAULT_COST_DUPLICATES } from '$lib/features/editions/editions';

	type LookupService = {
		getLabel: (id: string | null, defaultValue?: string) => string;
		get: (id: string | null) => OriginRow | undefined;
	};

	type Props = {
		edition: EditionRow | null;
		spirits: HexSpiritRow[];
		originLookup: LookupService;
	};

	let { edition, spirits, originLookup }: Props = $props();

	const ALL_COSTS = ['1', '3', '4', '5', '7', '9', '11', '13', '15', '17'];

	// Spirit distribution by cost
	const costDistribution = $derived.by(() => {
		if (!edition) return [];
		const costDuplicates = edition.cost_duplicates ?? DEFAULT_COST_DUPLICATES;

		return ALL_COSTS.map((cost) => {
			const unique = spirits.filter((s) => String(s.cost) === cost).length;
			const duplicates = costDuplicates[cost] ?? 1;
			const total = unique * duplicates;
			return { cost, unique, duplicates, total };
		});
	});

	// Origin distribution
	const originDistribution = $derived.by(() => {
		if (!edition) return [];

		const originCounts: { originId: string; origin: OriginRow; count: number }[] = [];

		for (const originId of edition.origin_ids) {
			const origin = originLookup.get(originId);
			if (origin) {
				originCounts.push({ originId, origin, count: 0 });
			}
		}

		for (const spirit of spirits) {
			const spiritOriginIds = spirit.traits?.origin_ids ?? [];
			for (const originId of spiritOriginIds) {
				const entry = originCounts.find((e) => e.originId === originId);
				if (entry) {
					entry.count++;
				}
			}
		}

		return originCounts.sort((a, b) => b.count - a.count);
	});

	// Summary statistics
	const summaryStats = $derived.by(() => {
		if (!edition || spirits.length === 0) {
			return {
				totalUnique: 0,
				totalCards: 0,
				averageCost: 0,
				totalManaCost: 0,
				avgCostWeighted: 0,
				originCount: 0,
				multiOriginSpirits: 0,
				costRange: { min: 0, max: 0 }
			};
		}

		const costDuplicates = edition.cost_duplicates ?? DEFAULT_COST_DUPLICATES;

		let totalUnique = spirits.length;
		let totalCards = 0;
		let totalManaCost = 0;
		let weightedCostSum = 0;

		const costs = spirits.map((s) => s.cost);
		const minCost = Math.min(...costs);
		const maxCost = Math.max(...costs);

		for (const spirit of spirits) {
			const cost = String(spirit.cost);
			const dupeCount = costDuplicates[cost] ?? 1;
			totalCards += dupeCount;
			totalManaCost += spirit.cost * dupeCount;
			weightedCostSum += spirit.cost;
		}

		const averageCost = totalUnique > 0 ? weightedCostSum / totalUnique : 0;
		const avgCostWeighted = totalCards > 0 ? totalManaCost / totalCards : 0;

		const multiOriginSpirits = spirits.filter((s) => (s.traits?.origin_ids?.length ?? 0) > 1).length;

		return {
			totalUnique,
			totalCards,
			averageCost,
			totalManaCost,
			avgCostWeighted,
			originCount: edition.origin_ids.length,
			multiOriginSpirits,
			costRange: { min: minCost, max: maxCost }
		};
	});

	// Calculate max for chart scaling
	const maxUniqueCount = $derived(
		Math.max(...costDistribution.map((d) => d.unique), 1)
	);

	const maxTotalCount = $derived(
		Math.max(...costDistribution.map((d) => d.total), 1)
	);

	const maxOriginCount = $derived(
		Math.max(...originDistribution.map((d) => d.count), 1)
	);

	// Deck composition percentages
	const deckComposition = $derived.by(() => {
		const dist = costDistribution;
		const total = dist.reduce((sum, d) => sum + d.total, 0);
		if (total === 0) return [];

		return dist.map((d) => ({
			...d,
			percentage: (d.total / total) * 100
		}));
	});

	// Mana curve analysis
	const manaCurve = $derived.by(() => {
		const lowCost = costDistribution
			.filter((d) => Number.parseInt(d.cost, 10) <= 4)
			.reduce((s, d) => s + d.total, 0);
		const midCost = costDistribution
			.filter((d) => {
				const cost = Number.parseInt(d.cost, 10);
				return cost >= 5 && cost <= 9;
			})
			.reduce((s, d) => s + d.total, 0);
		const highCost = costDistribution
			.filter((d) => Number.parseInt(d.cost, 10) >= 10)
			.reduce((s, d) => s + d.total, 0);
		const total = lowCost + midCost + highCost;

		return { lowCost, midCost, highCost, total };
	});
</script>

{#if !edition}
	<div class="empty-state">
		<p>Select an edition to view details</p>
	</div>
{:else}
	<div class="edition-details">
		<header class="details-header">
			<h2>{edition.name}</h2>
			{#if edition.description}
				<p class="description">{edition.description}</p>
			{/if}
		</header>

		<!-- Summary Stats Grid -->
		<section class="stats-grid">
			<div class="stat-card">
				<span class="stat-value">{summaryStats.totalUnique}</span>
				<span class="stat-label">Unique Spirits</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{summaryStats.totalCards}</span>
				<span class="stat-label">Total Cards</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{summaryStats.averageCost.toFixed(1)}</span>
				<span class="stat-label">Avg Cost (Unique)</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{summaryStats.avgCostWeighted.toFixed(1)}</span>
				<span class="stat-label">Avg Cost (Weighted)</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{summaryStats.totalManaCost}</span>
				<span class="stat-label">Total Mana Value</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{summaryStats.originCount}</span>
				<span class="stat-label">Origins</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{summaryStats.multiOriginSpirits}</span>
				<span class="stat-label">Multi-Origin</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{summaryStats.costRange.min} - {summaryStats.costRange.max}</span>
				<span class="stat-label">Cost Range</span>
			</div>
		</section>

		<!-- Cost Distribution Chart -->
		<section class="chart-section">
			<h3>Spirit Cost Distribution</h3>
			<div class="cost-chart">
				{#each costDistribution as item}
					<div class="cost-bar-group">
						<div class="bar-container">
							<div
								class="bar bar-unique"
								style="height: {(item.unique / maxUniqueCount) * 100}%"
								title="{item.unique} unique"
							>
								{#if item.unique > 0}
									<span class="bar-value">{item.unique}</span>
								{/if}
							</div>
						</div>
						<span class="cost-label">{item.cost}</span>
					</div>
				{/each}
			</div>
			<div class="chart-legend">
				<span class="legend-item"><span class="legend-dot unique"></span> Unique spirits per cost</span>
			</div>
		</section>

		<!-- Total Cards Distribution Chart -->
		<section class="chart-section">
			<h3>Deck Composition (with duplicates)</h3>
			<div class="cost-chart">
				{#each deckComposition as item}
					<div class="cost-bar-group">
						<div class="bar-container">
							<div
								class="bar bar-total"
								style="height: {(item.total / maxTotalCount) * 100}%"
								title="{item.total} cards ({item.percentage.toFixed(1)}%)"
							>
								{#if item.total > 0}
									<span class="bar-value">{item.total}</span>
								{/if}
							</div>
						</div>
						<div class="cost-meta">
							<span class="cost-label">{item.cost}</span>
							<span class="cost-pct">{item.percentage.toFixed(0)}%</span>
						</div>
					</div>
				{/each}
			</div>
			<div class="chart-legend">
				<span class="legend-item"><span class="legend-dot total"></span> Total cards (unique × duplicates)</span>
			</div>
		</section>

		<!-- Duplicates Table -->
		<section class="chart-section">
			<h3>Duplicates Configuration</h3>
			<div class="duplicates-table">
				<div class="table-header">
					<span>Cost</span>
					<span>Unique</span>
					<span>×</span>
					<span>Dupes</span>
					<span>=</span>
					<span>Total</span>
				</div>
				{#each costDistribution as item}
					{#if item.unique > 0}
						<div class="table-row">
							<span class="cell cost">{item.cost}</span>
							<span class="cell">{item.unique}</span>
							<span class="cell op">×</span>
							<span class="cell dupe">{item.duplicates}</span>
							<span class="cell op">=</span>
							<span class="cell total">{item.total}</span>
						</div>
					{/if}
				{/each}
				<div class="table-footer">
					<span>Totals</span>
					<span>{summaryStats.totalUnique}</span>
					<span></span>
					<span></span>
					<span></span>
					<span class="total">{summaryStats.totalCards}</span>
				</div>
			</div>
		</section>

		<!-- Origin Distribution -->
		<section class="chart-section">
			<h3>Spirits by Origin</h3>
			<div class="origin-bars">
				{#each originDistribution as { origin, count }}
					<div class="origin-bar-row">
						<div class="origin-info">
							<span
								class="origin-chip"
								style="border-color: {origin.color}; background: {origin.color}20"
							>
								{origin.name}
							</span>
							<span class="origin-count">{count}</span>
						</div>
						<div class="origin-bar-container">
							<div
								class="origin-bar"
								style="width: {(count / maxOriginCount) * 100}%; background: {origin.color}"
							></div>
						</div>
					</div>
				{/each}
			</div>
			<p class="origin-note">
				Note: Spirits with multiple origins are counted once per origin.
			</p>
		</section>

		<!-- Mana Curve Analysis -->
		<section class="chart-section">
			<h3>Mana Curve Analysis</h3>
			<div class="curve-analysis">
				<div class="curve-segment">
					<div class="curve-bar-container">
						<div
							class="curve-bar low"
							style="width: {manaCurve.total > 0 ? (manaCurve.lowCost / manaCurve.total) * 100 : 0}%"
						></div>
					</div>
					<div class="curve-meta">
						<span class="curve-label">Low (1-3)</span>
						<span class="curve-value">{manaCurve.lowCost} ({manaCurve.total > 0 ? ((manaCurve.lowCost / manaCurve.total) * 100).toFixed(0) : 0}%)</span>
					</div>
				</div>

				<div class="curve-segment">
					<div class="curve-bar-container">
						<div
							class="curve-bar mid"
							style="width: {manaCurve.total > 0 ? (manaCurve.midCost / manaCurve.total) * 100 : 0}%"
						></div>
					</div>
					<div class="curve-meta">
						<span class="curve-label">Mid (5-9)</span>
						<span class="curve-value">{manaCurve.midCost} ({manaCurve.total > 0 ? ((manaCurve.midCost / manaCurve.total) * 100).toFixed(0) : 0}%)</span>
					</div>
				</div>

				<div class="curve-segment">
					<div class="curve-bar-container">
						<div
							class="curve-bar high"
							style="width: {manaCurve.total > 0 ? (manaCurve.highCost / manaCurve.total) * 100 : 0}%"
						></div>
					</div>
					<div class="curve-meta">
						<span class="curve-label">High (11+)</span>
						<span class="curve-value">{manaCurve.highCost} ({manaCurve.total > 0 ? ((manaCurve.highCost / manaCurve.total) * 100).toFixed(0) : 0}%)</span>
					</div>
				</div>
			</div>
		</section>
	</div>
{/if}

<style>
	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		color: #64748b;
		font-style: italic;
	}

	.edition-details {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1rem;
	}

	.details-header {
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
		padding-bottom: 1rem;
	}

	.details-header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: #f8fafc;
	}

	.description {
		margin: 0.5rem 0 0;
		color: #94a3b8;
		font-size: 0.85rem;
	}

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: 0.75rem;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.75rem;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 6px;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 600;
		color: #93c5fd;
	}

	.stat-label {
		font-size: 0.65rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		text-align: center;
		margin-top: 0.25rem;
	}

	/* Chart Sections */
	.chart-section {
		background: rgba(30, 41, 59, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 8px;
		padding: 1rem;
	}

	.chart-section h3 {
		margin: 0 0 1rem 0;
		font-size: 0.85rem;
		color: #c7d2fe;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Cost Distribution Chart */
	.cost-chart {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
		height: 150px;
		padding: 0.5rem 0;
	}

	.cost-bar-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		height: 100%;
	}

	.bar-container {
		flex: 1;
		display: flex;
		align-items: flex-end;
		width: 100%;
	}

	.bar {
		width: 100%;
		min-height: 4px;
		border-radius: 3px 3px 0 0;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		transition: height 0.3s ease;
	}

	.bar-unique {
		background: linear-gradient(180deg, #60a5fa, #3b82f6);
	}

	.bar-total {
		background: linear-gradient(180deg, #a78bfa, #8b5cf6);
	}

	.bar-value {
		font-size: 0.65rem;
		font-weight: 600;
		color: #fff;
		padding-top: 0.25rem;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}

	.cost-label {
		font-size: 0.75rem;
		color: #94a3b8;
		font-weight: 500;
	}

	.cost-meta {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
	}

	.cost-pct {
		font-size: 0.6rem;
		color: #64748b;
	}

	.chart-legend {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.legend-dot {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}

	.legend-dot.unique {
		background: #3b82f6;
	}

	.legend-dot.total {
		background: #8b5cf6;
	}

	/* Duplicates Table */
	.duplicates-table {
		font-size: 0.75rem;
	}

	.table-header {
		display: grid;
		grid-template-columns: 1fr 1fr 0.5fr 1fr 0.5fr 1fr;
		gap: 0.5rem;
		padding: 0.5rem;
		background: rgba(51, 65, 85, 0.4);
		border-radius: 4px 4px 0 0;
		font-weight: 600;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.table-row {
		display: grid;
		grid-template-columns: 1fr 1fr 0.5fr 1fr 0.5fr 1fr;
		gap: 0.5rem;
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
	}

	.table-footer {
		display: grid;
		grid-template-columns: 1fr 1fr 0.5fr 1fr 0.5fr 1fr;
		gap: 0.5rem;
		padding: 0.5rem;
		background: rgba(51, 65, 85, 0.3);
		border-radius: 0 0 4px 4px;
		font-weight: 600;
		color: #e2e8f0;
	}

	.cell {
		color: #cbd5e1;
	}

	.cell.cost {
		font-weight: 600;
		color: #a5b4fc;
	}

	.cell.op {
		color: #64748b;
		text-align: center;
	}

	.cell.dupe {
		color: #fbbf24;
	}

	.cell.total, .table-footer .total {
		color: #34d399;
		font-weight: 600;
	}

	/* Origin Distribution */
	.origin-bars {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.origin-bar-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.origin-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 140px;
	}

	.origin-chip {
		font-size: 0.7rem;
		padding: 0.2rem 0.5rem;
		border: 1px solid;
		border-radius: 4px;
	}

	.origin-count {
		font-size: 0.75rem;
		font-weight: 600;
		color: #93c5fd;
		min-width: 24px;
	}

	.origin-bar-container {
		flex: 1;
		height: 16px;
		background: rgba(51, 65, 85, 0.4);
		border-radius: 3px;
		overflow: hidden;
	}

	.origin-bar {
		height: 100%;
		border-radius: 3px;
		transition: width 0.3s ease;
		opacity: 0.8;
	}

	.origin-note {
		margin: 0.75rem 0 0;
		font-size: 0.7rem;
		color: #64748b;
		font-style: italic;
	}

	/* Mana Curve Analysis */
	.curve-analysis {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.curve-segment {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.curve-bar-container {
		height: 24px;
		background: rgba(51, 65, 85, 0.4);
		border-radius: 4px;
		overflow: hidden;
	}

	.curve-bar {
		height: 100%;
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.curve-bar.low {
		background: linear-gradient(90deg, #34d399, #10b981);
	}

	.curve-bar.mid {
		background: linear-gradient(90deg, #fbbf24, #f59e0b);
	}

	.curve-bar.high {
		background: linear-gradient(90deg, #f87171, #ef4444);
	}

	.curve-meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
	}

	.curve-label {
		color: #94a3b8;
	}

	.curve-value {
		color: #e2e8f0;
		font-weight: 500;
	}
</style>
