import type { SpecialEffectType } from '$lib/types/gameData';

export type MonsterCardUiLanguage =
	| 'base'
	| 'en'
	| 'zh-hans'
	| 'zh-hant'
	| 'de'
	| 'fr'
	| 'es'
	| 'it'
	| 'ja'
	| 'pl'
	| 'ko'
	| (string & {});

type MonsterClassification = 'monster' | 'abyss_guardian' | 'boss';
type MonsterState = 'tainted' | 'corrupt' | 'fallen' | 'arcane' | 'inactive';

export type MonsterCardUi = {
	lang: string;

	classification: Record<MonsterClassification, string>;
	state: Record<MonsterState, string>;
	effectType: Record<SpecialEffectType, string>;

	invadesPrefix: string;
	noSpecialEffects: string;

	trackMarker: string;
	trackStart: string;
	trackKilled: string;
	trackDamage: (n: number) => string;

	calloutTutorialTitle: string;
	calloutTutorialText: string;
	calloutParticipationTitle: string;
	calloutNoParticipationRewards: string;

	statsBarrier: string;
	statsDamage: string;
};

function normalizeLanguageTag(value: string | null | undefined): string {
	const trimmed = value?.trim();
	if (!trimmed) return 'en';
	const normalized = trimmed.replace(/_/g, '-').toLowerCase();
	if (!normalized || normalized === 'base' || normalized === 'default') return 'en';
	if (normalized === 'zh') return 'zh-hans';
	return normalized;
}

const EN: MonsterCardUi = {
	lang: 'en',
	classification: {
		monster: 'Monster',
		abyss_guardian: 'Abyss Guardian',
		boss: 'Boss'
	},
	state: {
		tainted: 'Tainted',
		corrupt: 'Corrupt',
		fallen: 'Fallen',
		arcane: 'Arcane',
		inactive: 'Inactive'
	},
	effectType: {
		before_combat: 'BEFORE COMBAT',
		during_combat: 'DURING COMBAT',
		after_combat: 'AFTER COMBAT',
		combat_type: 'COMBAT TYPE'
	},
	invadesPrefix: 'Invades:',
	noSpecialEffects: 'No special effects.',
	trackMarker: 'Marker',
	trackStart: 'Start',
	trackKilled: 'KILLED',
	trackDamage: (n) => `Damage ${n}`,
	calloutTutorialTitle: 'TUTORIAL',
	calloutTutorialText: 'Deal damage to move the marker right, gaining rewards along the way.',
	calloutParticipationTitle: 'PARTICIPATION',
	calloutNoParticipationRewards: 'No participation rewards.',
	statsBarrier: 'BARRIER',
	statsDamage: 'DAMAGE'
};

const UI_BY_LANG: Record<string, MonsterCardUi> = {
	en: EN,
	'zh-hans': {
		lang: 'zh-hans',
		classification: {
			monster: '怪物',
			abyss_guardian: '深渊守护者',
			boss: '首领'
		},
		state: {
			tainted: '污秽',
			corrupt: '腐化',
			fallen: '堕落',
			arcane: '奥术',
			inactive: '未激活'
		},
		effectType: {
			before_combat: '战斗前',
			during_combat: '战斗中',
			after_combat: '战斗后',
			combat_type: '战斗类型'
		},
		invadesPrefix: '入侵：',
		noSpecialEffects: '无特殊效果。',
		trackMarker: '标记',
		trackStart: '起始',
		trackKilled: '击杀',
		trackDamage: (n) => `伤害 ${n}`,
		calloutTutorialTitle: '教程',
		calloutTutorialText: '造成伤害来将标记向右移动，并在途中获得奖励。',
		calloutParticipationTitle: '参与',
		calloutNoParticipationRewards: '无参与奖励。',
		statsBarrier: '屏障',
		statsDamage: '伤害'
	},
	'zh-hant': {
		lang: 'zh-hant',
		classification: {
			monster: '怪物',
			abyss_guardian: '深淵守護者',
			boss: '首領'
		},
		state: {
			tainted: '汙穢',
			corrupt: '腐化',
			fallen: '墮落',
			arcane: '奧術',
			inactive: '未啟動'
		},
		effectType: {
			before_combat: '戰鬥前',
			during_combat: '戰鬥中',
			after_combat: '戰鬥後',
			combat_type: '戰鬥類型'
		},
		invadesPrefix: '入侵：',
		noSpecialEffects: '無特殊效果。',
		trackMarker: '標記',
		trackStart: '起始',
		trackKilled: '擊殺',
		trackDamage: (n) => `傷害 ${n}`,
		calloutTutorialTitle: '教學',
		calloutTutorialText: '造成傷害來將標記向右移動，並在途中獲得獎勵。',
		calloutParticipationTitle: '參與',
		calloutNoParticipationRewards: '無參與獎勵。',
		statsBarrier: '屏障',
		statsDamage: '傷害'
	},
	de: {
		lang: 'de',
		classification: {
			monster: 'Monster',
			abyss_guardian: 'Abgrundwächter',
			boss: 'Boss'
		},
		state: {
			tainted: 'Verunreinigt',
			corrupt: 'Korrumpiert',
			fallen: 'Gefallen',
			arcane: 'Arkan',
			inactive: 'Inaktiv'
		},
		effectType: {
			before_combat: 'VOR DEM KAMPF',
			during_combat: 'WÄHREND DES KAMPFS',
			after_combat: 'NACH DEM KAMPF',
			combat_type: 'KAMPFTYP'
		},
		invadesPrefix: 'Dringt ein:',
		noSpecialEffects: 'Keine Spezialeffekte.',
		trackMarker: 'Marker',
		trackStart: 'Start',
		trackKilled: 'BESIEGT',
		trackDamage: (n) => `Schaden ${n}`,
		calloutTutorialTitle: 'ANLEITUNG',
		calloutTutorialText: 'Füge Schaden zu, um den Marker nach rechts zu bewegen und unterwegs Belohnungen zu erhalten.',
		calloutParticipationTitle: 'TEILNAHME',
		calloutNoParticipationRewards: 'Keine Teilnahmebelohnungen.',
		statsBarrier: 'BARRIERE',
		statsDamage: 'SCHADEN'
	},
	fr: {
		lang: 'fr',
		classification: {
			monster: 'Monstre',
			abyss_guardian: 'Gardien des Abysses',
			boss: 'Boss'
		},
		state: {
			tainted: 'Souillé',
			corrupt: 'Corrompu',
			fallen: 'Déchu',
			arcane: 'Arcane',
			inactive: 'Inactif'
		},
		effectType: {
			before_combat: 'AVANT LE COMBAT',
			during_combat: 'PENDANT LE COMBAT',
			after_combat: 'APRÈS LE COMBAT',
			combat_type: 'TYPE DE COMBAT'
		},
		invadesPrefix: 'Envahit :',
		noSpecialEffects: 'Aucun effet spécial.',
		trackMarker: 'Marqueur',
		trackStart: 'Début',
		trackKilled: 'ÉLIMINÉ',
		trackDamage: (n) => `Dégâts ${n}`,
		calloutTutorialTitle: 'TUTORIEL',
		calloutTutorialText: 'Infligez des dégâts pour déplacer le marqueur vers la droite et gagner des récompenses en chemin.',
		calloutParticipationTitle: 'PARTICIPATION',
		calloutNoParticipationRewards: 'Aucune récompense de participation.',
		statsBarrier: 'BARRIÈRE',
		statsDamage: 'DÉGÂTS'
	},
	es: {
		lang: 'es',
		classification: {
			monster: 'Monstruo',
			abyss_guardian: 'Guardián del Abismo',
			boss: 'Jefe'
		},
		state: {
			tainted: 'Contaminado',
			corrupt: 'Corrupto',
			fallen: 'Caído',
			arcane: 'Arcano',
			inactive: 'Inactivo'
		},
		effectType: {
			before_combat: 'ANTES DEL COMBATE',
			during_combat: 'DURANTE EL COMBATE',
			after_combat: 'DESPUÉS DEL COMBATE',
			combat_type: 'TIPO DE COMBATE'
		},
		invadesPrefix: 'Invade:',
		noSpecialEffects: 'Sin efectos especiales.',
		trackMarker: 'Marcador',
		trackStart: 'Inicio',
		trackKilled: 'DERROTADO',
		trackDamage: (n) => `Daño ${n}`,
		calloutTutorialTitle: 'TUTORIAL',
		calloutTutorialText: 'Inflige daño para mover el marcador a la derecha y ganar recompensas en el camino.',
		calloutParticipationTitle: 'PARTICIPACIÓN',
		calloutNoParticipationRewards: 'Sin recompensas de participación.',
		statsBarrier: 'BARRERA',
		statsDamage: 'DAÑO'
	},
	it: {
		lang: 'it',
		classification: {
			monster: 'Mostro',
			abyss_guardian: "Guardiano dell'Abisso",
			boss: 'Boss'
		},
		state: {
			tainted: 'Contaminato',
			corrupt: 'Corrotto',
			fallen: 'Caduto',
			arcane: 'Arcano',
			inactive: 'Inattivo'
		},
		effectType: {
			before_combat: 'PRIMA DEL COMBATTIMENTO',
			during_combat: 'DURANTE IL COMBATTIMENTO',
			after_combat: 'DOPO IL COMBATTIMENTO',
			combat_type: 'TIPO DI COMBATTIMENTO'
		},
		invadesPrefix: 'Invade:',
		noSpecialEffects: 'Nessun effetto speciale.',
		trackMarker: 'Segnalino',
		trackStart: 'Inizio',
		trackKilled: 'SCONFITTO',
		trackDamage: (n) => `Danno ${n}`,
		calloutTutorialTitle: 'TUTORIAL',
		calloutTutorialText: 'Infliggi danni per spostare il segnalino a destra, ottenendo ricompense lungo il percorso.',
		calloutParticipationTitle: 'PARTECIPAZIONE',
		calloutNoParticipationRewards: 'Nessuna ricompensa di partecipazione.',
		statsBarrier: 'BARRIERA',
		statsDamage: 'DANNO'
	},
	ja: {
		lang: 'ja',
		classification: {
			monster: 'モンスター',
			abyss_guardian: '深淵の守護者',
			boss: 'ボス'
		},
		state: {
			tainted: '穢れ',
			corrupt: '腐敗',
			fallen: '堕落',
			arcane: '秘術',
			inactive: '非アクティブ'
		},
		effectType: {
			before_combat: '戦闘前',
			during_combat: '戦闘中',
			after_combat: '戦闘後',
			combat_type: '戦闘タイプ'
		},
		invadesPrefix: '侵攻：',
		noSpecialEffects: '特殊効果なし。',
		trackMarker: 'マーカー',
		trackStart: '開始',
		trackKilled: '撃破',
		trackDamage: (n) => `ダメージ ${n}`,
		calloutTutorialTitle: 'チュートリアル',
		calloutTutorialText: 'ダメージを与えてマーカーを右へ進め、途中で報酬を獲得する。',
		calloutParticipationTitle: '参加',
		calloutNoParticipationRewards: '参加報酬なし。',
		statsBarrier: 'バリア',
		statsDamage: 'ダメージ'
	},
	pl: {
		lang: 'pl',
		classification: {
			monster: 'Potwór',
			abyss_guardian: 'Strażnik Otchłani',
			boss: 'Boss'
		},
		state: {
			tainted: 'Skażony',
			corrupt: 'Skorumpowany',
			fallen: 'Upadły',
			arcane: 'Arkaniczny',
			inactive: 'Nieaktywny'
		},
		effectType: {
			before_combat: 'PRZED WALKĄ',
			during_combat: 'W TRAKCIE WALKI',
			after_combat: 'PO WALCE',
			combat_type: 'TYP WALKI'
		},
		invadesPrefix: 'Najeżdża:',
		noSpecialEffects: 'Brak efektów specjalnych.',
		trackMarker: 'Znacznik',
		trackStart: 'Start',
		trackKilled: 'POKONANY',
		trackDamage: (n) => `Obrażenia ${n}`,
		calloutTutorialTitle: 'SAMOUCZEK',
		calloutTutorialText: 'Zadaj obrażenia, aby przesunąć znacznik w prawo i zdobywać nagrody po drodze.',
		calloutParticipationTitle: 'UDZIAŁ',
		calloutNoParticipationRewards: 'Brak nagród za udział.',
		statsBarrier: 'BARIERA',
		statsDamage: 'OBRAŻENIA'
	},
	ko: {
		lang: 'ko',
		classification: {
			monster: '몬스터',
			abyss_guardian: '심연 수호자',
			boss: '보스'
		},
		state: {
			tainted: '오염',
			corrupt: '부패',
			fallen: '타락',
			arcane: '비전',
			inactive: '비활성'
		},
		effectType: {
			before_combat: '전투 전',
			during_combat: '전투 중',
			after_combat: '전투 후',
			combat_type: '전투 유형'
		},
		invadesPrefix: '침공:',
		noSpecialEffects: '특수 효과 없음.',
		trackMarker: '마커',
		trackStart: '시작',
		trackKilled: '처치',
		trackDamage: (n) => `피해 ${n}`,
		calloutTutorialTitle: '튜토리얼',
		calloutTutorialText: '피해를 주어 마커를 오른쪽으로 이동시키고, 이동 중 보상을 획득하세요.',
		calloutParticipationTitle: '참가',
		calloutNoParticipationRewards: '참가 보상 없음.',
		statsBarrier: '방벽',
		statsDamage: '피해'
	}
};

export function getMonsterCardUi(lang: MonsterCardUiLanguage | null | undefined): MonsterCardUi {
	const normalized = normalizeLanguageTag(lang);
	const direct = UI_BY_LANG[normalized];
	if (direct) return direct;

	const base = normalized.split('-')[0];
	if (base && UI_BY_LANG[base]) return UI_BY_LANG[base];
	return EN;
}

