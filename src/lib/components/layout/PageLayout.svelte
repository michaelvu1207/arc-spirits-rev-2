<script lang="ts">
	import type { Snippet } from 'svelte';
	import TabBar, { type Tab } from './TabBar.svelte';

	interface Props {
		title: string;
		subtitle?: string;
		tabs?: Tab[];
		activeTab?: string;
		onTabChange?: (tabId: string) => void;
		headerActions?: Snippet;
		tabActions?: Snippet;
		children: Snippet;
	}

	let {
		title,
		subtitle,
		tabs = [],
		activeTab = '',
		onTabChange,
		headerActions,
		tabActions,
		children
	}: Props = $props();
</script>

<div class="page-layout">
	<header class="page-layout__toolbar">
		<div class="page-layout__title-row">
			<h1 class="page-layout__title">{title}</h1>
			{#if subtitle}
				<span class="page-layout__subtitle">{subtitle}</span>
			{/if}
		</div>
		{#if headerActions}
			<div class="page-layout__actions">
				{@render headerActions()}
			</div>
		{/if}
	</header>

	{#if tabs.length > 0}
		<TabBar {tabs} {activeTab} {onTabChange} actions={tabActions} />
	{/if}

	<main class="page-layout__content">
		{@render children()}
	</main>
</div>

<style>
	.page-layout {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: calc(100vh - 5rem);
		width: 100%;
	}

	.page-layout__toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		background: rgba(15, 23, 42, 0.6);
		border-bottom: 1px solid rgba(148, 163, 184, 0.12);
		flex-shrink: 0;
	}

	.page-layout__title-row {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		min-width: 0;
	}

	.page-layout__title {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #f8fafc;
		white-space: nowrap;
	}

	.page-layout__subtitle {
		font-size: 0.75rem;
		color: #64748b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.page-layout__actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.page-layout__content {
		flex: 1;
		overflow: auto;
		padding: 0.5rem;
		background: rgba(2, 6, 23, 0.4);
	}

	@media (max-width: 640px) {
		.page-layout__toolbar {
			flex-wrap: wrap;
			padding: 0.5rem;
		}

		.page-layout__subtitle {
			display: none;
		}
	}
</style>
