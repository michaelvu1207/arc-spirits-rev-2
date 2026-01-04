<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		enabled?: boolean;
		rootMargin?: string;
		threshold?: number | number[];
		once?: boolean;
	}

	let {
		enabled = true,
		rootMargin = '800px 0px',
		threshold = 0,
		once = true,
		...rest
	}: Props & Record<string, unknown> = $props();

	let host = $state<HTMLElement | null>(null);
	let mounted = $state(!enabled);

	$effect(() => {
		if (!enabled) mounted = true;
	});

	onMount(() => {
		if (!enabled) return;

		if (typeof IntersectionObserver === 'undefined' || !host) {
			mounted = true;
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				const visible = !!entry && (entry.isIntersecting || entry.intersectionRatio > 0);

				if (visible) {
					mounted = true;
					if (once) observer.disconnect();
				} else if (!once) {
					mounted = false;
				}
			},
			{ rootMargin, threshold }
		);

		observer.observe(host);
		return () => observer.disconnect();
	});
</script>

<div bind:this={host} {...rest}>
	{#if mounted}
		<slot />
	{:else}
		<slot name="placeholder" />
	{/if}
</div>
