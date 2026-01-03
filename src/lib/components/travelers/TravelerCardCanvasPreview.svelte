<script lang="ts">
	import { onMount } from 'svelte';
	import type { TravelerRow } from '$lib/types/gameData';
	import {
		drawTravelerCard,
		TRAVELER_CARD_HEIGHT,
		TRAVELER_CARD_WIDTH
	} from '$lib/generators/cards/travelerCardGenerator';
	import { loadOpsilonFont } from '$lib/generators/shared/canvas';

	type Traveler = TravelerRow & {
		art_url?: string | null;
		traveler_subtext?: string | null;
		traveler_description?: string | null;
	};

	let { monster }: { monster: Traveler } = $props();

	let canvas: HTMLCanvasElement | null = null;
	let fontReady = $state(false);

	onMount(() => {
		loadOpsilonFont().then(() => {
			fontReady = true;
		});
	});

	$effect(() => {
		if (!canvas || !fontReady) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		void drawTravelerCard(ctx, monster);
	});
</script>

<canvas
	class="traveler-canvas"
	bind:this={canvas}
	width={TRAVELER_CARD_WIDTH}
	height={TRAVELER_CARD_HEIGHT}
></canvas>

<style>
	.traveler-canvas {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
