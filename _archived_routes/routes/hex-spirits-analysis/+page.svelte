<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fetchHexSpiritRecords } from '$lib/features/hex-spirits/hexSpirits';
	import { fetchOriginRecords } from '$lib/features/origins/origins';
	import { fetchClassRecords } from '$lib/features/classes/classes';
	import {
		fetchRarityTraitRecords,
		saveRarityTraitRecord,
		rarityTraitRowToForm,
		type RarityTraitFormData
	} from '$lib/features/rarity-traits/rarityTraits';
	import { EditorModal } from '$lib';
	import type { HexSpiritRow, OriginRow, ClassRow, RarityTraitRow } from '$lib/types/gameData';
	import Chart from 'chart.js/auto';
	import type { ChartDataset } from 'chart.js';

	Chart.defaults.color = '#e2e8f0';
	Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.15)';
	Chart.defaults.font.family = 'Inter, system-ui, sans-serif';

	let loading = true;
	let error: string | null = null;
	let spirits: HexSpiritRow[] = [];
	let origins: OriginRow[] = [];
	let classes: ClassRow[] = [];
	let rarityTraits: RarityTraitRow[] = [];

let originChartCanvas: HTMLCanvasElement;
let classChartCanvas: HTMLCanvasElement;
let rarityChartCanvas: HTMLCanvasElement;
let originChart: Chart<'bar', number[], string> | null = null;
let classChart: Chart<'bar', number[], string> | null = null;
let rarityChart: Chart<'bar', number[], string> | null = null;

	let showSettings = false;
	let editingTraits: Map<string, RarityTraitFormData> = new Map();

	// Chart visibility state
	let showOriginAvgCost = true;
	let showOriginPower = false;
	let showAvgOriginPower = false;

	// Sorting state
	let originSortColumn: 'name' | 'count' | 'avgCost' | 'originPower' | 'avgOriginPower' | null = null;
	let originSortDirection: 'asc' | 'desc' = 'asc';
	let classSortColumn: 'name' | 'count' | 'avgCost' | 'offensivePower' | 'defensivePower' | null = null;
	let classSortDirection: 'asc' | 'desc' = 'asc';

	// Class categories
	const OFFENSIVE_CLASSES = ['Swordsman', 'Archer', 'Sorcerer'];
	const DEFENSIVE_CLASSES = ['Defender', 'Backup'];
	const NEUTRAL_CLASSES = ['Strategist', 'Animal', 'Hero Party'];

	// Create lookup map for cost -> rarity traits
	$: rarityTraitMap = (() => {
		const map = new Map<number, RarityTraitRow>();
		rarityTraits.forEach((trait) => {
			map.set(trait.cost, trait);
		});
		return map;
	})();

	function getOriginTraits(cost: number): number {
		return rarityTraitMap.get(cost)?.origin_traits ?? 0;
	}

	function getClassTraits(cost: number): number {
		return rarityTraitMap.get(cost)?.class_traits ?? 0;
	}

	function isOffensiveClass(className: string): boolean {
		return OFFENSIVE_CLASSES.includes(className);
	}

	function isDefensiveClass(className: string): boolean {
		return DEFENSIVE_CLASSES.includes(className);
	}

	type OriginStats = {
		originId: string | null;
		originName: string;
		avgCost: number;
		originPower: number;
		avgOriginPower: number;
		count: number;
	};

	type ClassStats = {
		classId: string | null;
		className: string;
		avgCost: number;
		offensivePower: number;
		defensivePower: number;
		count: number;
	};

	$: originStats = (() => {
	const statsMap = new Map<string | null, { costs: number[]; originTraits: number[] }>();

	spirits.forEach((spirit) => {
		const originId = spirit.traits?.origin_ids?.[0] ?? null;
			if (!statsMap.has(originId)) {
				statsMap.set(originId, { costs: [], originTraits: [] });
			}
			const stats = statsMap.get(originId)!;
			stats.costs.push(spirit.cost);
			stats.originTraits.push(getOriginTraits(spirit.cost));
		});

		const stats: OriginStats[] = [];
		statsMap.forEach((data, originId) => {
			const origin = origins.find((o) => o.id === originId);
			const originName = origin?.name ?? 'Unassigned';
			const count = data.costs.length;
			const avgCost = data.costs.reduce((sum, cost) => sum + cost, 0) / count;
			const originPower = data.originTraits.reduce((sum, traits) => sum + traits, 0);
			const avgOriginPower = count > 0 ? originPower / count : 0;

			stats.push({
				originId,
				originName,
				avgCost,
				originPower,
				avgOriginPower,
				count
			});
		});

		return stats;
	})();

	$: sortedOriginStats = (() => {
		if (!originSortColumn) {
			return originStats.sort((a, b) => a.originName.localeCompare(b.originName));
		}

		const sorted = [...originStats].sort((a, b) => {
			let aVal: number | string;
			let bVal: number | string;

			switch (originSortColumn) {
				case 'name':
					aVal = a.originName;
					bVal = b.originName;
					break;
				case 'count':
					aVal = a.count;
					bVal = b.count;
					break;
				case 'avgCost':
					aVal = a.avgCost;
					bVal = b.avgCost;
					break;
				case 'originPower':
					aVal = a.originPower;
					bVal = b.originPower;
					break;
				case 'avgOriginPower':
					aVal = a.avgOriginPower;
					bVal = b.avgOriginPower;
					break;
				default:
					return 0;
			}

			if (typeof aVal === 'string' && typeof bVal === 'string') {
				return originSortDirection === 'asc'
					? aVal.localeCompare(bVal)
					: bVal.localeCompare(aVal);
			}

			if (typeof aVal === 'number' && typeof bVal === 'number') {
				return originSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
			}

			return 0;
		});

		return sorted;
	})();

	$: classStats = (() => {
	const statsMap = new Map<
		string | null,
		{ costs: number[]; classTraits: number[]; className: string }
	>();

	spirits.forEach((spirit) => {
		const classId = spirit.traits?.class_ids?.[0] ?? null;
		if (!statsMap.has(classId)) {
			const cls = classes.find((c) => c.id === classId);
			const className = cls?.name ?? 'None';
			statsMap.set(classId, { costs: [], classTraits: [], className });
		}
		const stats = statsMap.get(classId)!;
		stats.costs.push(spirit.cost);
		stats.classTraits.push(getClassTraits(spirit.cost));
	});

		const stats: ClassStats[] = [];
		statsMap.forEach((data, classId) => {
			const className = data.className;
			const count = data.costs.length;
			const avgCost = data.costs.reduce((sum, cost) => sum + cost, 0) / count;

			// Calculate offensive and defensive power based on class type
			let offensivePower = 0;
			let defensivePower = 0;

			if (isOffensiveClass(className)) {
				offensivePower = data.classTraits.reduce((sum, traits) => sum + traits, 0);
			} else if (isDefensiveClass(className)) {
				defensivePower = data.classTraits.reduce((sum, traits) => sum + traits, 0);
			}
			// Neutral classes (Strategist, Animal, Hero Party) contribute 0

			stats.push({
				classId,
				className,
				avgCost,
				offensivePower,
				defensivePower,
				count
			});
		});

		return stats;
	})();

	$: sortedClassStats = (() => {
		if (!classSortColumn) {
			return classStats.sort((a, b) => a.className.localeCompare(b.className));
		}

		const sorted = [...classStats].sort((a, b) => {
			let aVal: number | string;
			let bVal: number | string;

			switch (classSortColumn) {
				case 'name':
					aVal = a.className;
					bVal = b.className;
					break;
				case 'count':
					aVal = a.count;
					bVal = b.count;
					break;
				case 'avgCost':
					aVal = a.avgCost;
					bVal = b.avgCost;
					break;
				case 'offensivePower':
					aVal = a.offensivePower;
					bVal = b.offensivePower;
					break;
				case 'defensivePower':
					aVal = a.defensivePower;
					bVal = b.defensivePower;
					break;
				default:
					return 0;
			}

			if (typeof aVal === 'string' && typeof bVal === 'string') {
				return classSortDirection === 'asc'
					? aVal.localeCompare(bVal)
					: bVal.localeCompare(aVal);
			}

			if (typeof aVal === 'number' && typeof bVal === 'number') {
				return classSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
			}

			return 0;
		});

		return sorted;
	})();

	onMount(async () => {
		await loadData();
	});

	onDestroy(() => {
		if (originChart) {
			originChart.destroy();
			originChart = null;
		}
		if (classChart) {
			classChart.destroy();
			classChart = null;
		}
		if (rarityChart) {
			rarityChart.destroy();
			rarityChart = null;
		}
	});

	async function loadData() {
		loading = true;
		error = null;
		try {
			[spirits, origins, classes, rarityTraits] = await Promise.all([
				fetchHexSpiritRecords(),
				fetchOriginRecords(),
				fetchClassRecords(),
				fetchRarityTraitRecords()
			]);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	$: if (!loading && !error && originChartCanvas && sortedOriginStats.length > 0) {
		renderOriginChart();
	}

	$: if (showOriginAvgCost !== undefined || showOriginPower !== undefined || showAvgOriginPower !== undefined) {
		if (originChart) {
			renderOriginChart();
		}
	}

	$: if (!loading && !error && classChartCanvas && sortedClassStats.length > 0) {
		renderClassChart();
	}

	$: rarityDistribution = (() => {
		const distribution = new Map<number, number>();
		spirits.forEach((spirit) => {
			const cost = spirit.cost;
			distribution.set(cost, (distribution.get(cost) || 0) + 1);
		});
		
		// Convert to array and sort by cost
		return Array.from(distribution.entries())
			.map(([cost, count]) => ({ cost, count }))
			.sort((a, b) => a.cost - b.cost);
	})();

	$: if (!loading && !error && rarityChartCanvas && rarityDistribution.length > 0) {
		renderRarityChart();
	}

	function handleOriginSort(column: 'name' | 'count' | 'avgCost' | 'originPower' | 'avgOriginPower') {
		if (originSortColumn === column) {
			originSortDirection = originSortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			originSortColumn = column;
			originSortDirection = 'asc';
		}
	}

	function handleClassSort(column: 'name' | 'count' | 'avgCost' | 'offensivePower' | 'defensivePower') {
		if (classSortColumn === column) {
			classSortDirection = classSortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			classSortColumn = column;
			classSortDirection = 'asc';
		}
	}

	function getSortIcon(column: string, currentColumn: string | null, direction: 'asc' | 'desc'): string {
		if (currentColumn !== column) return '↕️';
		return direction === 'asc' ? '↑' : '↓';
	}

	function renderRarityChart() {
		if (!rarityChartCanvas) return;
		if (rarityChart) rarityChart.destroy();

		const labels = rarityDistribution.map((item) => `Cost ${item.cost}`);
		const countData = rarityDistribution.map((item) => item.count);

		const context = rarityChartCanvas.getContext('2d');
		if (!context) return;

	rarityChart = new Chart<'bar', number[], string>(context, {
			type: 'bar',
			data: {
				labels,
				datasets: [
					{
						label: 'Spirit Count',
						data: countData,
						backgroundColor: 'rgba(99, 102, 241, 0.6)',
						borderColor: 'rgba(99, 102, 241, 1)',
						borderWidth: 2
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false
					},
					title: {
						display: true,
						text: 'Spirit Count Distribution by Cost/Rarity',
						color: '#f8fafc',
						font: { size: 18 }
					},
					tooltip: {
						callbacks: {
							label: function (context) {
								return `Spirits: ${context.parsed.y}`;
							}
						}
					}
				},
				scales: {
					x: {
						ticks: { color: '#e2e8f0' },
						grid: { color: 'rgba(148, 163, 184, 0.15)' },
						title: {
							display: true,
							text: 'Cost/Rarity Tier',
							color: '#e2e8f0'
						}
					},
					y: {
						ticks: { color: '#e2e8f0', stepSize: 1 },
						grid: { color: 'rgba(148, 163, 184, 0.15)' },
						beginAtZero: true,
						title: {
							display: true,
							text: 'Number of Spirits',
							color: '#e2e8f0'
						}
					}
				}
			}
		});
	}

	function getCostColor(value: number): { bg: string; border: string } {
		if (value > 7) {
			// Golden
			return {
				bg: 'rgba(255, 215, 0, 0.6)',
				border: 'rgba(255, 215, 0, 1)'
			};
		} else if (value >= 4) {
			// Purple
			return {
				bg: 'rgba(168, 85, 247, 0.6)',
				border: 'rgba(168, 85, 247, 1)'
			};
		} else if (value >= 2) {
			// Green
			return {
				bg: 'rgba(34, 197, 94, 0.6)',
				border: 'rgba(34, 197, 94, 1)'
			};
		} else {
			// Gray
			return {
				bg: 'rgba(148, 163, 184, 0.6)',
				border: 'rgba(148, 163, 184, 1)'
			};
		}
	}

	function renderOriginChart() {
		if (!originChartCanvas) return;
		if (originChart) originChart.destroy();

		const labels = sortedOriginStats.map((stat) => stat.originName);
		const avgCostData = sortedOriginStats.map((stat) => stat.avgCost);
		const originPowerData = sortedOriginStats.map((stat) => stat.originPower);
		const avgOriginPowerData = sortedOriginStats.map((stat) => stat.avgOriginPower);

		const context = originChartCanvas.getContext('2d');
		if (!context) return;

		const datasets: ChartDataset<'bar', number[]>[] = [];

		if (showOriginAvgCost) {
			const costColors = avgCostData.map((cost) => getCostColor(cost));
			datasets.push({
				label: 'Average Cost',
				data: avgCostData,
				backgroundColor: costColors.map((c) => c.bg),
				borderColor: costColors.map((c) => c.border),
				borderWidth: 2,
				yAxisID: 'y-cost'
			});
		}

		if (showOriginPower) {
			datasets.push({
				label: 'Origin Power',
				data: originPowerData,
				backgroundColor: 'rgba(34, 197, 94, 0.6)',
				borderColor: 'rgba(34, 197, 94, 1)',
				borderWidth: 2,
				yAxisID: 'y-power'
			});
		}

		if (showAvgOriginPower) {
			datasets.push({
				label: 'Avg Origin Power/Spirit',
				data: avgOriginPowerData,
				backgroundColor: 'rgba(168, 85, 247, 0.6)',
				borderColor: 'rgba(168, 85, 247, 1)',
				borderWidth: 2,
				yAxisID: 'y-power'
			});
		}

	originChart = new Chart<'bar', number[], string>(context, {
			type: 'bar',
			data: {
				labels,
				datasets
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: 'bottom',
						labels: { color: '#f1f5f9' }
					},
					title: {
						display: true,
						text: 'Average Cost and Origin Power by Origin',
						color: '#f8fafc',
						font: { size: 18 }
					},
					tooltip: {
						callbacks: {
						label: function (context) {
							const index = context.dataIndex;
							const stat = sortedOriginStats[index];
							const parsedY = typeof context.parsed?.y === 'number' ? context.parsed.y : 0;
							if (context.dataset.label === 'Origin Power') {
								return `${context.dataset.label}: ${parsedY} (${stat.count} spirits)`;
							}
							if (context.dataset.label === 'Avg Origin Power/Spirit') {
								return `${context.dataset.label}: ${parsedY.toFixed(2)} (${stat.count} spirits)`;
							}
							return `${context.dataset.label}: ${parsedY.toFixed(2)} (${stat.count} spirits)`;
						}
						}
					}
				},
				scales: {
					x: {
						ticks: { color: '#e2e8f0' },
						grid: { color: 'rgba(148, 163, 184, 0.15)' }
					},
					...(showOriginAvgCost && {
						'y-cost': {
							type: 'linear',
							position: 'left',
							title: {
								display: true,
								text: 'Average Cost',
								color: '#a5b4fc'
							},
							ticks: { color: '#a5b4fc' },
							grid: { color: 'rgba(148, 163, 184, 0.1)' },
							beginAtZero: true
						}
					}),
					...((showOriginPower || showAvgOriginPower) && {
						'y-power': {
							type: 'linear',
							position: showOriginAvgCost ? 'right' : 'left',
							title: {
								display: true,
								text: 'Origin Power',
								color: '#86efac'
							},
							ticks: { color: '#86efac' },
							grid: { display: false },
							beginAtZero: true
						}
					})
				}
			}
		});
	}

	function renderClassChart() {
		if (!classChartCanvas) return;
		if (classChart) classChart.destroy();

		const labels = sortedClassStats.map((stat) => stat.className);
		const avgCostData = sortedClassStats.map((stat) => stat.avgCost);
		const offensivePowerData = sortedClassStats.map((stat) => stat.offensivePower);
		const defensivePowerData = sortedClassStats.map((stat) => stat.defensivePower);

		const context = classChartCanvas.getContext('2d');
		if (!context) return;

	classChart = new Chart<'bar', number[], string>(context, {
			type: 'bar',
			data: {
				labels,
				datasets: [
					{
						label: 'Average Cost',
						data: avgCostData,
						backgroundColor: 'rgba(99, 102, 241, 0.6)',
						borderColor: 'rgba(99, 102, 241, 1)',
						borderWidth: 2,
						yAxisID: 'y-cost'
					},
					{
						label: 'Offensive Class Power',
						data: offensivePowerData,
						backgroundColor: 'rgba(239, 68, 68, 0.6)',
						borderColor: 'rgba(239, 68, 68, 1)',
						borderWidth: 2,
						yAxisID: 'y-power'
					},
					{
						label: 'Defensive Class Power',
						data: defensivePowerData,
						backgroundColor: 'rgba(59, 130, 246, 0.6)',
						borderColor: 'rgba(59, 130, 246, 1)',
						borderWidth: 2,
						yAxisID: 'y-power'
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: 'bottom',
						labels: { color: '#f1f5f9' }
					},
					title: {
						display: true,
						text: 'Average Cost and Class Power by Class',
						color: '#f8fafc',
						font: { size: 18 }
					},
					tooltip: {
						callbacks: {
						label: function (context) {
							const index = context.dataIndex;
							const stat = sortedClassStats[index];
							const parsedY = typeof context.parsed?.y === 'number' ? context.parsed.y : 0;
							if (context.dataset.label === 'Average Cost') {
								return `${context.dataset.label}: ${parsedY.toFixed(2)} (${stat.count} spirits)`;
							}
							return `${context.dataset.label}: ${parsedY} (${stat.count} spirits)`;
						}
						}
					}
				},
				scales: {
					x: {
						ticks: { color: '#e2e8f0' },
						grid: { color: 'rgba(148, 163, 184, 0.15)' }
					},
					'y-cost': {
						type: 'linear',
						position: 'left',
						title: {
							display: true,
							text: 'Average Cost',
							color: '#a5b4fc'
						},
						ticks: { color: '#a5b4fc' },
						grid: { color: 'rgba(148, 163, 184, 0.1)' },
						beginAtZero: true
					},
					'y-power': {
						type: 'linear',
						position: 'right',
						title: {
							display: true,
							text: 'Class Power',
							color: '#fca5a5'
						},
						ticks: { color: '#fca5a5' },
						grid: { display: false },
						beginAtZero: true
					}
				}
			}
		});
	}

	function formatNumber(value: number): string {
		return value.toFixed(2);
	}

	function openSettings() {
		// Initialize editing traits map with current data
		editingTraits = new Map();
		rarityTraits.forEach((trait) => {
			editingTraits.set(trait.id, rarityTraitRowToForm(trait));
		});
		showSettings = true;
	}

	function closeSettings() {
		showSettings = false;
		editingTraits = new Map();
	}

	function updateTrait(traitId: string, field: 'cost' | 'origin_traits' | 'class_traits', value: number) {
		const trait = editingTraits.get(traitId);
		if (trait) {
			const updatedTrait = { ...trait, [field]: value };
			const newMap = new Map(editingTraits);
			newMap.set(traitId, updatedTrait);
			editingTraits = newMap;
		}
	}

	async function saveAllTraits() {
		try {
			const saves = Array.from(editingTraits.values()).map((trait) => saveRarityTraitRecord(trait));
			await Promise.all(saves);
			await loadData(); // Reload data to refresh charts
			closeSettings();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to save rarity traits: ${message}`);
		}
	}
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Hex Spirits Analysis</h1>
			<p>Statistical analysis of hex spirits showing origin power and class power (offensive/defensive) by origin and class.</p>
		</div>
		<div class="actions">
			<button class="btn" onclick={openSettings}>⚙️ Settings</button>
		</div>
	</header>

	{#if loading}
		<div class="card">Loading hex spirits data…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<div class="analysis-container">
			<section class="chart-section">
				<div class="card">
					<div class="chart-container">
						<div class="chart-wrapper">
							<canvas bind:this={originChartCanvas}></canvas>
						</div>
						<div class="chart-controls">
							<label class="chart-toggle">
								<input type="checkbox" bind:checked={showOriginAvgCost} />
								<span>Average Cost</span>
							</label>
							<label class="chart-toggle">
								<input type="checkbox" bind:checked={showOriginPower} />
								<span>Origin Power</span>
							</label>
							<label class="chart-toggle">
								<input type="checkbox" bind:checked={showAvgOriginPower} />
								<span>Avg Origin Power/Spirit</span>
							</label>
						</div>
					</div>
					<div class="stats-table">
						<h3>Origin Statistics</h3>
						<table>
							<thead>
								<tr>
									<th class="sortable" onclick={() => handleOriginSort('name')}>
										Origin {getSortIcon('name', originSortColumn, originSortDirection)}
									</th>
									<th class="sortable" onclick={() => handleOriginSort('count')}>
										Count {getSortIcon('count', originSortColumn, originSortDirection)}
									</th>
									<th class="sortable" onclick={() => handleOriginSort('avgCost')}>
										Avg Cost {getSortIcon('avgCost', originSortColumn, originSortDirection)}
									</th>
									<th class="sortable" onclick={() => handleOriginSort('originPower')}>
										Origin Power {getSortIcon('originPower', originSortColumn, originSortDirection)}
									</th>
									<th class="sortable" onclick={() => handleOriginSort('avgOriginPower')}>
										Avg Power/Spirit {getSortIcon('avgOriginPower', originSortColumn, originSortDirection)}
									</th>
								</tr>
							</thead>
							<tbody>
								{#each sortedOriginStats as stat}
									<tr>
										<td>{stat.originName}</td>
										<td>{stat.count}</td>
										<td>{formatNumber(stat.avgCost)}</td>
										<td>{stat.originPower}</td>
										<td>{formatNumber(stat.avgOriginPower)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</section>

			<section class="chart-section">
				<div class="card">
					<div class="chart-wrapper">
						<canvas bind:this={classChartCanvas}></canvas>
					</div>
					<div class="stats-table">
						<h3>Class Statistics</h3>
						<table>
							<thead>
								<tr>
									<th class="sortable" onclick={() => handleClassSort('name')}>
										Class {getSortIcon('name', classSortColumn, classSortDirection)}
									</th>
									<th class="sortable" onclick={() => handleClassSort('count')}>
										Count {getSortIcon('count', classSortColumn, classSortDirection)}
									</th>
									<th class="sortable" onclick={() => handleClassSort('avgCost')}>
										Avg Cost {getSortIcon('avgCost', classSortColumn, classSortDirection)}
									</th>
									<th class="sortable" onclick={() => handleClassSort('offensivePower')}>
										Offensive Power {getSortIcon('offensivePower', classSortColumn, classSortDirection)}
									</th>
									<th class="sortable" onclick={() => handleClassSort('defensivePower')}>
										Defensive Power {getSortIcon('defensivePower', classSortColumn, classSortDirection)}
									</th>
								</tr>
							</thead>
							<tbody>
								{#each sortedClassStats as stat}
									<tr>
										<td>{stat.className}</td>
										<td>{stat.count}</td>
										<td>{formatNumber(stat.avgCost)}</td>
										<td>{stat.offensivePower}</td>
										<td>{stat.defensivePower}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</section>

			<section class="chart-section">
				<div class="card">
					<div class="chart-wrapper">
						<canvas bind:this={rarityChartCanvas}></canvas>
					</div>
					<div class="stats-table">
						<h3>Rarity Distribution</h3>
						<table>
							<thead>
								<tr>
									<th>Cost</th>
									<th>Count</th>
									<th>Percentage</th>
								</tr>
							</thead>
							<tbody>
								{#each rarityDistribution as item}
									{@const total = spirits.length}
									{@const percentage = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0'}
									<tr>
										<td>{item.cost}</td>
										<td>{item.count}</td>
										<td>{percentage}%</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</section>
		</div>
	{/if}

	{#if showSettings}
		<EditorModal
			title="Rarity Trait Settings"
			description="Edit the origin and class trait contributions for each cost tier."
			size="md"
			on:close={closeSettings}
		>
			<div class="rarity-traits-settings">
				<table class="traits-table">
					<thead>
						<tr>
							<th>Cost</th>
							<th>Origin Traits</th>
							<th>Class Traits</th>
						</tr>
					</thead>
					<tbody>
						{#each Array.from(editingTraits.values()).sort((a, b) => a.cost - b.cost) as trait (trait.id ?? trait.cost)}
							<tr>
								<td class="cost-cell">{trait.cost}</td>
								<td>
									<input
										type="number"
										min="0"
										value={trait.origin_traits}
										oninput={(e) => {
											const value = parseInt((e.target as HTMLInputElement).value) || 0;
											if (trait.id) updateTrait(trait.id, 'origin_traits', value);
										}}
									/>
								</td>
								<td>
									<input
										type="number"
										min="0"
										value={trait.class_traits}
										oninput={(e) => {
											const value = parseInt((e.target as HTMLInputElement).value) || 0;
											if (trait.id) updateTrait(trait.id, 'class_traits', value);
										}}
									/>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div slot="footer" class="modal-footer-actions">
				<button class="btn btn--primary" type="button" onclick={saveAllTraits}>Save Changes</button>
				<button class="btn" type="button" onclick={closeSettings}>Cancel</button>
			</div>
		</EditorModal>
	{/if}
</section>

<style>
	.analysis-container {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.chart-section {
		width: 100%;
	}

	.chart-section .card {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.chart-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
	}

	.chart-wrapper {
		position: relative;
		height: 400px;
		width: 100%;
	}

	.chart-controls {
		width: 100%;
	}

	.stats-table {
		overflow-x: auto;
	}

	.stats-table h3 {
		margin: 0 0 1rem 0;
		color: #f8fafc;
		font-size: 1.1rem;
	}

	.stats-table table {
		width: 100%;
		border-collapse: collapse;
	}

	.stats-table th,
	.stats-table td {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
	}

	.stats-table th {
		background: rgba(30, 41, 59, 0.6);
		color: #f8fafc;
		font-weight: 600;
		position: sticky;
		top: 0;
	}

	.stats-table th.sortable {
		cursor: pointer;
		user-select: none;
		transition: background-color 0.2s ease;
	}

	.stats-table th.sortable:hover {
		background: rgba(30, 41, 59, 0.8);
	}

	.stats-table td {
		color: #e2e8f0;
	}

	.stats-table tbody tr:hover {
		background: rgba(30, 41, 59, 0.4);
	}

	.error {
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}

	@media (min-width: 768px) {
		.chart-section .card {
			flex-direction: row;
		}

		.chart-container {
			flex: 1;
			min-width: 0;
		}

		.stats-table {
			flex: 0 0 350px;
		}
	}

	.rarity-traits-settings {
		padding: 0.5rem 0;
	}

	.traits-table {
		width: 100%;
		border-collapse: collapse;
	}

	.traits-table th,
	.traits-table td {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
	}

	.traits-table th {
		background: rgba(30, 41, 59, 0.6);
		color: #f8fafc;
		font-weight: 600;
	}

	.traits-table td {
		color: #e2e8f0;
	}

	.cost-cell {
		font-weight: 600;
		color: #f8fafc;
	}

	.traits-table input[type='number'] {
		width: 100%;
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 6px;
		color: #f8fafc;
		font-size: 0.9rem;
	}

	.traits-table input[type='number']:focus {
		outline: none;
		border-color: rgba(99, 102, 241, 0.5);
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.chart-controls {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.75rem;
		background: rgba(30, 41, 59, 0.4);
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.chart-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		user-select: none;
		color: #e2e8f0;
		font-size: 0.9rem;
	}

	.chart-toggle input[type='checkbox'] {
		cursor: pointer;
		width: 18px;
		height: 18px;
		accent-color: rgba(99, 102, 241, 0.8);
	}

	.chart-toggle:hover {
		color: #f8fafc;
	}
</style>
