<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/stores';
	import { onMount, onDestroy, tick } from 'svelte';

	type NavItem = { href: string; label: string; icon: string };
	type NavSection = { title: string; items: NavItem[] };

	const navSections: NavSection[] = [
		{
			title: 'Core Data',
			items: [
				{ href: '/traits', label: 'Traits', icon: '✨' },
				{ href: '/dice', label: 'Dice', icon: '🎲' },
				{ href: '/editions', label: 'Editions', icon: '📦' },
				{ href: '/artifacts', label: 'Artifacts', icon: '🧩' },
				{ href: '/hex-spirits', label: 'Hex Spirits', icon: '⚔️' },
				{ href: '/guardians', label: 'Guardians', icon: '🕯️' },
				{ href: '/arcane-abyss', label: 'Arcane Abyss', icon: '🌀' },
				{ href: '/travelers', label: 'Travelers', icon: '🧭' },
				{ href: '/game-locations', label: 'Game Locations', icon: '📍' },
				{ href: '/spirit-world', label: 'Spirit World', icon: '🗺️' },
				{ href: '/icons', label: 'Icons', icon: '🖍️' }
			]
		},
		{
			title: 'Exports & Analysis',
			items: [
				{ href: '/assets', label: 'Assets Gallery', icon: '🖼️' },
				{ href: '/json-viewer', label: 'JSON Viewer', icon: '📋' },
				{ href: '/analysis', label: 'Analysis', icon: '📊' },
				{ href: '/tts-menu', label: 'TTS Menu', icon: '🎮' }
			]
		},
		{
			title: 'System',
			items: [
				{ href: '/schema', label: 'DB Schema', icon: '🗄️' },
				{ href: '/settings', label: 'Settings', icon: '⚙️' }
			]
		}
	];

	// Flatten for route matching
	const allNavItems = navSections.flatMap(s => s.items);

	export let children;
	let isNavOpen = false;
	let navList: HTMLDivElement | null = null;
	let navHeight = 0;
	let viewportWidth = 0;

	const measureNav = async () => {
		await tick();
		if (navList) {
			navHeight = navList.scrollHeight;
		}
	};

	const handleResize = () => {
		viewportWidth = window.innerWidth;
		if (viewportWidth >= 960) {
			isNavOpen = true;
		}
		measureNav();
	};

	onMount(() => {
		viewportWidth = window.innerWidth;
		if (viewportWidth >= 960) {
			isNavOpen = true;
		}
		measureNav();
		window.addEventListener('resize', handleResize);
	});

	onDestroy(() => {
		window.removeEventListener('resize', handleResize);
	});

	$: if (isNavOpen) {
		measureNav();
	}

	$: pathname = $page.url.pathname;
	$: activeHref = (() => {
		const exact = allNavItems.find((item) => item.href === pathname);
		if (exact) return exact.href;
		const match = allNavItems.find((item) => pathname.startsWith(item.href) && item.href !== '/');
		return match ? match.href : '/';
	})();

	function handleNavigate() {
		if (viewportWidth < 960) {
			isNavOpen = false;
		}
	}

	function handleBackdropKey(event: KeyboardEvent) {
		if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			isNavOpen = false;
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-shell">
	<div class="mobile-header">
		<h1>Arc Spirits Rev 2</h1>
		<button
			type="button"
			class="nav-toggle"
			aria-expanded={isNavOpen}
			aria-controls="sidebar-navigation"
			onclick={() => (isNavOpen = !isNavOpen)}
		>
			<span class="nav-toggle__icon">{isNavOpen ? '✕' : '☰'}</span>
		</button>
	</div>

	<nav class={`sidebar ${isNavOpen ? 'sidebar--open' : ''}`} aria-label="Main navigation">
		<div class="sidebar-header">
			<h1>Arc Spirits</h1>
		</div>

		<div
			bind:this={navList}
			id="sidebar-navigation"
			class="sidebar-nav"
			style={`--nav-height:${navHeight}px`}
		>
			{#each navSections as section, sectionIdx}
				<div class="nav-section">
					<h2 class="nav-section__title">{section.title}</h2>
					{#each section.items as item}
						<a
							href={item.href}
							class={`nav-button ${activeHref === item.href ? 'is-active' : ''}`}
							data-sveltekit-preload-data
							onclick={handleNavigate}
						>
							<span class="nav-icon" aria-hidden="true">{item.icon}</span>
							<span class="nav-label">{item.label}</span>
						</a>
					{/each}
				</div>
				{#if sectionIdx < navSections.length - 1}
					<hr class="nav-divider" />
				{/if}
			{/each}
		</div>
	</nav>

	{#if isNavOpen && viewportWidth < 960}
		<div
			class="backdrop"
			role="button"
			tabindex="0"
			onclick={() => (isNavOpen = false)}
			onkeydown={handleBackdropKey}
		></div>
	{/if}

	<main class="main-content">{@render children?.()}</main>
</div>

<style>
	.app-shell {
		min-height: 100vh;
		display: flex;
		background: radial-gradient(circle at top, rgba(30, 41, 59, 0.55), rgba(2, 6, 23, 0.95)),
			#020617;
	}

	.mobile-header {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: rgba(5, 7, 16, 0.95);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}

	.mobile-header h1 {
		margin: 0;
		font-size: 1rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #f8fafc;
		text-shadow: 0 0 13px rgba(129, 140, 248, 0.45);
	}

	.nav-toggle {
		border: none;
		background: rgba(30, 41, 59, 0.8);
		color: inherit;
		padding: 0.35rem 0.55rem;
		border-radius: 8px;
		cursor: pointer;
	}

	.nav-toggle__icon {
		font-size: 1.1rem;
	}

	.sidebar {
		position: fixed;
		top: 0;
		left: -200px;
		width: 200px;
		height: 100vh;
		z-index: 40;
		display: flex;
		flex-direction: column;
		background: rgba(5, 7, 16, 0.95);
		backdrop-filter: blur(8px);
		border-right: 1px solid rgba(148, 163, 184, 0.15);
		box-shadow: 3px 0 16px rgba(15, 23, 42, 0.45);
		transition: left 0.3s ease;
	}

	.sidebar--open {
		left: 0;
	}

	.sidebar-header {
		padding: 1.25rem 1rem 1rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
	}

	.sidebar-header h1 {
		margin: 0;
		font-size: 1.2rem;
		color: #f8fafc;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		text-shadow: 0 0 12px rgba(129, 140, 248, 0.5);
	}

	.sidebar-nav {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem 0.75rem;
		overflow-y: auto;
	}

	.nav-section {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.nav-section__title {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(148, 163, 184, 0.7);
		padding: 0.5rem 0.5rem 0.25rem;
		margin: 0;
	}

	.nav-divider {
		border: none;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
		margin: 0.25rem 0;
	}

	.nav-button {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.7rem;
		border-radius: 9px;
		color: #cbd5f5;
		text-decoration: none;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.15);
		transition: transform 0.15s ease, box-shadow 0.15s ease, border 0.15s ease;
	}

	.nav-button:hover {
		transform: translateX(3px);
		border-color: rgba(148, 163, 184, 0.35);
		box-shadow: 0 0 12px rgba(79, 70, 229, 0.25);
	}

	.nav-button.is-active {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.5), rgba(139, 92, 246, 0.5));
		border-color: transparent;
		color: #f8fafc;
		box-shadow: 0 0 16px rgba(59, 130, 246, 0.3);
	}

	.nav-icon {
		font-size: 1.1rem;
	}

	.main-content {
		margin-left: 0;
		flex: 1;
		min-height: 100vh;
		padding: 4.25rem 1rem 1.5rem;
		display: flex;
	}

	.main-content :global(.page) {
		width: 100%;
		max-width: 1040px;
		margin: 0 auto;
	}

	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(2, 6, 23, 0.7);
		z-index: 35;
	}

	@media (min-width: 960px) {
		.mobile-header {
			display: none;
		}

		.sidebar {
			left: 0;
		}

		.main-content {
			margin-left: 200px;
			padding: 1.75rem 2rem 2.5rem;
		}
	}
</style>
