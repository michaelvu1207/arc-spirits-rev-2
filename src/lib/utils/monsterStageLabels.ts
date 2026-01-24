import type { MonsterRow } from '$lib/types/gameData';

type AnyStage = MonsterRow['stage'] | (string & {});

export function getMonsterStageLabel(stage: AnyStage | null | undefined): string {
	switch (stage) {
		case 'stage_1':
			return 'Stage 1';
		case 'stage_2':
			return 'Stage 2';
		case 'stage_3':
			return 'Stage 3';
		case 'final_stage':
			return 'Final Stage';
		case 'inactive':
			return 'Inactive';
		default:
			return typeof stage === 'string' && stage.trim().length > 0 ? stage : '';
	}
}
