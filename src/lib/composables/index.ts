/**
 * Composables - Reusable stateful logic using Svelte 5 runes
 *
 * This module provides a collection of composable functions that encapsulate
 * common patterns used across the application, including:
 *
 * - Form modal management
 * - Data filtering and search
 * - Lookup tables and mappings
 * - File upload operations
 *
 * All composables use Svelte 5 runes ($state, $derived) for reactive state
 * management and are designed to be framework-agnostic within Svelte.
 */

export { useFormModal } from './useFormModal.svelte';
export { useFilteredData } from './useFilteredData.svelte';
export { useLookup } from './useLookup.svelte';
export { useFileUpload } from './useFileUpload.svelte';
export { useMultiSelect } from './useMultiSelect.svelte';
