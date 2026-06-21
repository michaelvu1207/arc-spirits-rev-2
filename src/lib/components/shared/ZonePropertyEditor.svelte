<script lang="ts">
	import type { Zone, TextZone, IconGridZone, ImageZone, CustomZone, Align } from '$lib/generators/shared/layoutTypes';

	interface Props {
		zone: Zone;
		onChange: (zone: Zone) => void;
	}

	let { zone, onChange }: Props = $props();

	function updateBox(partial: Partial<{ x: number; y: number; w: number; h: number }>) {
		onChange({ ...zone, box: { ...zone.box, ...partial } });
	}

	function updateText(partial: Partial<Omit<TextZone, 'type' | 'key' | 'label' | 'box'>>) {
		if (zone.type !== 'text') return;
		onChange({ ...zone, ...partial } as Zone);
	}

	function updateIconGrid(partial: Partial<Omit<IconGridZone, 'type' | 'key' | 'label' | 'box'>>) {
		if (zone.type !== 'icon_grid') return;
		onChange({ ...zone, ...partial } as Zone);
	}

	function updateImage(partial: Partial<Omit<ImageZone, 'type' | 'key' | 'label' | 'box'>>) {
		if (zone.type !== 'image') return;
		onChange({ ...zone, ...partial } as Zone);
	}

	function updateCustomConfig(key: string, value: unknown) {
		if (zone.type !== 'custom') return;
		onChange({
			...zone,
			customConfig: { ...zone.customConfig, [key]: value }
		} as Zone);
	}
</script>

<div class="zone-editor">
	<div class="zone-editor__section">
		<h4>Position & Size</h4>
		<div class="zone-editor__grid">
			<label>
				<span>X</span>
				<input type="number" value={zone.box.x} oninput={(e) => updateBox({ x: Number((e.currentTarget as HTMLInputElement).value) })} />
			</label>
			<label>
				<span>Y</span>
				<input type="number" value={zone.box.y} oninput={(e) => updateBox({ y: Number((e.currentTarget as HTMLInputElement).value) })} />
			</label>
			<label>
				<span>W</span>
				<input type="number" value={zone.box.w} oninput={(e) => updateBox({ w: Number((e.currentTarget as HTMLInputElement).value) })} />
			</label>
			<label>
				<span>H</span>
				<input type="number" value={zone.box.h} oninput={(e) => updateBox({ h: Number((e.currentTarget as HTMLInputElement).value) })} />
			</label>
		</div>
	</div>

	{#if zone.type === 'text'}
		<div class="zone-editor__section">
			<h4>Text</h4>
			<div class="zone-editor__grid">
				<label>
					<span>Font Size</span>
					<input type="number" min="1" value={zone.fontSize}
						oninput={(e) => updateText({ fontSize: Math.max(1, Number((e.currentTarget as HTMLInputElement).value)) })} />
				</label>
				<label>
					<span>Line Height</span>
					<input type="number" min="0" placeholder="auto" value={zone.lineHeight ?? ''}
						oninput={(e) => {
							const raw = (e.currentTarget as HTMLInputElement).value;
							updateText({ lineHeight: raw.trim() ? Math.max(0, Number(raw)) : undefined });
						}} />
				</label>
				<label>
					<span>Align</span>
					<select value={zone.align} onchange={(e) => updateText({ align: (e.currentTarget as HTMLSelectElement).value as Align })}>
						<option value="left">Left</option>
						<option value="center">Center</option>
						<option value="right">Right</option>
					</select>
				</label>
				<label>
					<span>Color</span>
					<input type="text" value={zone.color}
						oninput={(e) => updateText({ color: (e.currentTarget as HTMLInputElement).value })} />
				</label>
			</div>
		</div>
	{/if}

	{#if zone.type === 'icon_grid'}
		<div class="zone-editor__section">
			<h4>Icon Grid</h4>
			<div class="zone-editor__grid">
				<label>
					<span>Icon Size</span>
					<input type="number" min="1" value={zone.iconSize}
						oninput={(e) => updateIconGrid({ iconSize: Math.max(1, Number((e.currentTarget as HTMLInputElement).value)) })} />
				</label>
				<label>
					<span>Gap</span>
					<input type="number" min="0" value={zone.gap}
						oninput={(e) => updateIconGrid({ gap: Math.max(0, Number((e.currentTarget as HTMLInputElement).value)) })} />
				</label>
				<label>
					<span>Max/Row</span>
					<input type="number" min="1" value={zone.maxPerRow}
						oninput={(e) => updateIconGrid({ maxPerRow: Math.max(1, Number((e.currentTarget as HTMLInputElement).value)) })} />
				</label>
			</div>
		</div>
	{/if}

	{#if zone.type === 'image'}
		<div class="zone-editor__section">
			<h4>Image</h4>
			<div class="zone-editor__grid">
				<label>
					<span>Fit</span>
					<select value={zone.fit} onchange={(e) => updateImage({ fit: (e.currentTarget as HTMLSelectElement).value as 'contain' | 'cover' })}>
						<option value="contain">Contain</option>
						<option value="cover">Cover</option>
					</select>
				</label>
			</div>
		</div>
	{/if}

	{#if zone.type === 'custom'}
		<div class="zone-editor__section">
			<h4>Custom Config</h4>
			<div class="zone-editor__grid">
				{#each Object.entries(zone.customConfig) as [key, value] (key)}
					<label>
						<span>{key}</span>
						{#if typeof value === 'number'}
							<input type="number" {value}
								oninput={(e) => updateCustomConfig(key, Number((e.currentTarget as HTMLInputElement).value))} />
						{:else if typeof value === 'string'}
							<input type="text" {value}
								oninput={(e) => updateCustomConfig(key, (e.currentTarget as HTMLInputElement).value)} />
						{:else if typeof value === 'boolean'}
							<input type="checkbox" checked={value}
								onchange={(e) => updateCustomConfig(key, (e.currentTarget as HTMLInputElement).checked)} />
						{/if}
					</label>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.zone-editor {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.zone-editor__section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.zone-editor__section h4 {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(226, 232, 240, 0.8);
	}

	.zone-editor__grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem 0.5rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.75rem;
		color: rgba(226, 232, 240, 0.85);
	}

	label span {
		font-size: 0.65rem;
		color: rgba(148, 163, 184, 0.9);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 800;
	}

	input[type='number'],
	input[type='text'],
	select {
		padding: 0.35rem 0.45rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(2, 6, 23, 0.35);
		color: #e2e8f0;
		font-size: 0.8rem;
	}
</style>
