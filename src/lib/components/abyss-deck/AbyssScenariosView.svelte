<script lang="ts">
	import type { Monster, Event, ScenarioCardWithData, AbyssScenario } from './types';
	import { MonsterCardPreview } from '$lib/components/monsters';
	import CardActionMenu from '../CardActionMenu.svelte';
	import { Button } from '$lib/components/ui';

	interface Props {
		scenarios: AbyssScenario[];
		selectedScenarioId: string | null;
		selectedScenario: AbyssScenario | null;
		selectedScenarioCards: ScenarioCardWithData[];
		scenarioCards: Record<string, ScenarioCardWithData[]>;
		onSelectScenario: (scenarioId: string) => void;
		onEditScenario: (scenario: AbyssScenario) => void;
		onDeleteScenario: (scenario: AbyssScenario) => void;
		onAddExistingCard: () => void;
		onNewMonster: () => void;
		onNewEvent: () => void;
		onEditMonster: (monster: Monster) => void;
		onEditEvent: (event: Event) => void;
		onMoveCard: (cardId: string, direction: 'up' | 'down') => void;
		onRemoveCard: (cardId: string) => void;
	}

	let {
		scenarios,
		selectedScenarioId,
		selectedScenario,
		selectedScenarioCards,
		scenarioCards,
		onSelectScenario,
		onEditScenario,
		onDeleteScenario,
		onAddExistingCard,
		onNewMonster,
		onNewEvent,
		onEditMonster,
		onEditEvent,
		onMoveCard,
		onRemoveCard
	}: Props = $props();
</script>

<div class="scenarios-view">
	<!-- Scenario Sidebar -->
	<aside class="scenario-sidebar">
		<h3>Scenarios</h3>
		{#if scenarios.length === 0}
			<p class="muted">No scenarios yet.</p>
		{:else}
			<ul class="scenario-list">
				{#each scenarios as scenario (scenario.id)}
					<li>
						<button
							class="scenario-item"
							class:selected={selectedScenarioId === scenario.id}
							onclick={() => onSelectScenario(scenario.id)}
						>
							<div class="scenario-info">
								<span class="scenario-name">{scenario.name}</span>
								<span class="scenario-count">
									{scenarioCards[scenario.id]?.length ?? 0} cards
								</span>
							</div>
						</button>
						<CardActionMenu
							onEdit={() => onEditScenario(scenario)}
							onDelete={() => onDeleteScenario(scenario)}
							onGenerate={null}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	</aside>

	<!-- Scenario Details -->
	<main class="scenario-details">
		{#if selectedScenario}
			<div class="scenario-header">
				<div>
					<h2>{selectedScenario.name}</h2>
					{#if selectedScenario.description}
						<p class="muted">{selectedScenario.description}</p>
					{/if}
				</div>
				<div class="scenario-actions">
					<Button variant="secondary" onclick={onAddExistingCard}>+ Add Existing</Button>
					<button class="btn btn--monster" onclick={onNewMonster}>+ New Monster</button>
					<button class="btn btn--event" onclick={onNewEvent}>+ New Stage Card</button>
				</div>
			</div>

			<section class="cards-section">
				<h3>Cards ({selectedScenarioCards.length})</h3>
				{#if selectedScenarioCards.length === 0}
					<p class="empty">No cards in this scenario. Add cards using the buttons above.</p>
				{:else}
					<div class="card-list">
						{#each selectedScenarioCards as card, index (card.id)}
							<div class="card-wrapper">
								<div class="card-controls">
									<span class="card-order">#{card.order_num}</span>
									<span class="card-type-badge" class:card-type-badge--event={card.card_type === 'stage_card'}>
										{card.card_type}
									</span>
									<div class="card-reorder">
										{#if card.card_type === 'monster'}
											<button
												class="btn-reorder btn-reorder--edit"
												onclick={() => onEditMonster(card.card_data as Monster)}
												title="Edit monster"
											>✏️</button>
										{:else}
												<button
													class="btn-reorder btn-reorder--edit"
													onclick={() => onEditEvent(card.card_data as Event)}
													title="Edit stage card"
												>✏️</button>
										{/if}
										<button
											class="btn-reorder"
											onclick={() => onMoveCard(card.id, 'up')}
											disabled={index === 0}
											title="Move up"
										>↑</button>
										<button
											class="btn-reorder"
											onclick={() => onMoveCard(card.id, 'down')}
											disabled={index === selectedScenarioCards.length - 1}
											title="Move down"
										>↓</button>
										<button
											class="btn-reorder btn-reorder--danger"
											onclick={() => onRemoveCard(card.id)}
											title="Remove"
										>✕</button>
									</div>
								</div>
								{#if card.card_type === 'monster'}
									{@const monster = card.card_data as Monster}
									<MonsterCardPreview {monster} orderNum={card.order_num} />
									{:else}
										{@const event = card.card_data as Event}
										<div class="event-card-preview">
											<div class="event-content">
												<h4 class="event-name">{event.title}</h4>
												{#if event.description}
													<p class="event-description">{event.description}</p>
												{/if}
											</div>
											{#if event.art_url}
												<div class="event-art">
													<img src={event.art_url} alt={event.title} />
												</div>
											{/if}
											<div class="event-footer">Arc Spirits // Stage Card</div>
										</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{:else}
			<div class="empty-state">
				<p>Select a scenario from the sidebar or create a new one.</p>
			</div>
		{/if}
	</main>
</div>

<style>
	.scenarios-view {
		display: grid;
		grid-template-columns: 240px 1fr;
		gap: 0.5rem;
		align-items: start;
	}

	.scenario-sidebar {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 6px;
		padding: 0.5rem;
		position: sticky;
		top: 0.5rem;
	}

	.scenario-sidebar h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.75rem;
		color: #e2e8f0;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.scenario-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.scenario-list li {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.scenario-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.35rem 0.5rem;
		background: rgba(51, 65, 85, 0.4);
		border: 1px solid transparent;
		border-radius: 4px;
		cursor: pointer;
		text-align: left;
		color: #cbd5e1;
		transition: all 0.15s ease;
	}

	.scenario-item:hover {
		background: rgba(51, 65, 85, 0.6);
	}

	.scenario-item.selected {
		background: rgba(168, 85, 247, 0.2);
		border-color: rgba(168, 85, 247, 0.5);
		color: #d8b4fe;
	}

	.scenario-info {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.scenario-name {
		font-weight: 600;
		font-size: 0.75rem;
	}

	.scenario-count {
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.scenario-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.scenario-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.scenario-header h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.scenario-actions {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.empty-state {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 6px;
		padding: 1.5rem;
		text-align: center;
		color: #94a3b8;
		font-size: 0.75rem;
	}

	.muted {
		color: #94a3b8;
		font-size: 0.7rem;
	}

	.cards-section {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 6px;
		padding: 0.75rem;
	}

	.cards-section h3 {
		margin: 0 0 0.75rem 0;
		font-size: 0.8rem;
		color: #e2e8f0;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.card-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.card-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem;
		background: rgba(15, 23, 42, 0.6);
		border-radius: 4px;
	}

	.card-order {
		font-size: 0.7rem;
		font-weight: 700;
		color: #a855f7;
	}

	.card-type-badge {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.15rem 0.35rem;
		border-radius: 3px;
		background: rgba(168, 85, 247, 0.2);
		color: #c084fc;
	}

	.card-type-badge--event {
		background: rgba(59, 130, 246, 0.2);
		color: #60a5fa;
	}

	.card-reorder {
		display: flex;
		gap: 0.15rem;
		margin-left: auto;
	}

	.btn-reorder {
		padding: 0.15rem 0.35rem;
		background: rgba(148, 163, 184, 0.1);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 3px;
		color: #cbd5e1;
		cursor: pointer;
		font-size: 0.75rem;
		transition: all 0.15s;
	}

	.btn-reorder:hover:not(:disabled) {
		background: rgba(148, 163, 184, 0.2);
		border-color: rgba(148, 163, 184, 0.4);
	}

	.btn-reorder:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.btn-reorder--danger {
		background: rgba(239, 68, 68, 0.1);
		border-color: rgba(239, 68, 68, 0.3);
		color: #f87171;
	}

	.btn-reorder--danger:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.2);
		border-color: rgba(239, 68, 68, 0.5);
	}

	.btn-reorder--edit {
		background: rgba(59, 130, 246, 0.1);
		border-color: rgba(59, 130, 246, 0.3);
		color: #60a5fa;
	}

	.btn-reorder--edit:hover:not(:disabled) {
		background: rgba(59, 130, 246, 0.2);
		border-color: rgba(59, 130, 246, 0.5);
	}

	.empty {
		color: #94a3b8;
		text-align: center;
		font-size: 0.7rem;
	}

	/* Event Card Preview */
	.event-card-preview {
		display: grid;
		grid-template-columns: 1fr 1fr;
		background: #0c0b13;
		border-radius: 8px;
		overflow: hidden;
		border-left: 4px solid #3b82f6;
		min-height: 160px;
		max-width: 500px;
	}

	.event-content {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.event-name {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: #f5f3ff;
	}

	.event-title {
		margin: 0;
		font-size: 0.75rem;
		color: #60a5fa;
		font-weight: 600;
	}

	.event-description {
		margin: 0;
		font-size: 0.7rem;
		color: #cbd5e1;
		line-height: 1.4;
	}

	.event-art {
		background: rgba(12, 10, 19, 0.9);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.event-art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: grayscale(100%);
	}

	.event-footer {
		grid-column: 1 / -1;
		padding: 0.35rem 0.75rem;
		font-size: 0.65rem;
		color: #64748b;
		font-weight: 500;
		background: rgba(15, 23, 42, 0.4);
	}

	.btn {
		border: none;
		padding: 0.35rem 0.65rem;
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: 0.75rem;
	}

	.btn:hover:enabled {
		filter: brightness(1.1);
	}

	.btn--monster {
		background: #a855f7;
		color: #f8fafc;
	}

	.btn--event {
		background: #3b82f6;
		color: #f8fafc;
	}

	@media (max-width: 768px) {
		.scenarios-view {
			grid-template-columns: 1fr;
		}

		.scenario-sidebar {
			position: static;
		}
	}
</style>
