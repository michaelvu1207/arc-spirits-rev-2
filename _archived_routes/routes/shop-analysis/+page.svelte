<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/api/supabaseClient';
  import type { UnitRow } from '$lib/types/gameData';
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

  type Unit = UnitRow;

  const SIMULATION_ITERATIONS = 20000;

  export let initialUnits: Unit[] | undefined;

  let units: Unit[] = [];
  let loading = true;
  let error: string | null = null;

  const RARITY_KEYS: MonsterKey[] = UNIT_RARITY_CONFIG.map((config) => config.key as MonsterKey);

  let playerCount = MIN_PLAYERS;
  let shopSize = DEFAULT_SHOP_SIZE;
  let drawsPerPlayer = DEFAULT_DRAWS_PER_PLAYER;
  let purchaseSuccessRate = DEFAULT_PURCHASE_SUCCESS_RATE;

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
  let saveMessage: string | null = null;
  let showSettingsModal = false;
  let availableConfigs: string[] = [];
  let newConfigName = '';

const rarityLabelByKey = new Map<UnitRarityKey, string>(
  UNIT_RARITY_CONFIG.map((config) => [config.key, config.label])
);

const rarityColors: Record<UnitRarityKey, string> = {
  common: 'rgba(96, 165, 250, 0.85)',
  rare: 'rgba(129, 140, 248, 0.85)',
  epic: 'rgba(192, 132, 252, 0.85)',
  legendary: 'rgba(249, 115, 22, 0.85)',
  mythic: 'rgba(236, 72, 153, 0.85)',
  unknown: 'rgba(148, 163, 184, 0.7)'
};

const POOL_TREND_COLOR = 'rgba(56, 189, 248, 0.85)';

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

  // seed with defaults
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

function findStageConfig(stage: number): StagePurchaseConfig | undefined {
  return stagePurchasePlan.find((plan) => plan.stage === stage);
}

function getStagePlanValue(stage: number, rarity: UnitRarityKey | typeof MONSTER_ORDER[number]): number {
  const rarityKey = rarity as UnitRarityKey;
  const plan = findStageConfig(stage);
  return sanitizeStageQuantity(plan?.perPlayer?.[rarityKey] ?? 0);
}

function handleStagePlanInput(
  stage: number,
  rarity: UnitRarityKey | typeof MONSTER_ORDER[number],
  value: number
) {
  const rarityKey = rarity as UnitRarityKey;
  const sanitized = sanitizeStageQuantity(value);
  stagePurchasePlan = stagePurchasePlan.map((plan) => {
    if (plan.stage !== stage) return plan;
    return {
      stage: plan.stage,
      perPlayer: {
        ...plan.perPlayer,
        [rarityKey]: sanitized
      }
    };
  });
  recompute();
}

function resetStagePlan(stage: number) {
  const defaults = DEFAULT_STAGE_PURCHASES.find((plan) => plan.stage === stage);
  if (!defaults) return;
  stagePurchasePlan = stagePurchasePlan.map((plan) => {
    if (plan.stage !== stage) return plan;
    const perPlayer: StagePurchaseConfig['perPlayer'] = {};
    MONSTER_ORDER.forEach((rarity) => {
      perPlayer[rarity] = sanitizeStageQuantity(defaults.perPlayer[rarity] ?? 0);
    });
    return { stage, perPlayer };
  });
  recompute();
}

function formatNumber(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return '0.00';
  return value.toFixed(decimals);
}

function stageTotal(snapshot: StageSimulationResult['stageSnapshots'][number]): number {
  return MONSTER_ORDER.reduce((sum, rarity) => sum + (snapshot.counts[rarity] ?? 0), 0);
}

function stagePoolTotal(snapshot: StageSimulationResult['stageSnapshots'][number]): number {
  return MONSTER_ORDER.reduce((sum, rarity) => sum + (snapshot.poolCounts[rarity] ?? 0), 0);
}

function stagePlayerTotal(snapshot: StageSimulationResult['stageSnapshots'][number]): number {
  return MONSTER_ORDER.reduce((sum, rarity) => sum + (snapshot.playerCounts[rarity] ?? 0), 0);
}

function stageMonsterTotal(snapshot: StageSimulationResult['stageSnapshots'][number]): number {
  return MONSTER_ORDER.reduce((sum, rarity) => sum + (snapshot.monsterCounts[rarity] ?? 0), 0);
}

function maxRecordValue(record: Record<UnitRarityKey, number>): number {
  return MONSTER_ORDER.reduce((max, rarity) => Math.max(max, record[rarity] ?? 0), 0);
}

function stageLabel(snapshot: StageSimulationResult['stageSnapshots'][number]): string {
  return snapshot.stage === 0 ? 'Stage 0 (Initial Shop)' : `Stage ${snapshot.stage}`;
}

function shortStageLabel(stage: number): string {
  return stage === 0 ? 'Stage 0' : `Stage ${stage}`;
}

function monsterCountFor(rarity: MonsterKey): number {
  const settingsValue = monsterCounts[rarity] ?? 0;
  const simulatedValue = stageSummary?.monsterConfig?.[rarity];
  if (typeof simulatedValue === 'number' && simulatedValue === settingsValue) {
    return Math.max(0, simulatedValue);
  }
  return Math.max(0, settingsValue);
}

function monsterLimitFor(rarity: MonsterKey): number {
  const settingsValue = monsterTakeLimits[rarity];
  const base = settingsValue ?? DEFAULT_MONSTER_LIMITS[rarity];
  const simulatedValue = stageSummary?.monsterLimitConfig?.[rarity];
  const value =
    typeof simulatedValue === 'number' && simulatedValue === settingsValue ? simulatedValue : base;
  if (value === -1) return Number.POSITIVE_INFINITY;
  return Math.max(0, value);
}

function monsterMaxCards(rarity: MonsterKey): number {
  const count = monsterCountFor(rarity);
  const limit = monsterLimitFor(rarity);
  if (!Number.isFinite(limit)) return Number.POSITIVE_INFINITY;
  return count * limit;
}

function formatLimit(value: number): string {
  return Number.isFinite(value) ? String(value) : '∞';
}

function formatMaxCards(value: number): string {
  return Number.isFinite(value) ? String(value) : '∞';
}

$: stageSnapshotRows =
  stageSummary?.stageSnapshots
    .filter((snapshot) => snapshot.stage >= 0 && snapshot.stage <= totalStages)
    .sort((a, b) => a.stage - b.stage) ?? [];

$: stageLabels = stageSnapshotRows.map((snapshot) => shortStageLabel(snapshot.stage));

$: rarityPercentages = MONSTER_ORDER.map((rarity) => ({
  rarity,
  values: stageSnapshotRows.map((snapshot) => {
    const total = stageTotal(snapshot);
    if (total <= 0) return 0;
    return ((snapshot.counts[rarity] ?? 0) / total) * 100;
  })
}));

$: rarityStackedDatasets =
  stageLabels.length === 0
    ? []
    : rarityPercentages.map((entry) => ({
        label: rarityLabelByKey.get(entry.rarity) ?? entry.rarity,
        data: entry.values,
        backgroundColor: entry.values.map(() => rarityColors[entry.rarity]),
        hoverBackgroundColor: entry.values.map(() => rarityColors[entry.rarity])
      }));

$: poolTrend = stageSnapshotRows.map((snapshot) => snapshot.poolRemaining ?? 0);

$: poolCountDatasets =
  stageLabels.length === 0
    ? []
    : MONSTER_ORDER.map((rarity) => ({
        label: rarityLabelByKey.get(rarity) ?? rarity,
        data: stageSnapshotRows.map((snapshot) => snapshot.poolCounts[rarity] ?? 0),
        backgroundColor: stageSnapshotRows.map(() => rarityColors[rarity]),
        hoverBackgroundColor: stageSnapshotRows.map(() => rarityColors[rarity])
      }));

$: maxPoolCount =
  stageSnapshotRows.length === 0 ? 0 : Math.max(...stageSnapshotRows.map((snapshot) => stagePoolTotal(snapshot)));

$: monsterHoldingsTotals = stageSnapshotRows.map((snapshot) => stageMonsterTotal(snapshot));

$: monsterHoldingsDatasets =
  stageLabels.length === 0
    ? []
    : MONSTER_ORDER.map((rarity) => ({
        label: rarityLabelByKey.get(rarity) ?? rarity,
        data: stageSnapshotRows.map((snapshot) => snapshot.monsterCounts[rarity] ?? 0),
        backgroundColor: stageSnapshotRows.map(() => rarityColors[rarity]),
        hoverBackgroundColor: stageSnapshotRows.map(() => rarityColors[rarity])
      }));

$: stagePlayerDeltas = stageSnapshotRows.map((snapshot, index) => {
  const prev = index > 0 ? stageSnapshotRows[index - 1] : null;
  const deltas: Record<UnitRarityKey, number> = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    mythic: 0,
    unknown: 0
  };
  MONSTER_ORDER.forEach((rarity) => {
    const current = snapshot.playerCounts[rarity] ?? 0;
    const prevVal = prev?.playerCounts[rarity] ?? 0;
    deltas[rarity] = current - prevVal;
  });
  return { stage: snapshot.stage, deltas };
});

$: playerPurchasesDatasets =
  stageLabels.length === 0
    ? []
    : MONSTER_ORDER.map((rarity) => ({
        label: `${rarityLabelByKey.get(rarity) ?? rarity} (avg per player)` ,
        data: stagePlayerDeltas.map((row) => (row.deltas[rarity] ?? 0) / Math.max(playerCount, 1)),
        backgroundColor: stagePlayerDeltas.map(() => rarityColors[rarity]),
        hoverBackgroundColor: stagePlayerDeltas.map(() => rarityColors[rarity])
      }));

$: maxPlayerPurchases = stagePlayerDeltas.length === 0
  ? 0
  : Math.max(
      ...stagePlayerDeltas.map((row) =>
        MONSTER_ORDER.reduce((sum, rarity) => sum + ((row.deltas[rarity] ?? 0) / Math.max(playerCount, 1)), 0)
      )
    );

$: playerHoldingsDatasets =
  stageLabels.length === 0
    ? []
    : MONSTER_ORDER.map((rarity) => ({
        label: rarityLabelByKey.get(rarity) ?? rarity,
        data: stageSnapshotRows.map((snapshot) => (snapshot.playerCounts[rarity] ?? 0) / Math.max(playerCount, 1)),
        backgroundColor: stageSnapshotRows.map(() => rarityColors[rarity]),
        hoverBackgroundColor: stageSnapshotRows.map(() => rarityColors[rarity])
      }));

$: maxPlayerHoldings = stageSnapshotRows.length === 0
  ? 0
  : Math.max(
      ...stageSnapshotRows.map((snapshot) =>
        MONSTER_ORDER.reduce(
          (sum, rarity) => sum + ((snapshot.playerCounts[rarity] ?? 0) / Math.max(playerCount, 1)),
          0
        )
      )
    );

interface RarityStat {
  config: UnitRarityConfig;
  unitCount: number;
  basePerUnit: number;
  adjustedPerUnit: number;
  totalCopies: number;
  override: number | null;
}

  if (initialUnits) {
    units = [...initialUnits];
    loading = false;
  }

  onMount(async () => {
    if (!initialUnits) {
      await loadUnits();
    }
    await loadSettings();
    await loadConfigList();
  });

async function loadUnits() {
    loading = true;
    error = null;
    try {
      const { data, error: unitsError } = await supabase.from('hex_spirits').select('*');
      if (unitsError) throw unitsError;
      units = data ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
      if (!settingsLoading) {
        recompute();
      }
    }
  }

async function loadSettings() {
  settingsLoading = true;
  saveMessage = null;
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
    saveMessage = null;
    await loadConfigList();
    } catch (err) {
      saveState = 'error';
      saveMessage = err instanceof Error ? err.message : String(err);
      console.error('Failed to load simulation settings', err);
    } finally {
      settingsLoading = false;
      recompute();
    }
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

  function handlePlayerCount(delta: number) {
    const requested = playerCount + delta;
    playerCount = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, requested));
    recompute();
  }

  function adjustShopSize(delta: number) {
    const next = Math.max(1, shopSize + delta);
    shopSize = next;
    recompute();
  }

function adjustDrawsPerPlayer(delta: number) {
  const next = Math.max(0, drawsPerPlayer + delta);
  drawsPerPlayer = next;
  recompute();
}

function adjustTotalStages(delta: number) {
  const next = Math.max(1, totalStages + delta);
  if (next === totalStages) return;
  totalStages = next;
  stagePurchasePlan = cloneStagePlans(stagePurchasePlan, totalStages);
  recompute();
}

function adjustMonsterCount(key: MonsterKey, delta: number) {
  const current = monsterCounts[key] ?? 0;
  const next = Math.max(0, current + delta);
  monsterCounts = { ...monsterCounts, [key]: next };
  recompute();
}

function resetMonsterCount(key: MonsterKey) {
  monsterCounts = { ...monsterCounts, [key]: 0 };
  recompute();
}

function adjustMonsterTakeLimit(key: MonsterKey, delta: number) {
  const currentRaw = monsterTakeLimits[key];
  const current = currentRaw === -1 ? DEFAULT_MONSTER_LIMITS[key] ?? 0 : currentRaw ?? 0;
  const next = Math.max(0, current + delta);
  monsterTakeLimits = { ...monsterTakeLimits, [key]: next };
  recompute();
}

function resetMonsterTakeLimit(key: MonsterKey) {
  monsterTakeLimits = { ...monsterTakeLimits, [key]: DEFAULT_MONSTER_LIMITS[key] ?? 0 };
  recompute();
}

function setMonsterNoLimit(key: MonsterKey) {
  monsterTakeLimits = { ...monsterTakeLimits, [key]: -1 };
  recompute();
}

function adjustCopiesOverride(key: UnitRarityKey, delta: number) {
  const stat = rarityStats.find((item) => item.config.key === key);
  if (!stat) return;
  const current = rarityOverrides[key] ?? stat.basePerUnit;
  const next = Math.max(0, current + delta);
  rarityOverrides = { ...rarityOverrides, [key]: next };
  recompute();
}

function resetCopiesOverride(key: UnitRarityKey) {
  const { [key]: _removed, ...rest } = rarityOverrides;
  rarityOverrides = rest;
  recompute();
}

function openSettings() {
  showSettingsModal = true;
}

function closeSettings() {
  showSettingsModal = false;
}

async function loadConfigList() {
  const { data, error } = await supabase.from('simulation_settings').select('name').order('name');
  if (error) {
    console.error('Failed to load config list', error);
    return;
  }
  availableConfigs = (data ?? []).map((row) => row.name);
}

async function handleLoadConfig(name: string) {
  settingsName = name;
  await loadSettings();
}

async function handleSaveAs() {
  const trimmed = newConfigName.trim();
  if (!trimmed) return;
  settingsName = trimmed;
  await handleSave();
  newConfigName = '';
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showSettingsModal) {
    event.preventDefault();
    closeSettings();
  }
}

async function handleSave() {
  saveState = 'saving';
  saveMessage = null;
  try {
    const payload: SimulationSettingsData = {
      name: settingsName,
      shopSize,
      drawsPerPlayer,
      playerCount,
      purchaseSuccessRate,
      monsterCounts,
      monsterTakeLimits,
      rarityOverrides,
      totalStages,
      stagePurchasePlan: cloneStagePlans(stagePurchasePlan, totalStages),
      metadata: {}
    };
    const saved = await upsertSimulationSettings(payload);
    shopSize = saved.shopSize ?? DEFAULT_SHOP_SIZE;
    drawsPerPlayer = saved.drawsPerPlayer ?? DEFAULT_DRAWS_PER_PLAYER;
    monsterCounts = normalizeMonsterCounts(saved.monsterCounts);
    monsterTakeLimits = normalizeMonsterTakeLimits(saved.monsterTakeLimits);
    rarityOverrides = normalizeRarityOverrides(saved.rarityOverrides);
    await loadConfigList();
    saveState = 'saved';
    saveMessage = 'Settings saved';
  } catch (err) {
    saveState = 'error';
    saveMessage = err instanceof Error ? err.message : String(err);
    console.error('Failed to save simulation settings', err);
  } finally {
    recompute();
    if (saveState === 'saved') {
      setTimeout(() => {
        saveState = 'idle';
        saveMessage = null;
      }, 2000);
    }
  }
}


</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<section class="page">
  <header class="page__header">
    <div>
      <h1>Shop Analysis</h1>
      <p>Live breakdown of pool composition and legendary appearance odds using current Supabase data.</p>
    </div>

    <div class="header-actions">
      <ul class="settings-summary">
        <li>
          <span class="settings-summary__label">Players</span>
          <span class="settings-summary__value">{playerCount}</span>
        </li>
        <li>
          <span class="settings-summary__label">Shop Size</span>
          <span class="settings-summary__value">{shopSize}</span>
        </li>
        <li>
          <span class="settings-summary__label">Setup Draws</span>
          <span class="settings-summary__value">{drawsPerPlayer}</span>
        </li>
        <li>
          <span class="settings-summary__label">Success Rate</span>
          <span class="settings-summary__value">{(purchaseSuccessRate * 100).toFixed(0)}%</span>
        </li>
      </ul>
      <button class="btn primary" type="button" on:click={openSettings}>Open Settings</button>
    </div>

    <div class="config-bar">
      <div class="config-presets">
        <span class="config-label">Quick Players</span>
        {#each [3,4,5,6] as p}
          <button class={`btn secondary small ${playerCount === p ? 'is-active' : ''}`} type="button" on:click={() => { playerCount = p; recompute(); }}>
            {p}p
          </button>
        {/each}
      </div>
      <div class="config-list">
        <span class="config-label">Load Config</span>
        {#if availableConfigs.length === 0}
          <span class="muted">None saved</span>
        {:else}
          {#each availableConfigs as cfg}
            <button class={`btn tertiary small ${settingsName === cfg ? 'is-active' : ''}`} type="button" on:click={() => handleLoadConfig(cfg)}>
              {cfg}
            </button>
          {/each}
        {/if}
      </div>
      <div class="config-save">
        <input
          class="input"
          type="text"
          placeholder="Save as…"
          bind:value={newConfigName}
          on:keydown={(e) => e.key === 'Enter' && handleSaveAs()}
        />
        <button class="btn" type="button" on:click={handleSaveAs}>Save As</button>
      </div>
    </div>
  </header>

  {#if loading}
    <div class="card loading">Loading units…</div>
  {:else if error}
    <div class="card error">Error: {error}</div>
  {:else}
    <section class="analysis">
      {#if stageSummary}
        <section class="card chart-card chart-card--full">
          <h2>Pool Size by Stage</h2>
          {#if stageLabels.length > 0}
            <StageBarChart
              title="Pool Size by Stage"
              labels={stageLabels}
              datasets={poolCountDatasets}
              stacked={true}
              showLegend={true}
              max={Math.max(maxPoolCount, 1)}
              height={360}
            />
          {:else}
            <p class="chart-empty">No stage data available.</p>
          {/if}
        </section>

        <section class="card chart-card chart-card--full">
          <h2>Rarity Share per Stage</h2>
          {#if stageLabels.length > 0}
            <StageBarChart
              title="Rarity Share per Stage"
              labels={stageLabels}
              datasets={rarityStackedDatasets}
              stacked={true}
              showLegend={true}
              max={100}
              height={360}
            />
            <p class="chart-footnote">
              Stacked bars show the expected shop composition by rarity at the start of each stage (post-monster phase).
            </p>
          {:else}
            <p class="chart-empty">No stage data available.</p>
          {/if}
        </section>

        <section class="card chart-card chart-card--full">
          <h2>Monster Holdings per Stage</h2>
          {#if stageLabels.length > 0}
            <StageBarChart
              title="Monster Holdings per Stage"
              labels={stageLabels}
              datasets={monsterHoldingsDatasets}
              stacked={true}
              showLegend={true}
              max={Math.max(...monsterHoldingsTotals, 1)}
              height={320}
            />
            <p class="chart-footnote">
              Stacked bars show how many spirits of each rarity monsters collectively hold after each stage.
            </p>
          {:else}
            <p class="chart-empty">No stage data available.</p>
          {/if}
        </section>

        <section class="card chart-card chart-card--full">
          <h2>Player Purchases per Stage</h2>
          {#if stageLabels.length > 0}
            <StageBarChart
              title="Player Purchases per Stage"
              labels={stageLabels}
              datasets={playerPurchasesDatasets}
              stacked={true}
              showLegend={true}
              max={Math.max(maxPlayerPurchases, 1)}
              height={320}
            />
            <p class="chart-footnote">
              Stacked bars show expected player purchases per stage by rarity (not cumulative).
            </p>
          {:else}
            <p class="chart-empty">No stage data available.</p>
          {/if}
        </section>

        <section class="card chart-card chart-card--full">
          <h2>Player Holdings per Stage</h2>
          {#if stageLabels.length > 0}
            <StageBarChart
              title="Player Holdings per Stage"
              labels={stageLabels}
              datasets={playerHoldingsDatasets}
              stacked={true}
              showLegend={true}
              max={Math.max(maxPlayerHoldings, 1)}
              height={320}
            />
            <p class="chart-footnote">
              Average cards held per player by stage (cumulative, stacked by rarity).
            </p>
          {:else}
            <p class="chart-empty">No stage data available.</p>
          {/if}
        </section>
        <section class="card probability">
          <h2>Expected Shop Composition</h2>
          <p>
            Total cards in pool: <strong>{stageSummary.totalCopies}</strong>. After the initial setup draws,
            <strong>{formatNumber(stageSummary.remainingCopiesAfterSetup)}</strong> remain in the pool.
          </p>
          <p>
            Players consume <strong>{formatNumber(stageSummary.drawsConsumed)}</strong> cost 1-3 spirits during setup.{' '}
            {#if stageSummary.drawsShortfall > 0}
              <span class="warning">
                Not enough cost 1-3 copies for setup ({formatNumber(stageSummary.drawsShortfall)} short).
              </span>
            {/if}
          </p>

          <div class="monster-summary">
            <h3>Configured Monsters</h3>
            <ul>
              {#each MONSTER_ORDER as rarity}
                <li>
                  <span class="monster-summary__label">{rarityLabelByKey.get(rarity) ?? rarity}</span>
                  <span class="monster-summary__value">
                    {monsterCountFor(rarity)} monsters · limit {monsterLimitFor(rarity)} · max {monsterMaxCards(rarity)} cards
                  </span>
                </li>
              {/each}
            </ul>
          </div>

          <p class="stage-summary-intro">
            Expected shop and pool composition after stages 0–{totalStages} with the configured purchase plan.
          </p>

          <div class="stage-results">
            {#if stageSnapshotRows.length === 0}
              <p>No stage purchase data configured.</p>
            {:else}
              {#each stageSnapshotRows as snapshot (snapshot.stage)}
                <div class="stage-card">
                  <h3>{stageLabel(snapshot)}</h3>
                  <div class="stage-card__sections">
                    <div class="stage-card__section">
                      <h4>Shop</h4>
                      <StageBarChart
                        title="Shop Distribution"
                        labels={MONSTER_ORDER.map((rarity) => rarityLabelByKey.get(rarity) ?? rarity)}
                        values={MONSTER_ORDER.map((rarity) => snapshot.counts[rarity] ?? 0)}
                        colors={MONSTER_ORDER.map((rarity) => rarityColors[rarity])}
                        max={Math.max(maxRecordValue(snapshot.counts), 1)}
                      />
                      <table class="expected-table">
                        <thead>
                          <tr>
                            <th>Rarity</th>
                            <th>Expected Cards</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each MONSTER_ORDER as rarity}
                            <tr>
                              <td>{rarityLabelByKey.get(rarity) ?? rarity}</td>
                              <td>{formatNumber(snapshot.counts[rarity] ?? 0)}</td>
                            </tr>
                          {/each}
                          <tr class="stage-total">
                            <td>Total</td>
                            <td>{formatNumber(stageTotal(snapshot))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div class="stage-card__section">
                      <h4>Pool</h4>
                      <StageBarChart
                        title="Pool Distribution"
                        labels={MONSTER_ORDER.map((rarity) => rarityLabelByKey.get(rarity) ?? rarity)}
                        values={MONSTER_ORDER.map((rarity) => snapshot.poolCounts[rarity] ?? 0)}
                        colors={MONSTER_ORDER.map((rarity) => rarityColors[rarity])}
                        max={Math.max(maxRecordValue(snapshot.poolCounts), 1)}
                      />
                      <table class="expected-table">
                        <thead>
                          <tr>
                            <th>Rarity</th>
                            <th>Remaining</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each MONSTER_ORDER as rarity}
                            <tr>
                              <td>{rarityLabelByKey.get(rarity) ?? rarity}</td>
                              <td>{formatNumber(snapshot.poolCounts[rarity] ?? 0)}</td>
                            </tr>
                          {/each}
                          <tr class="stage-total">
                            <td>Total</td>
                            <td>{formatNumber(stagePoolTotal(snapshot))}</td>
                          </tr>
                        </tbody>
                      </table>
                      <p class="stage-card__footnote">
                        Total pool remaining (incl. other rarities): {formatNumber(snapshot.poolRemaining)}
                      </p>
                    </div>
                    <div class="stage-card__section stage-card__section--breakdown">
                      <h4>Players &amp; Monsters</h4>
                      <table class="expected-table stage-breakdown">
                        <thead>
                          <tr>
                            <th>Rarity</th>
                            <th>Players (Total)</th>
                            <th>Players (Per Player)</th>
                            <th>Monsters</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each MONSTER_ORDER as rarity}
                            <tr>
                              <td>{rarityLabelByKey.get(rarity) ?? rarity}</td>
                              <td>{formatNumber(snapshot.playerCounts[rarity] ?? 0)}</td>
                              <td>{formatNumber((snapshot.playerCounts[rarity] ?? 0) / playerCount)}</td>
                              <td>{formatNumber(snapshot.monsterCounts[rarity] ?? 0)}</td>
                            </tr>
                          {/each}
                          <tr class="stage-total">
                            <td>Total</td>
                            <td>{formatNumber(stagePlayerTotal(snapshot))}</td>
                            <td>{formatNumber(stagePlayerTotal(snapshot) / playerCount)}</td>
                            <td>{formatNumber(stageMonsterTotal(snapshot))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>

          <p class="note">
            Estimated from {stageSummary.iterations.toLocaleString()} simulated shops (shop size {shopSize},
            {drawsPerPlayer} cheap draws/player, monster counts per rarity as configured above).
            Planned purchases succeed with approximately {(purchaseSuccessRate * 100).toFixed(0)}% probability.
          </p>
        </section>
      {/if}
    </section>
  {/if}
</section>

{#if showSettingsModal}
  <div
    class="modal-backdrop"
    role="button"
    aria-label="Close settings modal"
    tabindex="0"
    on:click={closeSettings}
    on:keydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        closeSettings();
      }
    }}
  >
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Simulation Settings"
      tabindex="-1"
      on:click|stopPropagation
      on:keydown={(event) => event.stopPropagation()}
    >
      <header class="modal__header">
        <div>
          <h2>Simulation Settings</h2>
          <p>Adjust the shop simulator inputs. Changes apply instantly; save to persist in Supabase.</p>
        </div>
        <button class="btn icon" type="button" on:click={closeSettings} aria-label="Close settings">
          ×
        </button>
      </header>

      <div class="modal__body">
        <div class="settings__group">
          <h3>General</h3>
          <p class="settings__hint">Base configuration shared with the shop simulator.</p>
          <div class="settings__list">
            <div class="setting-row">
              <span class="setting-label">Players</span>
              <div class="control__buttons">
                <button class="btn" type="button" on:click={() => handlePlayerCount(-1)}>-</button>
                <span class="value">{playerCount}</span>
                <button class="btn" type="button" on:click={() => handlePlayerCount(1)}>+</button>
              </div>
              <small>Minimum {MIN_PLAYERS}, maximum {MAX_PLAYERS}. Stage 1 draws use player count.</small>
            </div>
            <div class="setting-row">
              <span class="setting-label">Shop Size</span>
              <div class="control__buttons">
                <button class="btn" type="button" on:click={() => adjustShopSize(-1)}>-</button>
                <span class="value">{shopSize}</span>
                <button class="btn" type="button" on:click={() => adjustShopSize(1)}>+</button>
              </div>
              <small>Defaults to {DEFAULT_SHOP_SIZE}. Applies to every simulated stage.</small>
            </div>
            <div class="setting-row">
              <span class="setting-label">Setup Draws per Player</span>
              <div class="control__buttons">
                <button class="btn" type="button" on:click={() => adjustDrawsPerPlayer(-1)}>-</button>
                <span class="value">{drawsPerPlayer}</span>
                <button class="btn" type="button" on:click={() => adjustDrawsPerPlayer(1)}>+</button>
              </div>
              <small>Used for initial Stage 0 setup consumption.</small>
            </div>
            <div class="setting-row">
              <span class="setting-label">Purchase Success Rate</span>
              <div class="control__buttons">
                <input
                  class="input input--number"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={purchaseSuccessRate}
                  on:change={(event) => {
                    const value = Number((event.currentTarget as HTMLInputElement).value);
                    purchaseSuccessRate = Math.min(1, Math.max(0, Number.isFinite(value) ? value : purchaseSuccessRate));
                    recompute();
                  }}
                />
              </div>
              <small>Chance (0–1) that a planned purchase succeeds. Defaults to {DEFAULT_PURCHASE_SUCCESS_RATE}.</small>
            </div>

            <div class="setting-row">
              <span class="setting-label">Total Stages</span>
              <div class="control__buttons">
                <button class="btn" type="button" on:click={() => adjustTotalStages(-1)}>-</button>
                <span class="value">{totalStages}</span>
                <button class="btn" type="button" on:click={() => adjustTotalStages(1)}>+</button>
              </div>
              <small>Number of simulated stages (affects purchase plan rows and charts). Minimum 1.</small>
            </div>
          </div>
        </div>

        <div class="settings__group">
          <h3>Monster Phase</h3>
          <p class="settings__hint">Set how many monsters remove cards after the shop rolls.</p>
          <div class="settings__list">
            {#each RARITY_KEYS as key}
              <div class="setting-row">
                <span class="setting-label">{rarityLabelByKey.get(key) ?? key} Monsters</span>
                <div class="control__buttons">
                  <button class="btn" type="button" on:click={() => adjustMonsterCount(key, -1)}>-</button>
                  <span class="value">{monsterCounts[key] ?? 0}</span>
                  <button class="btn" type="button" on:click={() => adjustMonsterCount(key, 1)}>+</button>
                  {#if (monsterCounts[key] ?? 0) > 0}
                    <button class="btn secondary" type="button" on:click={() => resetMonsterCount(key)}>Reset</button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>

        <div class="settings__group">
          <h3>Monster Limits</h3>
          <p class="settings__hint">Limit how many cards each monster can remove per appearance.</p>
          <div class="settings__list">
            {#each RARITY_KEYS as key}
              <div class="setting-row">
                <span class="setting-label">{rarityLabelByKey.get(key) ?? key} Limit</span>
              <div class="control__buttons">
                <button class="btn" type="button" on:click={() => adjustMonsterTakeLimit(key, -1)}>-</button>
                <span class="value">{formatLimit(monsterTakeLimits[key] ?? DEFAULT_MONSTER_LIMITS[key])}</span>
                <button class="btn" type="button" on:click={() => adjustMonsterTakeLimit(key, 1)}>+</button>
                <button class="btn secondary" type="button" on:click={() => setMonsterNoLimit(key)}>
                  No limit
                </button>
                {#if (monsterTakeLimits[key] ?? DEFAULT_MONSTER_LIMITS[key]) !== DEFAULT_MONSTER_LIMITS[key]}
                  <button class="btn secondary" type="button" on:click={() => resetMonsterTakeLimit(key)}>Default</button>
                {/if}
              </div>
              <small>Default limit: {DEFAULT_MONSTER_LIMITS[key]} · No limit = ∞</small>
            </div>
          {/each}
        </div>
        </div>

        <div class="settings__group">
          <h3>Stage Purchase Plan</h3>
          <p class="settings__hint">
            Per-player purchase targets by stage. When a rarity isn’t available in the shop it will be skipped automatically.
          </p>
          <div class="stage-plan">
            <table class="stage-plan__table">
              <thead>
                <tr>
                  <th>Stage</th>
                  {#each MONSTER_ORDER as rarity}
                    <th>{rarityLabelByKey.get(rarity) ?? rarity}</th>
                  {/each}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each stagePurchasePlan as plan (plan.stage)}
                  <tr>
                    <th scope="row">Stage {plan.stage}</th>
                    {#each MONSTER_ORDER as rarity}
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={getStagePlanValue(plan.stage, rarity)}
                          on:change={(event) =>
                            handleStagePlanInput(
                              plan.stage,
                              rarity,
                              Number((event.currentTarget as HTMLInputElement).value)
                            )
                          }
                        />
                      </td>
                    {/each}
                    <td>
                      <button class="btn secondary small" type="button" on:click={() => resetStagePlan(plan.stage)}>
                        Default
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <div class="settings__group">
          <h3>Pool Overrides</h3>
          <p class="settings__hint">Adjust total copies by rarity to test alternate deck sizes.</p>
          <div class="settings__list">
            {#each rarityStats as stat (stat.config.key)}
              <div class="setting-row">
                <span class="setting-label">{stat.config.label}</span>
                <div class="control__buttons">
                  <button class="btn" type="button" on:click={() => adjustCopiesOverride(stat.config.key, -1)}>-</button>
                  <span class="value">{rarityOverrides[stat.config.key] ?? stat.basePerUnit}</span>
                  <button class="btn" type="button" on:click={() => adjustCopiesOverride(stat.config.key, 1)}>+</button>
                  {#if rarityOverrides[stat.config.key] !== undefined}
                    <button class="btn secondary" type="button" on:click={() => resetCopiesOverride(stat.config.key)}>
                      Base
                    </button>
                  {/if}
                </div>
                <small>
                  Base per unit: {stat.basePerUnit} · Total copies: {stat.unitCount * (rarityOverrides[stat.config.key] ?? stat.basePerUnit)}
                </small>
              </div>
            {/each}
          </div>
        </div>

        <div class="settings__group">
          <h3>Rarity Composition</h3>
          <p class="settings__hint">
            Snapshot of the pool after overrides. These totals feed directly into the simulation.
          </p>
          <div class="settings__table-wrapper">
            <table class="settings-table">
              <thead>
                <tr>
                  <th>Rarity</th>
                  <th>Costs</th>
                  <th>Units</th>
                  <th>Copies / Unit</th>
                  <th>Total Copies</th>
                </tr>
              </thead>
              <tbody>
                {#each rarityStats as stat}
                  <tr>
                    <td>{stat.config.label}</td>
                    <td>{stat.config.costs.join(', ')}</td>
                    <td>{stat.unitCount}</td>
                    <td>{stat.adjustedPerUnit}</td>
                    <td>{stat.totalCopies}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <footer class="modal__footer">
        <div class="modal__footer-left">
          <button class="btn secondary" type="button" disabled={settingsLoading} on:click={loadSettings}>
            Reload from Supabase
          </button>
        </div>
        <div class="modal__footer-right">
          {#if saveState === 'error'}
            <span class="status error">{saveMessage ?? 'Failed to save'}</span>
          {:else if saveState === 'saved'}
            <span class="status success">{saveMessage ?? 'Settings saved'}</span>
          {:else if settingsLoading}
            <span class="status info">Loading settings…</span>
          {:else if saveMessage}
            <span class="status info">{saveMessage}</span>
          {/if}
          <button class="btn primary" type="button" disabled={saveState === 'saving'} on:click={handleSave}>
            {saveState === 'saving' ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </footer>
    </div>
  </div>
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .page__header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid rgba(148, 163, 184, 0.16);
    border-radius: 10.67px;
    padding: 1rem;
  }

  .page__header h1 {
    margin: 0;
    color: #f8fafc;
    font-size: clamp(1.1rem, 2.6vw, 1.5rem);
  }

  .page__header p {
    margin: 0.3rem 0 0;
    color: #94a3b8;
    max-width: 40rem;
  }

  .header-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .config-bar {
    width: 100%;
    display: grid;
    gap: 0.5rem;
    align-items: center;
    padding: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: 10px;
    background: rgba(15, 23, 42, 0.35);
  }

  .config-presets,
  .config-list,
  .config-save {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .config-label {
    font-weight: 600;
    color: #cbd5f5;
  }

  .config-save .input {
    max-width: 180px;
  }

  .btn.small {
    padding: 0.3rem 0.6rem;
    font-size: 0.9rem;
  }

  .btn.tertiary {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(148, 163, 184, 0.25);
  }

  .btn.is-active {
    border-color: rgba(99, 102, 241, 0.6);
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.35);
  }

  .settings-summary {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem;
    margin: 0;
    padding: 0;
  }

  .settings-summary li {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 80px;
  }

  .settings-summary__label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #94a3b8;
  }

  .settings-summary__value {
    font-size: 1.1rem;
    font-weight: 600;
    color: #e2e8f0;
  }

  .control__buttons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .setting-row .value {
    font-size: 1.05rem;
    font-weight: 600;
  }

  .input.input--number {
    width: 72px;
    padding: 0.3rem 0.4rem;
    border-radius: 4px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(15, 23, 42, 0.6);
    color: #f8fafc;
    text-align: center;
  }

  .setting-row small {
    display: block;
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 0.25rem;
  }

  .analysis {
    display: grid;
    gap: 1rem;
    grid-template-columns: minmax(0, 1fr);
  }

  .chart-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .chart-card--full {
    width: 100%;
  }

  .chart-footnote {
    margin: 0;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .chart-empty {
    margin: 0;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .card.probability {
    align-self: start;
  }

  .card {
    background: rgba(15, 23, 42, 0.68);
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 9px;
    padding: 0.85rem;
    color: #e2e8f0;
  }

  .settings__group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.9rem;
  }

  .settings__group:last-child {
    margin-bottom: 0;
  }

  .settings__group h3 {
    margin: 0;
    font-size: 0.95rem;
  }

  .settings__hint {
    margin: 0;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .settings__list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .settings__table-wrapper {
    overflow-x: auto;
  }

  .settings-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 480px;
  }

  .settings-table th,
  .settings-table td {
    padding: 0.45rem;
    text-align: left;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  }

  .settings-table th {
    color: #94a3b8;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.78rem;
    letter-spacing: 0.05em;
  }

  .stage-plan {
    overflow-x: auto;
  }

  .stage-plan__table {
    width: 100%;
    border-collapse: collapse;
    min-width: 520px;
  }

  .stage-plan__table th,
  .stage-plan__table td {
    padding: 0.4rem 0.5rem;
    text-align: center;
  }

  .stage-plan__table th {
    font-weight: 600;
    color: #e2e8f0;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.04em;
  }

  .stage-plan__table input {
    width: 60px;
    padding: 0.3rem;
    text-align: center;
    border-radius: 4px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(15, 23, 42, 0.6);
    color: #f8fafc;
  }

  .setting-row {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: 6px;
    padding: 0.55rem;
    background: rgba(30, 41, 59, 0.35);
  }

  .setting-label {
    font-size: 0.85rem;
    font-weight: 600;
  }

  .setting-row small {
    font-size: 0.7rem;
    color: #94a3b8;
  }

  .setting-row .value {
    font-size: 1rem;
    font-weight: 600;
  }

  .status {
    font-size: 0.8rem;
  }

  .status.info {
    color: #bfdbfe;
  }

  .status.success {
    color: #86efac;
  }

  .status.error {
    color: #fecaca;
  }

  .card.loading,
  .card.error {
    text-align: center;
  }

  .card.error {
    border-color: rgba(248, 113, 113, 0.45);
    color: #fecaca;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  th,
  td {
    padding: 0.45rem;
    text-align: left;
  }

  thead th {
    color: #94a3b8;
    font-weight: 600;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }

  tbody tr + tr td {
    border-top: 1px solid rgba(148, 163, 184, 0.12);
  }

  .stage-summary-intro {
    margin: 0 0 0.75rem;
    color: #94a3b8;
    font-size: 0.8rem;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 1000;
  }

  .modal {
    width: min(960px, 100%);
    max-height: 90vh;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(15, 23, 42, 0.7);
  }

  .modal__header h2 {
    margin: 0;
    font-size: 1.1rem;
    color: #f8fafc;
  }

  .modal__header p {
    margin: 0.35rem 0 0;
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .btn.icon {
    background: transparent;
    color: #cbd5f5;
    font-size: 1.5rem;
    line-height: 1;
    padding: 0 0.5rem;
  }

  .modal__body {
    padding: 1rem 1.25rem;
    flex: 1 1 auto;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modal__footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.9rem 1.25rem;
    border-top: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(15, 23, 42, 0.78);
    align-items: center;
  }

  .modal__footer-left,
  .modal__footer-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .monster-summary {
    margin: 0 0 0.85rem;
    padding: 0.6rem;
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: 6px;
    background: rgba(30, 41, 59, 0.38);
  }

  .monster-summary h3 {
    margin: 0 0 0.45rem;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #e2e8f0;
  }

  .monster-summary ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.3rem;
  }

  .monster-summary li {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: 0.78rem;
    color: #cbd5f5;
  }

  .monster-summary__label {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .monster-summary__value {
    color: #94a3b8;
  }

  .stage-results {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
  }

  .stage-card {
    background: rgba(15, 23, 42, 0.55);
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 9px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .stage-card h3 {
    margin: 0 0 0.5rem;
    color: #f8fafc;
    font-size: 0.95rem;
  }

  .stage-card__sections {
    display: grid;
    gap: 0.75rem;
  }

  @media (min-width: 640px) {
    .stage-card__sections {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .stage-card__section h4 {
    margin: 0 0 0.4rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #cbd5f5;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stage-card__section--breakdown {
    grid-column: 1 / -1;
  }

  .stage-breakdown td:nth-child(2),
  .stage-breakdown td:nth-child(3),
  .stage-breakdown td:nth-child(4) {
    text-align: center;
  }

  .stage-total td {
    font-weight: 600;
  }

  .expected-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.6rem 0 0.8rem;
    font-size: 0.85rem;
  }

  .expected-table th,
  .expected-table td {
    padding: 0.4rem;
    text-align: left;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  }

  .expected-table th {
    color: #94a3b8;
    font-weight: 600;
  }

  .stage-card .expected-table th,
  .stage-card .expected-table td {
    text-align: center;
  }

  .stage-card .expected-table td:first-child,
  .stage-card .expected-table th:first-child {
    text-align: left;
  }

  .stage-card__footnote {
    margin: 0.4rem 0 0;
    font-size: 0.78rem;
    color: #94a3b8;
    text-align: right;
  }

  .stage-card__footnote {
    margin: 0.4rem 0 0;
    font-size: 0.78rem;
    color: #94a3b8;
    text-align: right;
  }

  .note {
    margin: 0;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .warning {
    color: #fbbf24;
    font-weight: 600;
  }

  .btn {
    padding: 0.3rem 0.55rem;
    border-radius: 6px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(30, 41, 59, 0.7);
    color: inherit;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.35);
  }

  .btn.secondary {
    background: rgba(30, 41, 59, 0.45);
  }

  .btn.secondary:hover {
    background: rgba(59, 130, 246, 0.18);
  }

  .btn.small {
    padding: 0.2rem 0.45rem;
    font-size: 0.75rem;
  }

  .btn.primary {
    background: rgba(59, 130, 246, 0.35);
    border-color: rgba(96, 165, 250, 0.45);
  }

  .btn.primary:hover {
    background: rgba(59, 130, 246, 0.5);
  }

  @media (max-width: 640px) {
    .expected-table th,
    .expected-table td {
      padding: 0.35rem;
    }
  }
</style>
