<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	let dagreLib: typeof import('dagre') | null = null;

	// Schema data for arc_spirits_assets
	const tables = [
		// Core Game Entities
		{
			id: 'hex_spirits',
			name: 'hex_spirits',
			color: '#3b82f6',
			category: 'Core',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'name', type: 'text' },
				{ name: 'cost', type: 'integer' },
				{ name: 'traits', type: 'jsonb', note: '→ classes, origins' },
				{ name: 'awaken_condition', type: 'jsonb', note: '→ runes (or text)' },
				{ name: 'art_raw_image_path', type: 'text' },
				{ name: 'game_print_image_path', type: 'text' },
				{ name: 'back_side_base', type: 'text' },
				{ name: 'back_side_export', type: 'text' }
			]
		},
		{
			id: 'origins',
			name: 'origins',
			color: '#8b5cf6',
			category: 'Traits',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'name', type: 'text' },
				{ name: 'position', type: 'integer' },
				{ name: 'color', type: 'text' },
				{ name: 'icon_png', type: 'text' },
				{ name: 'calling_card', type: 'jsonb', note: '→ hex_spirits' }
			]
		},
		{
			id: 'classes',
			name: 'classes',
			color: '#8b5cf6',
			category: 'Traits',
				columns: [
					{ name: 'id', type: 'uuid', pk: true },
					{ name: 'name', type: 'text' },
					{ name: 'position', type: 'integer' },
					{ name: 'class_type', type: 'text', note: 'normal|human|special' },
					{ name: 'color', type: 'text' },
					{ name: 'icon_png', type: 'text' },
					{ name: 'effect_schema', type: 'jsonb' }
				]
		},
		{
			id: 'mat_items',
			name: 'mat_items',
			color: '#10b981',
			category: 'Core',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'name', type: 'text' },
				{ name: 'kind', type: 'text', note: 'rune|relic' },
				{ name: 'origin_id', type: 'uuid', fk: 'origins' },
				{ name: 'icon_path', type: 'text' }
			]
		},
		{
			id: 'guardians',
			name: 'guardians',
			color: '#f59e0b',
			category: 'Core',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'name', type: 'text' },
				{ name: 'origin_id', type: 'uuid', fk: 'origins' },
				{ name: 'image_mat_path', type: 'text' },
				{ name: 'chibi_image_path', type: 'text' }
			]
		},
		{
			id: 'game_locations',
			name: 'game_locations',
			color: '#14b8a6',
			category: 'Core',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'name', type: 'text' },
				{ name: 'origin_id', type: 'uuid', fk: 'origins' },
				{ name: 'background_image_path', type: 'text' },
				{ name: 'image_with_icons_path', type: 'text' }
			]
		},
		// Monsters & Combat
		{
			id: 'special_effects',
			name: 'special_effects',
			color: '#a855f7',
			category: 'Combat',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'name', type: 'text' },
				{ name: 'description', type: 'text' },
				{ name: 'icon', type: 'text' },
				{ name: 'color', type: 'text' }
			]
		},
		// Scenarios (unified deck)
		{
			id: 'scenarios',
			name: 'scenarios',
			color: '#06b6d4',
			category: 'Abyss',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'edition_id', type: 'uuid', fk: 'editions' },
				{ name: 'name', type: 'text' },
				{ name: 'display_name', type: 'text', note: 'optional' },
				{ name: 'description', type: 'text' },
				{ name: 'game_location_ids', type: 'uuid[]', note: '→ game_locations (optional curated list)' },
				{ name: 'display_image_path', type: 'text', note: 'storage path (optional)' },
				{ name: 'order_num', type: 'integer' }
			]
		},
		{
			id: 'scenario_deck_entries',
			name: 'scenario_deck_entries',
			color: '#06b6d4',
			category: 'Abyss',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'scenario_id', type: 'uuid', fk: 'scenarios' },
				{ name: 'kind', type: 'text', note: 'monster|location|event' },
				{ name: 'order_num', type: 'integer' },
				{ name: 'quantity', type: 'integer', note: 'monster only' },
				{ name: 'entry_stage', type: 'text', note: 'location only' },
				{ name: 'monster_id', type: 'uuid', fk: 'monsters' },
				{ name: 'game_location_id', type: 'uuid', fk: 'game_locations' },
				{ name: 'event_id', type: 'uuid', fk: 'event_cards' },
				{ name: 'data', type: 'jsonb' }
			]
		},
		{
			id: 'event_cards',
			name: 'event_cards',
			color: '#06b6d4',
			category: 'Abyss',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'internal_name', type: 'text' },
				{ name: 'stage', type: 'text', note: 'stage_1..endgame' },
				{ name: 'title', type: 'text' },
				{ name: 'description', type: 'text' },
				{ name: 'reward_rows', type: 'jsonb', note: '→ icon_pool' },
				{ name: 'image_path', type: 'text' },
				{ name: 'card_image_path', type: 'text' },
				{ name: 'data', type: 'jsonb' },
				{ name: 'order_num', type: 'integer' }
			]
		},
		// Legacy (pre-unified scenarios)
		{
			id: 'stage_cards',
			name: 'stage_cards (legacy)',
			color: '#06b6d4',
			category: 'Legacy',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'name', type: 'text' },
				{ name: 'card_kind', type: 'text', note: 'event|stage_location|…' },
				{ name: 'stage', type: 'text', note: 'stage_1..endgame' },
				{ name: 'title', type: 'text' },
				{ name: 'description', type: 'text' },
				{ name: 'reward_rows', type: 'jsonb', note: 'event only → icon_pool' },
				{ name: 'image_path', type: 'text' },
				{ name: 'card_image_path', type: 'text' },
				{ name: 'game_location_id', type: 'uuid', fk: 'game_locations', note: 'stage_location only' },
				{ name: 'data', type: 'jsonb' },
				{ name: 'order_num', type: 'integer' }
			]
		},
		{
			id: 'scenario_cards',
			name: 'scenario_cards (legacy)',
			color: '#06b6d4',
			category: 'Legacy',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'scenario_id', type: 'uuid', fk: 'scenarios' },
				{ name: 'card_type', type: 'text', note: 'monster|stage_card' },
				{ name: 'card_id', type: 'uuid', note: '→ monsters|stage_cards' },
				{ name: 'order_num', type: 'integer' },
				{ name: 'quantity', type: 'integer', note: 'monster only' }
			]
		},
		// Dice System
		{
			id: 'custom_dice',
			name: 'custom_dice',
			color: '#f97316',
			category: 'Dice',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'name', type: 'varchar' },
				{ name: 'description', type: 'text' },
				{ name: 'color', type: 'varchar' },
				{ name: 'dice_type', type: 'text' }
			]
		},
		{
			id: 'dice_sides',
			name: 'dice_sides',
			color: '#f97316',
			category: 'Dice',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'dice_id', type: 'uuid', fk: 'custom_dice' },
				{ name: 'side_number', type: 'integer' },
				{ name: 'reward_type', type: 'varchar' },
				{ name: 'reward_value', type: 'text' }
			]
		},
		{
			id: 'dice_templates',
			name: 'dice_templates',
			color: '#f97316',
			category: 'Dice',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'template_image_path', type: 'text' },
				{ name: 'template_positions', type: 'jsonb' },
				{ name: 'template_scale', type: 'integer' }
			]
		},
		// Assets & Icons
		{
			id: 'icon_pool',
			name: 'icon_pool',
			color: '#64748b',
			category: 'Assets',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'name', type: 'text' },
				{ name: 'source_type', type: 'text', note: 'origin|class|rune|dice_side|uploaded' },
				{ name: 'source_id', type: 'uuid', note: '→ origins|classes|runes|dice_sides' },
				{ name: 'file_path', type: 'text' },
				{ name: 'tags', type: 'text[]' },
				{ name: 'metadata', type: 'jsonb' },
				{ name: 'export_as_token', type: 'boolean' }
			]
		},
		{
			id: 'calling_orb_images',
			name: 'calling_orb_images',
			color: '#64748b',
			category: 'Assets',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'origin_id', type: 'uuid', fk: 'origins' },
				{ name: 'image_path', type: 'text' }
			]
		},
		// Configuration
		{
			id: 'editions',
			name: 'editions',
			color: '#22c55e',
			category: 'Config',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'name', type: 'text' },
				{ name: 'origin_ids', type: 'uuid[]', note: '→ origins' },
				{ name: 'cost_duplicates', type: 'jsonb' },
				{ name: 'is_default', type: 'boolean' }
			]
		},
		{
			id: 'rarity_traits',
			name: 'rarity_traits',
			color: '#22c55e',
			category: 'Config',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'cost', type: 'integer' },
				{ name: 'origin_traits', type: 'integer' },
				{ name: 'class_traits', type: 'integer' }
			]
		},
		{
			id: 'hex_spirit_quantity_rarity',
			name: 'hex_spirit_quantity_rarity',
			color: '#22c55e',
			category: 'Config',
			columns: [
				{ name: 'cost', type: 'integer', pk: true },
				{ name: 'quantity', type: 'integer' }
			]
		},
		{
			id: 'simulation_settings',
			name: 'simulation_settings',
			color: '#22c55e',
			category: 'Config',
			columns: [
				{ name: 'id', type: 'uuid', pk: true },
				{ name: 'name', type: 'text' },
				{ name: 'shop_size', type: 'integer' },
				{ name: 'monster_counts', type: 'jsonb' }
			]
		}
	];

	// Relationships
	const relationships = [
		// Direct FK relationships
		{ source: 'guardians', target: 'origins', type: 'fk', label: 'origin_id' },
		{ source: 'game_locations', target: 'origins', type: 'fk', label: 'origin_id' },
		{ source: 'mat_items', target: 'origins', type: 'fk', label: 'origin_id' },
		{ source: 'dice_sides', target: 'custom_dice', type: 'fk', label: 'dice_id' },
		{ source: 'scenarios', target: 'editions', type: 'fk', label: 'edition_id' },
		{ source: 'scenario_deck_entries', target: 'scenarios', type: 'fk', label: 'scenario_id' },
		{ source: 'scenario_deck_entries', target: 'game_locations', type: 'fk', label: 'game_location_id' },
		{ source: 'scenario_deck_entries', target: 'event_cards', type: 'fk', label: 'event_id' },
		{ source: 'stage_cards', target: 'game_locations', type: 'fk', label: 'game_location_id' },
		{ source: 'scenario_cards', target: 'scenarios', type: 'fk', label: 'scenario_id' },
		{ source: 'calling_orb_images', target: 'origins', type: 'fk', label: 'origin_id' },

		// JSON/Array references
		{ source: 'hex_spirits', target: 'classes', type: 'json', label: 'traits.class_ids' },
		{ source: 'hex_spirits', target: 'origins', type: 'json', label: 'traits.origin_ids' },
		{ source: 'hex_spirits', target: 'mat_items', type: 'json', label: 'awaken_condition.rune_ids' },
			{ source: 'editions', target: 'origins', type: 'array', label: 'origin_ids' },
{ source: 'origins', target: 'hex_spirits', type: 'json', label: 'calling_card' },
		{ source: 'icon_pool', target: 'origins', type: 'poly', label: 'source_id (origin)' },
		{ source: 'icon_pool', target: 'classes', type: 'poly', label: 'source_id (class)' },
		{ source: 'scenario_cards', target: 'stage_cards', type: 'poly', label: 'card_id (stage_card)' }
		];

	type TableNode = (typeof tables)[0] & { x?: number; y?: number; width?: number; height?: number };
	type Relationship = (typeof relationships)[0];

	let svgContainer: HTMLDivElement;
	let selectedTable = $state<string | null>(null);
	let hoveredEdge = $state<Relationship | null>(null);
	let showColumns = $state(true);
	let filterCategory = $state<string>('all');

	const categories = ['all', ...new Set(tables.map((t) => t.category))];

	const NODE_WIDTH = 200;
	const NODE_HEIGHT_BASE = 40;
	const ROW_HEIGHT = 18;

	function getNodeHeight(table: TableNode): number {
		if (!showColumns) return 50;
		return NODE_HEIGHT_BASE + table.columns.length * ROW_HEIGHT;
	}

	function createGraph() {
		if (!dagreLib) return null;

		const g = new dagreLib.graphlib.Graph();
		g.setGraph({
			rankdir: 'TB',
			nodesep: 80,
			ranksep: 100,
			marginx: 50,
			marginy: 50
		});
		g.setDefaultEdgeLabel(() => ({}));

		const filteredTables = filterCategory === 'all' ? tables : tables.filter((t) => t.category === filterCategory);
		const filteredTableIds = new Set(filteredTables.map((t) => t.id));

		filteredTables.forEach((table) => {
			g.setNode(table.id, {
				width: NODE_WIDTH,
				height: getNodeHeight(table as TableNode),
				...table
			});
		});

		relationships
			.filter((r) => filteredTableIds.has(r.source) && filteredTableIds.has(r.target))
			.forEach((rel) => {
				g.setEdge(rel.source, rel.target);
			});

		dagreLib.layout(g);
		return g;
	}

	function getEdgeColor(type: string): string {
		switch (type) {
			case 'fk':
				return '#22c55e';
			case 'json':
				return '#f59e0b';
			case 'array':
				return '#3b82f6';
			case 'poly':
				return '#a855f7';
			default:
				return '#6b7280';
		}
	}

	function getEdgeDashArray(type: string): string {
		switch (type) {
			case 'fk':
				return '';
			case 'json':
				return '8,4';
			case 'array':
				return '4,4';
			case 'poly':
				return '2,4';
			default:
				return '';
		}
	}

	function renderGraph() {
		if (!svgContainer || !dagreLib) return;

		const g = createGraph();
		if (!g) return;
		const graphData = g.graph();

		// Clear previous content
		d3.select(svgContainer).selectAll('*').remove();

		// Use the actual container dimensions
		const containerWidth = svgContainer.clientWidth || 1200;
		const containerHeight = svgContainer.clientHeight || 800;

		// Graph dimensions from dagre layout
		const graphWidth = graphData.width || 800;
		const graphHeight = graphData.height || 600;

		// Use larger of container or graph size for the viewBox
		const width = Math.max(graphWidth + 100, containerWidth);
		const height = Math.max(graphHeight + 100, containerHeight);

		const svg = d3
			.select(svgContainer)
			.append('svg')
			.attr('width', '100%')
			.attr('height', '100%')
			.attr('viewBox', `0 0 ${width} ${height}`)
			.attr('preserveAspectRatio', 'xMidYMid meet');

		// Add zoom behavior
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.2, 3])
			.on('zoom', (event) => {
				container.attr('transform', event.transform);
			});

		svg.call(zoom);

		// Add arrow marker
		svg
			.append('defs')
			.selectAll('marker')
			.data(['fk', 'json', 'array', 'poly'])
			.join('marker')
			.attr('id', (d) => `arrow-${d}`)
			.attr('viewBox', '0 -5 10 10')
			.attr('refX', 8)
			.attr('refY', 0)
			.attr('markerWidth', 6)
			.attr('markerHeight', 6)
			.attr('orient', 'auto')
			.append('path')
			.attr('fill', (d) => getEdgeColor(d))
			.attr('d', 'M0,-5L10,0L0,5');

		const container = svg.append('g');

		// Get filtered tables and relationships
		const filteredTables = filterCategory === 'all' ? tables : tables.filter((t) => t.category === filterCategory);
		const filteredTableIds = new Set(filteredTables.map((t) => t.id));
		const filteredRelationships = relationships.filter((r) => filteredTableIds.has(r.source) && filteredTableIds.has(r.target));

		// Draw edges
		const edges = container
			.selectAll('.edge')
			.data(filteredRelationships)
			.join('g')
			.attr('class', 'edge');

		edges.each(function (rel) {
			const sourceNode = g.node(rel.source);
			const targetNode = g.node(rel.target);
			if (!sourceNode || !targetNode) return;

			const edgeGroup = d3.select(this);

			// Calculate path
			const sourceX = sourceNode.x;
			const sourceY = sourceNode.y + sourceNode.height / 2;
			const targetX = targetNode.x;
			const targetY = targetNode.y - targetNode.height / 2;

			// Create curved path
			const midY = (sourceY + targetY) / 2;
			const path = `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;

			edgeGroup
				.append('path')
				.attr('d', path)
				.attr('fill', 'none')
				.attr('stroke', getEdgeColor(rel.type))
				.attr('stroke-width', 2)
				.attr('stroke-dasharray', getEdgeDashArray(rel.type))
				.attr('marker-end', `url(#arrow-${rel.type})`)
				.attr('opacity', 0.7)
				.style('cursor', 'pointer')
				.on('mouseenter', function () {
					d3.select(this).attr('stroke-width', 4).attr('opacity', 1);
					hoveredEdge = rel;
				})
				.on('mouseleave', function () {
					d3.select(this).attr('stroke-width', 2).attr('opacity', 0.7);
					hoveredEdge = null;
				});
		});

		// Draw nodes
		const nodes = container
			.selectAll('.node')
			.data(g.nodes().map((id) => g.node(id) as TableNode))
			.join('g')
			.attr('class', 'node')
			.attr('transform', (d) => `translate(${d.x! - NODE_WIDTH / 2}, ${d.y! - getNodeHeight(d) / 2})`)
			.style('cursor', 'pointer')
			.on('click', function (_, d) {
				selectedTable = selectedTable === d.id ? null : d.id;
			});

		// Node background
		nodes
			.append('rect')
			.attr('width', NODE_WIDTH)
			.attr('height', (d) => getNodeHeight(d))
			.attr('rx', 8)
			.attr('fill', '#1e293b')
			.attr('stroke', (d) => d.color)
			.attr('stroke-width', 2);

		// Node header
		nodes
			.append('rect')
			.attr('width', NODE_WIDTH)
			.attr('height', 32)
			.attr('rx', 8)
			.attr('fill', (d) => d.color);

		// Cover bottom corners of header
		nodes
			.append('rect')
			.attr('y', 20)
			.attr('width', NODE_WIDTH)
			.attr('height', 12)
			.attr('fill', (d) => d.color);

		// Table name
		nodes
			.append('text')
			.attr('x', NODE_WIDTH / 2)
			.attr('y', 20)
			.attr('text-anchor', 'middle')
			.attr('fill', 'white')
			.attr('font-weight', 'bold')
			.attr('font-size', '12px')
			.text((d) => d.name);

		// Columns
		if (showColumns) {
			nodes.each(function (d) {
				const nodeGroup = d3.select(this);
				d.columns.forEach((col, i) => {
					const y = 45 + i * ROW_HEIGHT;

					// Column row
					const colGroup = nodeGroup.append('g').attr('transform', `translate(8, ${y})`);

					// Key icon
					if (col.pk) {
						colGroup.append('text').attr('x', 0).attr('y', 0).attr('fill', '#fbbf24').attr('font-size', '10px').text('🔑');
					} else if (col.fk) {
						colGroup.append('text').attr('x', 0).attr('y', 0).attr('fill', '#22c55e').attr('font-size', '10px').text('→');
					} else if (col.note) {
						colGroup.append('text').attr('x', 0).attr('y', 0).attr('fill', '#f59e0b').attr('font-size', '10px').text('⚡');
					}

					// Column name
					colGroup
						.append('text')
						.attr('x', 16)
						.attr('y', 0)
						.attr('fill', '#e2e8f0')
						.attr('font-size', '10px')
						.attr('font-family', 'monospace')
						.text(col.name);

					// Column type
					colGroup
						.append('text')
						.attr('x', NODE_WIDTH - 16)
						.attr('y', 0)
						.attr('text-anchor', 'end')
						.attr('fill', '#64748b')
						.attr('font-size', '9px')
						.text(col.type);
				});
			});
		}

		// Center and fit graph to container
		const padding = 50;
		const scaleX = (containerWidth - padding * 2) / graphWidth;
		const scaleY = (containerHeight - padding * 2) / graphHeight;
		const initialScale = Math.min(scaleX, scaleY, 1.5); // Cap at 1.5x to not make it too big

		const scaledWidth = graphWidth * initialScale;
		const scaledHeight = graphHeight * initialScale;
		const initialX = (containerWidth - scaledWidth) / 2;
		const initialY = (containerHeight - scaledHeight) / 2;

		svg.call(zoom.transform, d3.zoomIdentity.translate(initialX, initialY).scale(initialScale));
	}

	onMount(async () => {
		dagreLib = await import('dagre');
		renderGraph();
	});

	$effect(() => {
		// Re-render when these change
		showColumns;
		filterCategory;
		if (dagreLib) renderGraph();
	});

	function getRelationshipsForTable(tableId: string) {
		return relationships.filter((r) => r.source === tableId || r.target === tableId);
	}
</script>

<svelte:head>
	<title>Database Schema - Arc Spirits</title>
</svelte:head>

<div class="schema-page">
	<!-- Header -->
	<div class="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
		<div>
			<h1 class="text-xl font-bold text-white">Database Schema Visualizer</h1>
			<p class="text-sm text-gray-400">arc_spirits_assets schema • {tables.length} tables • {relationships.length} relationships</p>
		</div>

		<div class="flex items-center gap-4">
			<!-- Category Filter -->
			<div class="flex items-center gap-2">
				<span class="text-sm text-gray-400">Filter:</span>
				<select bind:value={filterCategory} class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white">
					{#each categories as cat}
						<option value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
					{/each}
				</select>
			</div>

			<!-- Toggle Columns -->
			<label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
				<input type="checkbox" bind:checked={showColumns} class="rounded" />
				Show Columns
			</label>
		</div>
	</div>

	<!-- Legend -->
	<div class="bg-gray-800/50 px-4 py-2 flex items-center gap-6 text-xs border-b border-gray-700 flex-shrink-0">
		<span class="text-gray-400">Relationships:</span>
		<span class="flex items-center gap-1">
			<span class="w-6 h-0.5 bg-green-500"></span>
			<span class="text-gray-300">Foreign Key</span>
		</span>
		<span class="flex items-center gap-1">
			<span class="w-6 h-0.5 bg-amber-500 border-b-2 border-dashed border-amber-500"></span>
			<span class="text-gray-300">JSON Reference</span>
		</span>
		<span class="flex items-center gap-1">
			<span class="w-6 h-0.5 bg-blue-500 border-b-2 border-dotted border-blue-500"></span>
			<span class="text-gray-300">Array Reference</span>
		</span>
		<span class="flex items-center gap-1">
			<span class="w-6 h-0.5 bg-purple-500"></span>
			<span class="text-gray-300">Polymorphic</span>
		</span>
		<span class="text-gray-500 ml-auto">Scroll to zoom • Drag to pan • Click table for details</span>
	</div>

	<!-- Graph Container -->
	<div class="graph-container">
		<div bind:this={svgContainer} class="svg-container"></div>

		<!-- Hovered Edge Info -->
		{#if hoveredEdge}
			<div class="absolute bottom-4 left-4 bg-gray-800 border border-gray-600 rounded-lg p-3 text-sm shadow-xl z-50">
				<div class="text-white font-semibold">
					{hoveredEdge.source}
					<span class="text-gray-400">→</span>
					{hoveredEdge.target}
				</div>
				<div class="text-gray-400 text-xs mt-1">
					<span style="color: {getEdgeColor(hoveredEdge.type)}">{hoveredEdge.type.toUpperCase()}</span>
					<span class="ml-2">via {hoveredEdge.label}</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Selected table details -->
	{#if selectedTable}
		{@const table = tables.find((t) => t.id === selectedTable)}
		{#if table}
			<div class="bg-gray-800 border-t border-gray-700 p-4 flex-shrink-0">
				<div class="flex items-start gap-6">
					<div>
						<h3 class="text-lg font-bold" style="color: {table.color}">{table.name}</h3>
						<p class="text-sm text-gray-400">Category: {table.category} • {table.columns.length} columns</p>
					</div>
					<div class="flex-1">
						<h4 class="text-sm font-semibold text-gray-300 mb-2">Relationships ({getRelationshipsForTable(table.id).length})</h4>
						<div class="flex flex-wrap gap-2">
							{#each getRelationshipsForTable(table.id) as rel}
								<span class="px-2 py-1 rounded text-xs" style="background: {getEdgeColor(rel.type)}20; color: {getEdgeColor(rel.type)}">
									{rel.source === selectedTable ? `→ ${rel.target}` : `← ${rel.source}`}
									<span class="opacity-60">({rel.type})</span>
								</span>
							{/each}
						</div>
					</div>
					<button onclick={() => (selectedTable = null)} class="text-gray-400 hover:text-white text-xl">×</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.schema-page {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		background: #111827;
		z-index: 100;
	}

	.graph-container {
		flex: 1;
		position: relative;
		min-height: 0;
		overflow: hidden;
	}

	.svg-container {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: #0f172a;
	}

	.schema-page :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
