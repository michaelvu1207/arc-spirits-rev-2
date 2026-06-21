/**
 * Multi-select composable for list views
 *
 * Provides reusable selection state and operations for components
 * that need checkbox-based multi-select with select all / deselect all.
 *
 * @example
 * ```ts
 * const selection = useMultiSelect();
 *
 * selection.toggle('item-id');
 * selection.selectAll(items.map(i => i.id));
 * selection.deselectAll();
 * const checked = selection.isSelected('item-id');
 * ```
 */
export function useMultiSelect() {
	let selectedIds = $state<Set<string>>(new Set());

	function toggle(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		selectedIds = next;
	}

	function selectAll(ids: string[]) {
		selectedIds = new Set(ids);
	}

	function deselectAll() {
		selectedIds = new Set();
	}

	function isSelected(id: string): boolean {
		return selectedIds.has(id);
	}

	return {
		get selectedIds() {
			return selectedIds;
		},
		get selectedCount() {
			return selectedIds.size;
		},
		toggle,
		selectAll,
		deselectAll,
		isSelected
	};
}
