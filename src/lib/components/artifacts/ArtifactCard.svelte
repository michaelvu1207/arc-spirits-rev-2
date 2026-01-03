<script lang="ts">
	/**
	 * Default Artifact Card component
	 * Uses the V17 Diagonal Sidebar Layout as the standard design
	 */
	import ArtifactCardV17 from './card-variations/ArtifactCardV17.svelte';

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<ArtifactCardV17 {artifact} {recipeIcons} {tagNames} {guardianName} />
