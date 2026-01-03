<script lang="ts">
	interface Props {
		type?: string;
		placeholder?: string;
		value?: string | number | null;
		disabled?: boolean;
		error?: boolean;
		required?: boolean;
		min?: number;
		max?: number;
		step?: number;
		oninput?: (e: Event) => void;
		onkeydown?: (e: KeyboardEvent) => void;
		onblur?: (e: FocusEvent) => void;
		onfocus?: (e: FocusEvent) => void;
	}

	let {
		type = 'text',
		placeholder,
		value = $bindable<string | number | null>(''),
		disabled = false,
		error = false,
		required = false,
		min,
		max,
		step,
		oninput,
		onkeydown,
		onblur,
		onfocus
	}: Props = $props();

	const className = $derived(`input ${error ? 'input--error' : ''}`);
</script>

<input
	{type}
	{placeholder}
	{disabled}
	{required}
	{min}
	{max}
	{step}
	bind:value
	class={className}
	{oninput}
	{onkeydown}
	{onblur}
	{onfocus}
	aria-invalid={error}
/>

<style>
	.input {
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.65);
		color: #f8fafc;
		font: inherit;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.input:focus {
		outline: none;
		border-color: rgba(96, 165, 250, 0.75);
		box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.18);
	}

	.input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.input--error {
		border-color: rgba(248, 113, 113, 0.6);
	}

	.input--error:focus {
		border-color: rgba(248, 113, 113, 0.8);
		box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.2);
	}

	.input::placeholder {
		color: rgba(148, 163, 184, 0.5);
	}
</style>
