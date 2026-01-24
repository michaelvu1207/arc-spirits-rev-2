export type EventType = 'stage_1' | 'stage_2' | 'stage_3' | 'final_stage' | 'endgame';

export const EVENT_TYPE_ORDER: readonly EventType[] = [
	'stage_1',
	'stage_2',
	'stage_3',
	'final_stage',
	'endgame'
];

export const DEFAULT_EVENT_TYPE: EventType = 'stage_1';

export function eventTypeLabel(type: EventType): string {
	switch (type) {
		case 'stage_1':
			return 'Stage 1';
		case 'stage_2':
			return 'Stage 2';
		case 'stage_3':
			return 'Stage 3';
		case 'final_stage':
			return 'Final Stage';
		case 'endgame':
			return 'Endgame';
	}
}

export const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = EVENT_TYPE_ORDER.map((value) => ({
	value,
	label: eventTypeLabel(value)
}));
