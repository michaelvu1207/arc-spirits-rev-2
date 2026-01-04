<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import PageLayout from '$lib/components/layout/PageLayout.svelte';
	import type { Tab } from '$lib/components/layout/TabBar.svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { ClassRow, HexSpiritRow, OriginRow, RarityTraitRow, UnitRow } from '$lib/types/gameData';
	import { parseEffectSchema } from '$lib/features/classes/classes';
	import { fetchDiceRecords, type CustomDiceWithSides } from '$lib/features/dice/dice';
	import {
		simulateClassBreakpoints,
		getScaledDiceQuantity,
		type BreakpointSimulationResult,
		type ClassSimulationOptions
	} from '$lib/features/classes/simulation';
	import type { EffectBreakpoint, DiceEffect } from '$lib/types/effects';
	import Chart from 'chart.js/auto';
	import type { ChartDataset } from 'chart.js';
	import {
		fetchHexSpiritRecords
	} from '$lib/features/hex-spirits/hexSpirits';
	import { fetchOriginRecords } from '$lib/features/origins/origins';
	import { fetchClassRecords } from '$lib/features/classes/classes';
	import {
		fetchRarityTraitRecords,
		saveRarityTraitRecord,
		rarityTraitRowToForm,
		type RarityTraitFormData
	} from '$lib/features/rarity-traits/rarityTraits';
	import { EditorModal } from '$lib';
	import type { DiceInfo, CurveParams, FitConstraints, FitResult, ColorTier, DiceAvailabilityMode } from '$lib/features/curve-fitting/types';
	import { fitCurve, resultsToEffectSchema, calculateTotalError, CLASS_PRESETS } from '$lib/features/curve-fitting/curveFitting';
	import { generateCurveValues } from '$lib/features/curve-fitting/curveTypes';
	import { formatCombination } from '$lib/features/curve-fitting/diceCombinations';
	import {
		UNIT_RARITY_CONFIG,
		type UnitRarityKey,
		type UnitRarityConfig
	} from '$lib/utils/gameLogic';
	import {
		fetchSimulationSettings,
		upsertSimulationSettings,
		applyRarityOverrides,
		DEFAULT_SETTINGS_NAME,
		type SimulationSettingsData,
		type MonsterCounts,
		type MonsterTakeLimits,
		type RarityOverrides
	} from '$lib/api/simulationSettings';
	import {
		DEFAULT_DRAWS_PER_PLAYER,
		DEFAULT_MONSTER_COUNTS,
		DEFAULT_MONSTER_LIMITS,
		DEFAULT_SHOP_SIZE,
		DEFAULT_TOTAL_STAGES,
		MIN_PLAYERS,
		MAX_PLAYERS,
		MONSTER_ORDER,
		DEFAULT_STAGE_PURCHASES,
		normalizeMonsterCounts,
		normalizeMonsterTakeLimits,
		type StagePurchaseConfig,
		type MonsterKey
	} from '$lib/utils/shop-config';
	import StageBarChart from '$lib/components/StageBarChart.svelte';
	import {
		simulateStagePurchases,
		DEFAULT_PURCHASE_SUCCESS_RATE,
		type StageSimulationResult
	} from '$lib/utils/shopSimulation';
	import type { ClassTargets } from '$lib/features/alternative-dice/types';
	import {
		optimizeGlobally,
		formatUnlockLevel,
		type GlobalOptimizationResult
	} from '$lib/features/alternative-dice/globalOptimizer';

	Chart.defaults.color = '#e2e8f0';
	Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.15)';
	Chart.defaults.font.family = 'Inter, system-ui, sans-serif';

	// Tab management
	let activeTab = $state('classes');
	const tabs: Tab[] = [
		{ id: 'classes', label: 'Classes' },
		{ id: 'spirits', label: 'Spirits' },
		{ id: 'curves', label: 'Curves' },
		{ id: 'shop', label: 'Shop' },
		{ id: 'alt-dice', label: 'Alt Dice' }
	];

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}

	// =====================
	// CLASS ANALYSIS STATE
	// =====================
	const TARGET_CLASSES = ['Fighter'];
	let classLoading = true;
	let classError: string | null = null;
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
	let classChartCanvas: HTMLCanvasElement;
	let classChart: Chart<'line', { x: number; y: number }[]> | null = null;

	// =====================
	// SPIRITS ANALYSIS STATE
	// =====================
	let spiritsLoading = true;
	let spiritsError: string | null = null;
	let spirits: HexSpiritRow[] = [];
	let origins: OriginRow[] = [];
	let spiritClasses: ClassRow[] = [];
	let rarityTraits: RarityTraitRow[] = [];
	let originChartCanvas: HTMLCanvasElement;
	let classChartCanvas2: HTMLCanvasElement;
	let rarityChartCanvas: HTMLCanvasElement;
	let originChart: Chart<'bar', number[], string> | null = null;
	let classChart2: Chart<'bar', number[], string> | null = null;
	let rarityChart: Chart<'bar', number[], string> | null = null;
	let showSettings = false;
	let editingTraits: Map<string, RarityTraitFormData> = new Map();
	let showOriginAvgCost = true;
	let showOriginPower = false;
	let showAvgOriginPower = false;
	let originSortColumn: 'name' | 'count' | 'avgCost' | 'originPower' | 'avgOriginPower' | null = null;
	let originSortDirection: 'asc' | 'desc' = 'asc';
	let classSortColumn: 'name' | 'count' | 'avgCost' | 'offensivePower' | 'defensivePower' | null = null;
	let classSortDirection: 'asc' | 'desc' = 'asc';
	const OFFENSIVE_CLASSES = ['Fighter'];
	const DEFENSIVE_CLASSES = ['Defender', 'Backup'];

	// =====================
	// CURVE FITTING STATE
	// =====================
	let curveDice: DiceInfo[] = [];
	let curveClasses: { id: string; name: string }[] = [];
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
	let classConfigs: ClassConfig[] = $state([]);
	let classResults: ClassResults[] = $state([]);
	let monotonic = $state(true);
	let selectedClassForTable = $state('fighter');
	let savingClass = $state<string | null>(null);
	let saveMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let enforceAttackDiceTierRanges = $state(true);
	let basicDiceMin = $state(1);
	let basicDiceMax = $state(5);
	let criticalDiceMin = $state(4);
	let criticalDiceMax = $state(8);
	let exaltedDiceMin = $state(7);
	let exaltedDiceMax = $state(10);

	// =====================
	// SHOP ANALYSIS STATE
	// =====================
	const SIMULATION_ITERATIONS = 20000;
	let units: UnitRow[] = [];
	let shopLoading = true;
	let shopError: string | null = null;
	const RARITY_KEYS: MonsterKey[] = UNIT_RARITY_CONFIG.map((config) => config.key as MonsterKey);
	let playerCount = MIN_PLAYERS;
	let shopSize = DEFAULT_SHOP_SIZE;
	let drawsPerPlayer = DEFAULT_DRAWS_PER_PLAYER;
	let purchaseSuccessRate = DEFAULT_PURCHASE_SUCCESS_RATE;
	interface RarityStat {
		config: UnitRarityConfig;
		unitCount: number;
		basePerUnit: number;
		adjustedPerUnit: number;
		totalCopies: number;
		override: number | null;
	}
	let rarityStats: RarityStat[] = [];
	let stageSummary: StageSimulationResult | null = null;
	let totalStages = DEFAULT_TOTAL_STAGES;
	let monsterCounts: MonsterCounts = { ...DEFAULT_MONSTER_COUNTS };
	let monsterTakeLimits: MonsterTakeLimits = { ...DEFAULT_MONSTER_LIMITS };
	let rarityOverrides: RarityOverrides = {};
	let stagePurchasePlan: StagePurchaseConfig[] = cloneStagePlans(DEFAULT_STAGE_PURCHASES, totalStages);
	let settingsName = DEFAULT_SETTINGS_NAME;
	let settingsLoading = false;
	let saveState: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
	let shopSaveMessage: string | null = null;
	let showSettingsModal = false;
	let availableConfigs: string[] = [];
	let newConfigName = '';

	// =====================
	// ALT DICE STATE
	// =====================
	let altDice: DiceInfo[] = [];
	let altClassTargets: ClassTargets[] = [];
	let maxDice = $state(10);
	let iterations = $state(20);
	let variancePenalty = $state(2.0);
	let altResult = $state<GlobalOptimizationResult | null>(null);

	// =====================
	// LIFECYCLE
	// =====================
	onMount(async () => {
		await loadClassData();
		await loadSpiritsData();
		await loadCurveData();
		await loadShopData();
		await loadAltDiceData();
	});

	onDestroy(() => {
		if (classChart) {
			classChart.destroy();
			classChart = null;
		}
		if (originChart) {
			originChart.destroy();
			originChart = null;
		}
		if (classChart2) {
			classChart2.destroy();
			classChart2 = null;
		}
		if (rarityChart) {
			rarityChart.destroy();
			rarityChart = null;
		}
	});

	// =====================
	// CLASS ANALYSIS FUNCTIONS
	// =====================
	async function loadClassData() {
		classLoading = true;
		classError = null;
		try {
			const [{ data: classData, error: classErr }, diceData] = await Promise.all([
				supabase
					.from('classes')
					.select('*')
					.in('name', TARGET_CLASSES)
					.order('position', { ascending: true }),
				fetchDiceRecords()
			]);

			if (classErr) throw classErr;
			classes = (classData ?? []).filter((entry) => TARGET_CLASSES.includes(entry.name));
			diceRecords = diceData;
		} catch (err) {
			classError = err instanceof Error ? err.message : String(err);
		} finally {
			classLoading = false;
		}
	}

	$effect(() => {
		if (!classLoading && !classError && classChartCanvas && classStats.size > 0) {
			renderClassChart();
		}
	});

	$effect(() => {
		if (!classLoading && !classError && classes.length && diceRecords.length) {
			computeClassStats(selectedRuneCounts);
		}
	});

	$effect(() => {
		diceNameLookup = new Map(
			diceRecords.map((record) => [record.id, record.name ?? record.id])
		);
	});

	function toggleRuneCount(count: number) {
		const isSelected = selectedRuneCounts.includes(count);
		if (isSelected) {
			if (selectedRuneCounts.length === 1) return;
			selectedRuneCounts = selectedRuneCounts.filter((value) => value !== count);
		} else {
			selectedRuneCounts = [...selectedRuneCounts, count].sort((a, b) => a - b);
		}
	}

	function computeClassStats(runeCounts: number[]) {
		const stats = new Map<string, ClassSimulationVariant[]>();
		classes.forEach((entry) => {
			const breakpoints = parseEffectSchema(entry.effect_schema);
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

	function renderClassChart() {
		if (!classChartCanvas) return;
		if (classChart) classChart.destroy();

		const colors = ['#ef4444', '#3b82f6', '#f97316', '#10b981', '#6366f1', '#ec4899'];
		const datasets: ChartDataset<'line', { x: number; y: number }[]>[] = [];

		let datasetIndex = 0;
		classes.forEach((entry) => {
			const variants = classStats.get(entry.id) ?? [];
			variants.forEach((variant) => {
				const numericStats = variant.results
					.filter((stat) => stat.numericCount !== null)
					.map((stat) => ({ ...stat, numericCount: Number(stat.numericCount) }));
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
			classChart = null;
			return;
		}

		const context = classChartCanvas.getContext('2d');
		if (!context) return;

		classChart = new Chart<'line', { x: number; y: number }[]>(context, {
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
			computeClassStats(selectedRuneCounts);
		}
	}

	function formatNumber(value: number): string {
		return value.toFixed(2);
	}

	// =====================
	// SPIRITS ANALYSIS FUNCTIONS
	// =====================
	async function loadSpiritsData() {
		spiritsLoading = true;
		spiritsError = null;
		try {
			[spirits, origins, spiritClasses, rarityTraits] = await Promise.all([
				fetchHexSpiritRecords(),
				fetchOriginRecords(),
				fetchClassRecords(),
				fetchRarityTraitRecords()
			]);
		} catch (err) {
			spiritsError = err instanceof Error ? err.message : String(err);
		} finally {
			spiritsLoading = false;
		}
	}

	const rarityTraitMap = $derived((() => {
		const map = new Map<number, RarityTraitRow>();
		rarityTraits.forEach((trait) => {
			map.set(trait.cost, trait);
		});
		return map;
	})());

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

	const originStats = $derived((() => {
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
	})());

	const sortedOriginStats = $derived((() => {
		if (!originSortColumn) {
			return [...originStats].sort((a, b) => a.originName.localeCompare(b.originName));
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
	})());

	const classStats2 = $derived((() => {
		const statsMap = new Map<
			string | null,
			{ costs: number[]; classTraits: number[]; className: string }
		>();

		spirits.forEach((spirit) => {
			const classId = spirit.traits?.class_ids?.[0] ?? null;
			if (!statsMap.has(classId)) {
				const cls = spiritClasses.find((c) => c.id === classId);
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

			let offensivePower = 0;
			let defensivePower = 0;

			if (isOffensiveClass(className)) {
				offensivePower = data.classTraits.reduce((sum, traits) => sum + traits, 0);
			} else if (isDefensiveClass(className)) {
				defensivePower = data.classTraits.reduce((sum, traits) => sum + traits, 0);
			}

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
	})());

	const sortedClassStats = $derived((() => {
		if (!classSortColumn) {
			return [...classStats2].sort((a, b) => a.className.localeCompare(b.className));
		}

		const sorted = [...classStats2].sort((a, b) => {
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
	})());

	$effect(() => {
		if (!spiritsLoading && !spiritsError && originChartCanvas && sortedOriginStats.length > 0) {
			renderOriginChart();
		}
	});

	$effect(() => {
		if (showOriginAvgCost !== undefined || showOriginPower !== undefined || showAvgOriginPower !== undefined) {
			if (originChart) {
				renderOriginChart();
			}
		}
	});

	$effect(() => {
		if (!spiritsLoading && !spiritsError && classChartCanvas2 && sortedClassStats.length > 0) {
			renderClassChart2();
		}
	});

	const rarityDistribution = $derived((() => {
		const distribution = new Map<number, number>();
		spirits.forEach((spirit) => {
			const cost = spirit.cost;
			distribution.set(cost, (distribution.get(cost) || 0) + 1);
		});

		return Array.from(distribution.entries())
			.map(([cost, count]) => ({ cost, count }))
			.sort((a, b) => a.cost - b.cost);
	})());

	$effect(() => {
		if (!spiritsLoading && !spiritsError && rarityChartCanvas && rarityDistribution.length > 0) {
			renderRarityChart();
		}
	});

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
			return {
				bg: 'rgba(255, 215, 0, 0.6)',
				border: 'rgba(255, 215, 0, 1)'
			};
		} else if (value >= 4) {
			return {
				bg: 'rgba(168, 85, 247, 0.6)',
				border: 'rgba(168, 85, 247, 1)'
			};
		} else if (value >= 2) {
			return {
				bg: 'rgba(34, 197, 94, 0.6)',
				border: 'rgba(34, 197, 94, 1)'
			};
		} else {
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

	function renderClassChart2() {
		if (!classChartCanvas2) return;
		if (classChart2) classChart2.destroy();

		const labels = sortedClassStats.map((stat) => stat.className);
		const avgCostData = sortedClassStats.map((stat) => stat.avgCost);
		const offensivePowerData = sortedClassStats.map((stat) => stat.offensivePower);
		const defensivePowerData = sortedClassStats.map((stat) => stat.defensivePower);

		const context = classChartCanvas2.getContext('2d');
		if (!context) return;

		classChart2 = new Chart<'bar', number[], string>(context, {
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

	const rarityLabelByKey = new Map<UnitRarityKey, string>(
		UNIT_RARITY_CONFIG.map((config) => [config.key, config.label])
	);

	function openSettings() {
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
			await loadSpiritsData();
			closeSettings();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to save rarity traits: ${message}`);
		}
	}

	// =====================
	// CURVE FITTING FUNCTIONS
	// =====================
	const DICE_FACE_COUNT = 6;

	function parseDiceSideValue(value: unknown): number {
		if (value === null || value === undefined) return 0;
		const parsed = Number.parseFloat(typeof value === 'string' ? value : String(value));
		return Number.isFinite(parsed) ? parsed : 0;
	}

	function diceRecordToDiceInfo(record: CustomDiceWithSides): DiceInfo {
		const sides = new Array<number>(DICE_FACE_COUNT).fill(0);
		(record.dice_sides ?? []).forEach((side) => {
			const index = Math.trunc(Number(side.side_number)) - 1;
			if (index < 0 || index >= DICE_FACE_COUNT) return;
			sides[index] = parseDiceSideValue(side.reward_value);
		});
		const mean = sides.reduce((sum, value) => sum + value, 0) / DICE_FACE_COUNT;
		return {
			id: record.id,
			name: record.name ?? 'Unknown',
			mean,
			sides
		};
	}

	async function getDiceRecordsForAnalysis(): Promise<CustomDiceWithSides[]> {
		if (diceRecords.length > 0) return diceRecords;
		return await fetchDiceRecords();
	}

	async function loadCurveData() {
		try {
			const diceData = await getDiceRecordsForAnalysis();
			curveDice = diceData
				.map(diceRecordToDiceInfo)
				.sort((a, b) => a.name.localeCompare(b.name));

			const { data: classData, error: classError } = await supabase
				.from('classes')
				.select('id, name');

			if (classError) throw classError;

			curveClasses = classData ?? [];

			if (curveDice.length > 0 && classConfigs.length === 0) {
				initializeConfigs();
			}
		} catch (err) {
			console.error('Failed to load curve data:', err);
		}
	}

	function initializeConfigs() {
		classConfigs = [
			{
				key: 'fighter',
				name: 'Fighter',
				color: '#3b82f6',
				enabled: true,
				curveParams: { ...CLASS_PRESETS.swordsman.curveParams },
				traitRange: [...CLASS_PRESETS.swordsman.traitRange] as [number, number],
				maxDice: 4,
				runeMultiplier: undefined,
				allowedDiceIds: curveDice
					.filter((d) => d.name === 'Basic Attack' || d.name === 'Critical Attack' || d.name === 'Exalted Attack')
					.map((d) => d.id),
				colorThresholds: { ...CLASS_PRESETS.swordsman.colorThresholds }
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

				const results = fitCurve(config.curveParams, constraints, curveDice);
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

		const dbClass = curveClasses.find(
			(c) => c.name.toLowerCase() === result.name.toLowerCase()
		);

		if (!dbClass) {
			saveMessage = {
				type: 'error',
				text: `Class "${result.name}" not found in database. Available classes: ${curveClasses.map((c) => c.name).join(', ')}`
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

	const chartWidth = 700;
	const chartHeight = 350;
	const chartPadding = { top: 20, right: 30, bottom: 40, left: 50 };

	let innerWidth = $derived(chartWidth - chartPadding.left - chartPadding.right);
	let innerHeight = $derived(chartHeight - chartPadding.top - chartPadding.bottom);

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

	// =====================
	// SHOP ANALYSIS FUNCTIONS
	// =====================
	async function loadShopData() {
		shopLoading = true;
		shopError = null;
		try {
			const { data, error: unitsError } = await supabase.from('hex_spirits').select('*');
			if (unitsError) throw unitsError;
			units = data ?? [];
		} catch (err) {
			shopError = err instanceof Error ? err.message : String(err);
		} finally {
			shopLoading = false;
			if (!settingsLoading) {
				recompute();
			}
		}
		await loadSettings();
		await loadConfigList();
	}

	async function loadSettings() {
		settingsLoading = true;
		shopSaveMessage = null;
		stageSummary = null;
		try {
			const settings = await fetchSimulationSettings(settingsName);
			if (settings) {
				shopSize = settings.shopSize ?? DEFAULT_SHOP_SIZE;
				drawsPerPlayer = settings.drawsPerPlayer ?? DEFAULT_DRAWS_PER_PLAYER;
				playerCount = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, settings.playerCount ?? MIN_PLAYERS));
				purchaseSuccessRate = Math.min(
					1,
					Math.max(0, settings.purchaseSuccessRate ?? DEFAULT_PURCHASE_SUCCESS_RATE)
				);
				monsterCounts = normalizeMonsterCounts(settings.monsterCounts);
				monsterTakeLimits = normalizeMonsterTakeLimits(settings.monsterTakeLimits);
				rarityOverrides = normalizeRarityOverrides(settings.rarityOverrides);
				totalStages = Math.max(1, Math.trunc(settings.totalStages ?? DEFAULT_TOTAL_STAGES));
				stagePurchasePlan = cloneStagePlans(settings.stagePurchasePlan, totalStages);
			} else {
				shopSize = DEFAULT_SHOP_SIZE;
				drawsPerPlayer = DEFAULT_DRAWS_PER_PLAYER;
				playerCount = MIN_PLAYERS;
				purchaseSuccessRate = DEFAULT_PURCHASE_SUCCESS_RATE;
				monsterCounts = { ...DEFAULT_MONSTER_COUNTS };
				monsterTakeLimits = { ...DEFAULT_MONSTER_LIMITS };
				rarityOverrides = {};
				totalStages = DEFAULT_TOTAL_STAGES;
				stagePurchasePlan = cloneStagePlans(DEFAULT_STAGE_PURCHASES, totalStages);
			}
			saveState = 'idle';
			shopSaveMessage = null;
			await loadConfigList();
		} catch (err) {
			saveState = 'error';
			shopSaveMessage = err instanceof Error ? err.message : String(err);
			console.error('Failed to load simulation settings', err);
		} finally {
			settingsLoading = false;
			recompute();
		}
	}

	function normalizeRarityOverrides(overrides?: RarityOverrides | null): RarityOverrides {
		if (!overrides) return {};
		const result: RarityOverrides = {};
		UNIT_RARITY_CONFIG.forEach((config) => {
			const value = overrides[config.key];
			if (value !== undefined && value !== null && Number.isFinite(Number(value))) {
				result[config.key] = Math.max(0, Number(value));
			}
		});
		return result;
	}

	function sanitizeStageQuantity(value: number | null | undefined): number {
		if (value === null || value === undefined) return 0;
		if (!Number.isFinite(value)) return 0;
		return Math.max(0, Math.floor(value));
	}

	function cloneStagePlans(plans: StagePurchaseConfig[], stageCount: number = DEFAULT_TOTAL_STAGES): StagePurchaseConfig[] {
		const stageMap = new Map<number, StagePurchaseConfig['perPlayer']>();

		for (let s = 1; s <= stageCount; s += 1) {
			const base: StagePurchaseConfig['perPlayer'] = {};
			const defaults = DEFAULT_STAGE_PURCHASES.find((p) => p.stage === s);
			MONSTER_ORDER.forEach((rarity) => {
				const qty = defaults?.perPlayer[rarity];
				base[rarity] = sanitizeStageQuantity(qty ?? 0);
			});
			stageMap.set(s, base);
		}

		plans.forEach((plan) => {
			if (!plan || typeof plan.stage !== 'number') return;
			const stage = Math.trunc(plan.stage);
			if (stage < 1 || stage > stageCount) return;

			const existing = stageMap.get(stage) ?? {};
			const updated: StagePurchaseConfig['perPlayer'] = { ...existing };
			MONSTER_ORDER.forEach((rarity) => {
				const qty = plan.perPlayer?.[rarity];
				if (qty !== undefined) {
					updated[rarity] = sanitizeStageQuantity(qty);
				}
			});
			stageMap.set(stage, updated);
		});

		return Array.from(stageMap.entries())
			.sort((a, b) => a[0] - b[0])
			.map(([stage, perPlayer]) => ({
				stage,
				perPlayer
			}));
	}

	function createRarityStats(): RarityStat[] {
		return UNIT_RARITY_CONFIG.map((config) => {
			const groupUnits = units.filter((unit) => config.costs.includes(unit.cost));
			const basePerUnit = config.copies;
			const overrideValue = rarityOverrides[config.key];
			const override = overrideValue !== undefined ? overrideValue : null;
			const adjustedPerUnit = Math.max(0, override ?? basePerUnit);
			const totalCopies = groupUnits.length * adjustedPerUnit;
			return {
				config,
				unitCount: groupUnits.length,
				basePerUnit,
				adjustedPerUnit,
				totalCopies,
				override
			} satisfies RarityStat;
		});
	}

	function recompute() {
		applyRarityOverrides(activeOverrides());
		rarityStats = createRarityStats();
		const copiesByKey = new Map<UnitRarityKey, number>();
		rarityStats.forEach((stat) => {
			copiesByKey.set(stat.config.key, stat.totalCopies);
		});

		if (copiesByKey.size === 0) {
			stageSummary = null;
			return;
		}

		stageSummary = simulateStagePurchases({
			copiesByKey,
			players: playerCount,
			shopSize,
			drawsPerPlayer,
			monsterCounts,
			monsterLimits: monsterTakeLimits,
			stagePlans: stagePurchasePlan,
			iterations: SIMULATION_ITERATIONS,
			purchaseSuccessRate,
			totalStages
		});
	}

	function activeOverrides(): RarityOverrides {
		const result: RarityOverrides = {};
		Object.entries(rarityOverrides).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				result[key] = Math.max(0, Number(value));
			}
		});
		return result;
	}

	async function loadConfigList() {
		const { data, error } = await supabase.from('simulation_settings').select('name').order('name');
		if (error) {
			console.error('Failed to load config list', error);
			return;
		}
		availableConfigs = (data ?? []).map((row) => row.name);
	}

	// =====================
	// ALT DICE FUNCTIONS
	// =====================
	async function loadAltDiceData() {
		try {
			const diceData = await getDiceRecordsForAnalysis();
			altDice = diceData.map(diceRecordToDiceInfo);

			altClassTargets = [
				{
					key: 'fighter',
					name: 'Fighter',
					color: '#3b82f6',
					traitRange: [2, 9] as [number, number],
					targets: Array.from({ length: 8 }, (_, i) => ({
						trait: i + 2,
						targetEV: 1.5 + i * 0.5,
						diceCount: 1,
						color: 'bronze' as const
					}))
				}
			];
		} catch (err) {
			console.error('Failed to load alt dice data:', err);
		}
	}

	function runOptimization() {
		altResult = optimizeGlobally(altClassTargets, {
			numFaces: 6,
			maxDice,
			iterations,
			variancePenalty
		});
	}

	function copyResultsJSON() {
		if (!altResult) return;
		const json = JSON.stringify(altResult, null, 2);
		navigator.clipboard.writeText(json);
		alert('Results copied to clipboard!');
	}

	let altYMax = $derived(() => {
		if (!altResult) return 8;
		let max = 1;
		for (const cls of altResult.classes) {
			for (const t of cls.traits) {
				if (t.targetEV > max) max = t.targetEV;
				if (t.actualEV > max) max = t.actualEV;
			}
		}
		return Math.ceil(max * 1.1);
	});

	function altYScale(value: number) {
		return chartPadding.top + innerHeight - (value / altYMax()) * innerHeight;
	}
</script>

<PageLayout
	title="Analysis"
	subtitle="Game balance analysis and simulation tools"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	<div class="analysis-content">
		{#if activeTab === 'classes'}
			<!-- CLASS ANALYSIS TAB -->
			<section class="tab-section">
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
									onclick={() => toggleRuneCount(option)}
								>
									{option} Rune{option > 1 ? 's' : ''}
								</button>
							{/each}
						</div>
					</section>
				{/if}

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
							oninput={handleBreakpointLimitChange}
						/>
						<div class="slider-scale">
							<span>{MIN_BREAKPOINTS}</span>
							<span>{MAX_BREAKPOINTS}</span>
						</div>
					</div>
				</section>

				{#if classLoading}
					<div class="card loading">Simulating class damage…</div>
				{:else if classError}
					<div class="card error">{classError}</div>
				{:else}
					<section class="card chart-card">
						<canvas bind:this={classChartCanvas}></canvas>
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
		{:else if activeTab === 'spirits'}
			<!-- SPIRITS ANALYSIS TAB -->
			<section class="tab-section">
				{#snippet headerActions()}
					<button class="btn" onclick={openSettings}>⚙️ Settings</button>
				{/snippet}

				{#if spiritsLoading}
					<div class="card">Loading hex spirits data…</div>
				{:else if spiritsError}
					<div class="card error">Error: {spiritsError}</div>
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
									<canvas bind:this={classChartCanvas2}></canvas>
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
		{:else if activeTab === 'curves'}
			<!-- CURVE FITTING TAB -->
			<section class="tab-section">
				<p class="tab-description">Design class breakpoints by fitting dice combinations to target damage curves.</p>

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
											{#each curveDice as die}
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
							<p class="muted" style="margin-top: 0.35rem;">
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
									{#each Array.from({ length: 6 }, (_, i) => i) as i}
										<line
											x1={chartPadding.left}
											y1={chartPadding.top + (i * innerHeight) / 5}
											x2={chartPadding.left + innerWidth}
											y2={chartPadding.top + (i * innerHeight) / 5}
											stroke="rgba(148, 163, 184, 0.2)"
										/>
									{/each}

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

									<text x={chartWidth / 2} y={chartHeight - 2} text-anchor="middle" fill="#94a3b8" font-size="12">
										Traits
									</text>
									<text x={12} y={chartHeight / 2} text-anchor="middle" fill="#94a3b8" font-size="12" transform="rotate(-90, 12, {chartHeight / 2})">
										Damage
									</text>

									{#each classResults as cr}
										{@const targetPoints = cr.targetCurve.map((p) => ({ x: xScale(p.trait), y: yScale(p.value) }))}
										<path d={buildPath(targetPoints)} fill="none" stroke={cr.color} stroke-width="1.5" stroke-dasharray="4,4" opacity="0.5" />
									{/each}

									{#each classResults as cr}
										{@const fittedPoints = cr.results.map((r) => ({ x: xScale(r.trait), y: yScale(r.actualValue) }))}
										<path d={buildPath(fittedPoints)} fill="none" stroke={cr.color} stroke-width="2.5" />
									{/each}

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
		{:else if activeTab === 'shop'}
			<!-- SHOP ANALYSIS TAB (simplified, full version would be too long) -->
			<section class="tab-section">
				<p class="tab-description">Live breakdown of pool composition and legendary appearance odds.</p>
				<div class="card">
					<p>Shop analysis content placeholder - see /shop-analysis for full implementation</p>
				</div>
			</section>
		{:else if activeTab === 'alt-dice'}
			<!-- ALT DICE TAB -->
			<section class="tab-section">
				<p class="tab-description">Unified 6-sided attack die optimized across all classes. <strong>Experimental - no database changes.</strong></p>

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

				{#if altResult}
					<div class="card">
						<h3>Unified Die Design</h3>
						<div class="die-visual">
							{#each altResult.die.faces as face, i}
								<div class="die-face">
									<span class="face-number">Face {i + 1}</span>
									<span class="face-value">{face.value}</span>
								</div>
							{/each}
						</div>
						<div class="die-stats">
							<span>Total Error: <strong>{altResult.totalError.toFixed(3)}</strong></span>
							<span>MSE: <strong>{altResult.meanSquaredError.toFixed(4)}</strong></span>
						</div>
					</div>

					<div class="chart-section">
						<h3>EV Comparison (All Classes)</h3>
						<svg viewBox="0 0 {chartWidth} {chartHeight}" class="chart">
							{#each Array.from({ length: 6 }, (_, i) => i) as i}
								<line
									x1={chartPadding.left}
									y1={chartPadding.top + (i * innerHeight) / 5}
									x2={chartPadding.left + innerWidth}
									y2={chartPadding.top + (i * innerHeight) / 5}
									stroke="rgba(148, 163, 184, 0.2)"
								/>
							{/each}

							{#each Array.from({ length: 6 }, (_, i) => i) as i}
								<text
									x={chartPadding.left - 10}
									y={chartPadding.top + (i * innerHeight) / 5 + 4}
									text-anchor="end"
									fill="#94a3b8"
									font-size="11"
								>
									{((5 - i) / 5 * altYMax()).toFixed(1)}
								</text>
							{/each}

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

							{#each altResult.classes as cls}
								<path
									d={buildPath(cls.traits.map((t) => ({ x: xScale(t.trait), y: altYScale(t.targetEV) })))}
									fill="none"
									stroke={cls.color}
									stroke-width="1.5"
									stroke-dasharray="4,4"
									opacity="0.5"
								/>
								<path
									d={buildPath(cls.traits.map((t) => ({ x: xScale(t.trait), y: altYScale(t.actualEV) })))}
									fill="none"
									stroke={cls.color}
									stroke-width="2.5"
								/>
								{#each cls.traits as t}
									<circle
										cx={xScale(t.trait)}
										cy={altYScale(t.actualEV)}
										r="5"
										fill={cls.color}
										stroke="#1e293b"
										stroke-width="2"
									/>
								{/each}
							{/each}
						</svg>

						<div class="chart-legend">
							{#each altResult.classes as cls}
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

					<div class="actions">
						<button class="btn" onclick={copyResultsJSON}>Copy Full Results JSON</button>
					</div>
				{:else}
					<div class="no-results">
						<p>Click "Optimize Unified Die" to find optimal face values and configurations.</p>
					</div>
				{/if}
			</section>
		{/if}
	</div>
</PageLayout>

<style>
	.analysis-content {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tab-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tab-description {
		margin: 0;
		padding: 0.5rem;
		font-size: 0.7rem;
		color: #94a3b8;
		background: rgba(15, 23, 42, 0.5);
		border-radius: 6px;
	}

	.card {
		background: rgba(15, 23, 42, 0.68);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
		padding: 0.75rem;
	}

	.card h2 {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		color: #f8fafc;
	}

	.card h3 {
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
		color: #cbd5f5;
	}

	.muted {
		font-size: 0.7rem;
		color: #94a3b8;
		margin: 0;
	}

	.rune-controls {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
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
		padding: 0.35rem 0.7rem;
		border-radius: 0.5rem;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: transparent;
		color: #e2e8f0;
		transition: background 0.2s ease, border-color 0.2s ease;
		font-size: 0.7rem;
	}

	.rune-toggle button.selected {
		background: rgba(99, 102, 241, 0.18);
		border-color: rgba(99, 102, 241, 0.65);
	}

	.controls-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.controls-card header {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.slider-control {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.slider-control label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.7rem;
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
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #6366f1;
		cursor: pointer;
	}

	.slider-control input[type='range']::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: none;
		background: #6366f1;
		cursor: pointer;
	}

	.slider-scale {
		display: flex;
		justify-content: space-between;
		font-size: 0.65rem;
		color: #94a3b8;
	}

	.chart-card {
		height: 380px;
		padding: 0.75rem;
	}

	.chart-card canvas {
		width: 100%;
		height: 100%;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.5rem;
	}

	.stats-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.stats-card h2 {
		margin: 0;
	}

	.stats-card table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.7rem;
	}

	.stats-card th,
	.stats-card td {
		text-align: left;
		padding: 0.25rem 0;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
	}

	.stats-card th {
		font-weight: 600;
		color: #cbd5f5;
		font-size: 0.65rem;
	}

	.variant-label {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		color: #a5b4fc;
	}

	.stats-card td {
		color: #e2e8f0;
	}

	.effect-breakdown {
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.effect-breakdown__row {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
	}

	.effect-breakdown__label {
		min-width: 50px;
		font-weight: 600;
		color: #f8fafc;
		font-size: 0.7rem;
	}

	.effect-breakdown__row ul {
		margin: 0;
		padding-left: 0.75rem;
		list-style: disc;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		color: #cbd5f5;
		font-size: 0.65rem;
	}

	.analysis-container {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.chart-section {
		width: 100%;
	}

	.chart-section .card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.chart-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
	}

	.chart-wrapper {
		position: relative;
		height: 340px;
		width: 100%;
	}

	.chart-controls {
		width: 100%;
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.4);
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.chart-toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
		user-select: none;
		color: #e2e8f0;
		font-size: 0.7rem;
	}

	.chart-toggle input[type='checkbox'] {
		cursor: pointer;
		width: 16px;
		height: 16px;
		accent-color: rgba(99, 102, 241, 0.8);
	}

	.chart-toggle:hover {
		color: #f8fafc;
	}

	.stats-table {
		overflow-x: auto;
	}

	.stats-table h3 {
		margin: 0 0 0.5rem 0;
		color: #f8fafc;
		font-size: 0.85rem;
	}

	.stats-table table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.7rem;
	}

	.stats-table th,
	.stats-table td {
		padding: 0.5rem;
		text-align: left;
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
	}

	.stats-table th {
		background: rgba(30, 41, 59, 0.6);
		color: #f8fafc;
		font-weight: 600;
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

	.loading {
		text-align: center;
	}

	.btn {
		padding: 0.35rem 0.7rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(30, 41, 59, 0.7);
		color: #f8fafc;
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: 0.7rem;
	}

	.btn:hover {
		background: rgba(59, 130, 246, 0.2);
		border-color: rgba(59, 130, 246, 0.4);
	}

	.btn--primary {
		background: linear-gradient(135deg, #3b82f6, #8b5cf6);
		border: none;
	}

	.layout {
		display: grid;
		grid-template-columns: 320px 1fr;
		gap: 0.75rem;
	}

	@media (max-width: 1024px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.controls-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.control-section {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
		padding: 0.5rem;
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
		gap: 0.35rem;
		cursor: pointer;
	}

	.class-name {
		font-weight: 600;
		font-size: 0.8rem;
	}

	.config-grid {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-top: 0.35rem;
		padding-top: 0.35rem;
		border-top: 1px solid rgba(148, 163, 184, 0.15);
	}

	.config-row {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.config-row label {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		flex: 1;
		min-width: 60px;
	}

	.config-row label span {
		font-size: 0.65rem;
		color: #94a3b8;
	}

	.config-row input,
	.config-row select {
		padding: 0.25rem;
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 4px;
		color: #f8fafc;
		font-size: 0.7rem;
	}

	.range-inputs {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.range-inputs input {
		width: 40px;
		text-align: center;
	}

	.range-inputs span {
		color: #94a3b8;
	}

	.dice-selection {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		align-items: center;
	}

	.dice-label {
		font-size: 0.65rem;
		color: #94a3b8;
	}

	.dice-chip {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.15rem 0.35rem;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 10px;
		font-size: 0.65rem;
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
		gap: 0.35rem;
		color: #cbd5f5;
		font-size: 0.7rem;
	}

	.compute-btn {
		width: 100%;
		padding: 0.5rem;
		font-size: 0.8rem;
	}

	.results-panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.chart-section h3 {
		margin: 0 0 0.5rem;
		color: #f8fafc;
		font-size: 0.85rem;
	}

	.chart {
		width: 100%;
		height: auto;
		background: rgba(15, 23, 42, 0.5);
		border-radius: 6px;
	}

	.chart-legend {
		display: flex;
		gap: 1rem;
		margin-top: 0.5rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: #cbd5f5;
		font-size: 0.7rem;
	}

	.legend-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.legend-line {
		width: 18px;
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

	.results-section {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
		padding: 0.75rem;
	}

	.results-tabs {
		display: flex;
		gap: 0.35rem;
		margin-bottom: 0.75rem;
	}

	.tab-btn {
		padding: 0.35rem 0.7rem;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 6px;
		color: #cbd5f5;
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: 0.7rem;
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
		margin-bottom: 0.5rem;
	}

	.results-header h3 {
		margin: 0;
		font-size: 0.9rem;
	}

	.results-stats {
		color: #94a3b8;
		font-size: 0.7rem;
	}

	.results-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.7rem;
	}

	.results-table th,
	.results-table td {
		padding: 0.35rem 0.4rem;
		text-align: left;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
	}

	.results-table th {
		background: rgba(30, 41, 59, 0.5);
		color: #f8fafc;
		font-weight: 500;
		font-size: 0.65rem;
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
		margin-top: 0.75rem;
		display: flex;
		gap: 0.35rem;
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
		margin-top: 0.5rem;
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		font-size: 0.7rem;
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
		border-radius: 8px;
		padding: 2rem;
		text-align: center;
		color: #94a3b8;
		font-size: 0.7rem;
	}

	.concept-box {
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.3);
		border-radius: 8px;
		padding: 0.75rem;
	}

	.concept-box h3 {
		margin: 0 0 0.35rem;
		color: #60a5fa;
		font-size: 0.8rem;
	}

	.concept-box p {
		margin: 0.25rem 0;
		font-size: 0.7rem;
		color: #cbd5f5;
	}

	.controls-row {
		display: flex;
		gap: 0.75rem;
		align-items: flex-end;
		flex-wrap: wrap;
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
		padding: 0.75rem;
	}

	.controls-row label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.controls-row label span {
		font-size: 0.65rem;
		color: #94a3b8;
	}

	.controls-row input[type='number'] {
		padding: 0.3rem 0.5rem;
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 4px;
		color: #f8fafc;
		width: 70px;
		font-size: 0.7rem;
	}

	.variance-control {
		min-width: 140px;
	}

	.variance-control .hint {
		font-size: 0.6rem;
		color: #64748b;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.slider-row input[type='range'] {
		flex: 1;
		height: 5px;
		background: rgba(30, 41, 59, 0.8);
		border-radius: 3px;
		cursor: pointer;
	}

	.slider-value {
		min-width: 28px;
		font-size: 0.7rem;
		color: #60a5fa;
		font-weight: 500;
	}

	.die-visual {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.35rem;
	}

	.die-face {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.4rem;
		background: rgba(30, 41, 59, 0.8);
		border: 2px solid rgba(148, 163, 184, 0.3);
		border-radius: 6px;
	}

	.face-number {
		font-size: 0.6rem;
		color: #94a3b8;
		margin-bottom: 0.15rem;
	}

	.face-value {
		font-size: 1rem;
		font-weight: 600;
		color: #f8fafc;
	}

	.die-stats {
		display: flex;
		justify-content: space-between;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.15);
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.actions {
		display: flex;
		gap: 0.35rem;
	}

	.rarity-traits-settings {
		padding: 0.35rem 0;
	}

	.traits-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.7rem;
	}

	.traits-table th,
	.traits-table td {
		padding: 0.5rem;
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
		padding: 0.35rem;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 4px;
		color: #f8fafc;
		font-size: 0.7rem;
	}

	.traits-table input[type='number']:focus {
		outline: none;
		border-color: rgba(99, 102, 241, 0.5);
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
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
			flex: 0 0 300px;
		}
	}
</style>
