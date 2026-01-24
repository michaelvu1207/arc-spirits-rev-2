/**
 * Card Style Definitions
 * Each style has a complete visual identity - unique frames, decorations, typography, and effects
 */

export interface CardStyleColors {
	primary: string;
	secondary: string;
	accent: string;
	text: string;
	textSecondary: string;
	glow: string;
	shadow: string;
}

export interface CardStyleFrame {
	type: 'double-line' | 'cracked' | 'crystalline' | 'organic' | 'dissolving' | 'radiant' | 'spiked' | 'warped' | 'simple' | 'letterbox' | 'codex' | 'postage' | 'minimal' | 'noir' | 'deco' | 'blocky' | 'stitched' | 'ruled' | 'gilded' | 'carved';
	thickness: number;
	cornerStyle: 'flourish' | 'jagged' | 'hexagonal' | 'vine' | 'mist' | 'rays' | 'thorns' | 'impossible' | 'subtle' | 'none' | 'rounded' | 'geometric' | 'brass-clasp' | 'compass' | 'medallion' | 'rune-mark';
	color: string;
	secondaryColor?: string;
}

export interface CardStyleBackground {
	baseColor: string;
	gradientType: 'radial' | 'linear' | 'conic' | 'none';
	gradientColors: string[];
	gradientAngle?: number;
	pattern?: 'arcane-circles' | 'cracks' | 'crystals' | 'leaves' | 'mist' | 'rays' | 'blood-splatter' | 'stars' | 'paper' | 'film-grain' | 'grid' | 'watercolor' | 'none' | 'geometric' | 'stripes';
	patternOpacity: number;
	vignetteStrength: number;
	vignetteColor: string;
}

export interface CardStyleParticle {
	type: 'runes' | 'embers' | 'snowflakes' | 'leaves' | 'wisps' | 'light-rays' | 'blood-drops' | 'stars' | 'none' | 'dust' | 'sparkles' | 'seafoam' | 'goldleaf' | 'cinders';
	count: number;
	color: string;
	size: [number, number]; // min, max
	opacity: [number, number]; // min, max
	animated?: boolean;
}

export interface CardStyleDivider {
	type: 'wings' | 'flames' | 'icicles' | 'vines' | 'smoke' | 'halo' | 'chains' | 'tentacles' | 'simple' | 'film-strip' | 'ornate' | 'brush' | 'dot' | 'slash' | 'deco' | 'arrow';
	color: string;
	width: number;
}

export interface CardStyleTypography {
	titleColor: string;
	titleGlow: string;
	titleGlowStrength: number;
	titleShadow: string;
	titleWeight: number;
	titleLetterSpacing: string;
	titleTransform: 'uppercase' | 'none' | 'capitalize';
	descriptionColor: string;
	descriptionOpacity: number;
	badgeColor: string;
	badgeBgColor: string;
	badgeBorderColor: string;
}

export interface CardStyleDefinition {
	id: string;
	name: string;
	description: string;
	colors: CardStyleColors;
	frame: CardStyleFrame;
	background: CardStyleBackground;
	particles: CardStyleParticle;
	divider: CardStyleDivider;
	typography: CardStyleTypography;
	/** Extra CSS classes or inline styles for HTML preview */
	cssOverrides?: Record<string, string>;
}

// ============================================================================
// EVENT CARD STYLES
// ============================================================================

export const EVENT_STYLE_ARCANE: CardStyleDefinition = {
	id: 'event_v6',
	name: 'Arcane',
	description: 'Ancient magical grimoire - mystical, scholarly, symmetrical',
	colors: {
		primary: '#8b5cf6',
		secondary: '#3b82f6',
		accent: '#c4b5fd',
		text: '#ede9fe',
		textSecondary: '#c4b5fd',
		glow: 'rgba(139, 92, 246, 0.6)',
		shadow: 'rgba(0, 0, 0, 0.8)'
	},
	frame: {
		type: 'double-line',
		thickness: 3,
		cornerStyle: 'flourish',
		color: 'rgba(139, 92, 246, 0.5)',
		secondaryColor: 'rgba(139, 92, 246, 0.3)'
	},
	background: {
		baseColor: '#080610',
		gradientType: 'radial',
		gradientColors: ['rgba(139, 92, 246, 0.22)', 'rgba(59, 130, 246, 0.16)'],
		pattern: 'arcane-circles',
		patternOpacity: 0.08,
		vignetteStrength: 0.85,
		vignetteColor: 'rgba(8, 6, 16, 0.95)'
	},
	particles: {
		type: 'runes',
		count: 6,
		color: '#c4b5fd',
		size: [2, 3],
		opacity: [0.3, 0.8],
		animated: true
	},
	divider: {
		type: 'wings',
		color: 'rgba(139, 92, 246, 0.6)',
		width: 140
	},
	typography: {
		titleColor: '#ede9fe',
		titleGlow: 'rgba(139, 92, 246, 0.5)',
		titleGlowStrength: 30,
		titleShadow: 'rgba(0, 0, 0, 0.8)',
		titleWeight: 800,
		titleLetterSpacing: '0.04em',
		titleTransform: 'uppercase',
		descriptionColor: '#c4b5fd',
		descriptionOpacity: 1,
		badgeColor: '#a78bfa',
		badgeBgColor: 'transparent',
		badgeBorderColor: 'transparent'
	}
};

export const EVENT_STYLE_EMBER: CardStyleDefinition = {
	id: 'event_v6_ember',
	name: 'Ember',
	description: 'Volcanic forge - molten, destructive, fierce heat',
	colors: {
		primary: '#f97316',
		secondary: '#dc2626',
		accent: '#fbbf24',
		text: '#fef3c7',
		textSecondary: '#fdba74',
		glow: 'rgba(249, 115, 22, 0.7)',
		shadow: 'rgba(0, 0, 0, 0.9)'
	},
	frame: {
		type: 'cracked',
		thickness: 4,
		cornerStyle: 'jagged',
		color: '#f97316',
		secondaryColor: '#dc2626'
	},
	background: {
		baseColor: '#0c0a08',
		gradientType: 'radial',
		gradientColors: ['rgba(249, 115, 22, 0.28)', 'rgba(220, 38, 38, 0.20)'],
		pattern: 'cracks',
		patternOpacity: 0.15,
		vignetteStrength: 0.9,
		vignetteColor: 'rgba(12, 10, 8, 0.95)'
	},
	particles: {
		type: 'embers',
		count: 12,
		color: '#fbbf24',
		size: [2, 5],
		opacity: [0.4, 1],
		animated: true
	},
	divider: {
		type: 'flames',
		color: '#f97316',
		width: 160
	},
	typography: {
		titleColor: '#fef3c7',
		titleGlow: 'rgba(249, 115, 22, 0.7)',
		titleGlowStrength: 35,
		titleShadow: 'rgba(0, 0, 0, 0.9)',
		titleWeight: 900,
		titleLetterSpacing: '0.02em',
		titleTransform: 'uppercase',
		descriptionColor: '#fdba74',
		descriptionOpacity: 0.95,
		badgeColor: '#fbbf24',
		badgeBgColor: 'rgba(249, 115, 22, 0.2)',
		badgeBorderColor: 'rgba(249, 115, 22, 0.4)'
	}
};

export const EVENT_STYLE_FROST: CardStyleDefinition = {
	id: 'event_v6_frost',
	name: 'Frost',
	description: 'Crystalline ice palace - sharp, geometric, frozen',
	colors: {
		primary: '#06b6d4',
		secondary: '#6366f1',
		accent: '#e0f2fe',
		text: '#f0f9ff',
		textSecondary: '#7dd3fc',
		glow: 'rgba(6, 182, 212, 0.6)',
		shadow: 'rgba(0, 20, 40, 0.9)'
	},
	frame: {
		type: 'crystalline',
		thickness: 2,
		cornerStyle: 'hexagonal',
		color: '#06b6d4',
		secondaryColor: '#38bdf8'
	},
	background: {
		baseColor: '#020617',
		gradientType: 'radial',
		gradientColors: ['rgba(6, 182, 212, 0.24)', 'rgba(99, 102, 241, 0.18)'],
		pattern: 'crystals',
		patternOpacity: 0.12,
		vignetteStrength: 0.8,
		vignetteColor: 'rgba(2, 6, 23, 0.92)'
	},
	particles: {
		type: 'snowflakes',
		count: 8,
		color: '#e0f2fe',
		size: [3, 6],
		opacity: [0.3, 0.7],
		animated: true
	},
	divider: {
		type: 'icicles',
		color: '#38bdf8',
		width: 120
	},
	typography: {
		titleColor: '#f0f9ff',
		titleGlow: 'rgba(56, 189, 248, 0.5)',
		titleGlowStrength: 25,
		titleShadow: 'rgba(0, 20, 40, 0.9)',
		titleWeight: 700,
		titleLetterSpacing: '0.06em',
		titleTransform: 'uppercase',
		descriptionColor: '#7dd3fc',
		descriptionOpacity: 0.95,
		badgeColor: '#e0f2fe',
		badgeBgColor: 'rgba(6, 182, 212, 0.15)',
		badgeBorderColor: 'rgba(6, 182, 212, 0.3)'
	}
};

export const EVENT_STYLE_VERDANT: CardStyleDefinition = {
	id: 'event_v6_verdant',
	name: 'Verdant',
	description: 'Ancient forest - organic, living growth, primal nature',
	colors: {
		primary: '#10b981',
		secondary: '#14b8a6',
		accent: '#a7f3d0',
		text: '#ecfdf5',
		textSecondary: '#6ee7b7',
		glow: 'rgba(16, 185, 129, 0.5)',
		shadow: 'rgba(5, 20, 10, 0.9)'
	},
	frame: {
		type: 'organic',
		thickness: 4,
		cornerStyle: 'vine',
		color: '#10b981',
		secondaryColor: '#065f46'
	},
	background: {
		baseColor: '#022c22',
		gradientType: 'radial',
		gradientColors: ['rgba(16, 185, 129, 0.24)', 'rgba(20, 184, 166, 0.16)'],
		pattern: 'leaves',
		patternOpacity: 0.1,
		vignetteStrength: 0.85,
		vignetteColor: 'rgba(2, 44, 34, 0.95)'
	},
	particles: {
		type: 'leaves',
		count: 7,
		color: '#6ee7b7',
		size: [4, 8],
		opacity: [0.2, 0.6],
		animated: true
	},
	divider: {
		type: 'vines',
		color: '#10b981',
		width: 180
	},
	typography: {
		titleColor: '#ecfdf5',
		titleGlow: 'rgba(16, 185, 129, 0.4)',
		titleGlowStrength: 20,
		titleShadow: 'rgba(5, 20, 10, 0.9)',
		titleWeight: 700,
		titleLetterSpacing: '0.03em',
		titleTransform: 'capitalize',
		descriptionColor: '#6ee7b7',
		descriptionOpacity: 0.9,
		badgeColor: '#a7f3d0',
		badgeBgColor: 'rgba(16, 185, 129, 0.15)',
		badgeBorderColor: 'rgba(16, 185, 129, 0.3)'
	}
};

export const EVENT_STYLE_SHADOW: CardStyleDefinition = {
	id: 'event_v6_shadow',
	name: 'Shadow',
	description: 'The veil between worlds - ethereal, haunting, dissolving',
	colors: {
		primary: '#6b7280',
		secondary: '#7c3aed',
		accent: '#9ca3af',
		text: '#e5e7eb',
		textSecondary: '#9ca3af',
		glow: 'rgba(124, 58, 237, 0.4)',
		shadow: 'rgba(0, 0, 0, 0.95)'
	},
	frame: {
		type: 'dissolving',
		thickness: 2,
		cornerStyle: 'mist',
		color: 'rgba(107, 114, 128, 0.4)',
		secondaryColor: 'rgba(124, 58, 237, 0.3)'
	},
	background: {
		baseColor: '#09090b',
		gradientType: 'radial',
		gradientColors: ['rgba(107, 114, 128, 0.28)', 'rgba(124, 58, 237, 0.20)'],
		pattern: 'mist',
		patternOpacity: 0.2,
		vignetteStrength: 0.95,
		vignetteColor: 'rgba(9, 9, 11, 0.98)'
	},
	particles: {
		type: 'wisps',
		count: 5,
		color: '#9ca3af',
		size: [8, 20],
		opacity: [0.1, 0.3],
		animated: true
	},
	divider: {
		type: 'smoke',
		color: 'rgba(156, 163, 175, 0.4)',
		width: 200
	},
	typography: {
		titleColor: '#e5e7eb',
		titleGlow: 'rgba(124, 58, 237, 0.3)',
		titleGlowStrength: 40,
		titleShadow: 'rgba(0, 0, 0, 0.95)',
		titleWeight: 600,
		titleLetterSpacing: '0.08em',
		titleTransform: 'uppercase',
		descriptionColor: '#9ca3af',
		descriptionOpacity: 0.8,
		badgeColor: '#9ca3af',
		badgeBgColor: 'rgba(107, 114, 128, 0.1)',
		badgeBorderColor: 'rgba(107, 114, 128, 0.2)'
	}
};

export const EVENT_STYLE_RADIANT: CardStyleDefinition = {
	id: 'event_v6_radiant',
	name: 'Radiant',
	description: 'Divine light - holy sanctuary, celestial glory, blessed',
	colors: {
		primary: '#fbbf24',
		secondary: '#f97316',
		accent: '#fef3c7',
		text: '#fffbeb',
		textSecondary: '#fcd34d',
		glow: 'rgba(251, 191, 36, 0.6)',
		shadow: 'rgba(60, 40, 0, 0.7)'
	},
	frame: {
		type: 'radiant',
		thickness: 3,
		cornerStyle: 'rays',
		color: '#fbbf24',
		secondaryColor: '#fef3c7'
	},
	background: {
		baseColor: '#1c1917',
		gradientType: 'radial',
		gradientColors: ['rgba(251, 191, 36, 0.30)', 'rgba(249, 115, 22, 0.18)'],
		pattern: 'rays',
		patternOpacity: 0.15,
		vignetteStrength: 0.7,
		vignetteColor: 'rgba(28, 25, 23, 0.85)'
	},
	particles: {
		type: 'light-rays',
		count: 10,
		color: '#fef3c7',
		size: [2, 4],
		opacity: [0.4, 0.9],
		animated: true
	},
	divider: {
		type: 'halo',
		color: '#fbbf24',
		width: 160
	},
	typography: {
		titleColor: '#fffbeb',
		titleGlow: 'rgba(251, 191, 36, 0.6)',
		titleGlowStrength: 35,
		titleShadow: 'rgba(60, 40, 0, 0.7)',
		titleWeight: 800,
		titleLetterSpacing: '0.05em',
		titleTransform: 'uppercase',
		descriptionColor: '#fcd34d',
		descriptionOpacity: 0.95,
		badgeColor: '#fef3c7',
		badgeBgColor: 'rgba(251, 191, 36, 0.2)',
		badgeBorderColor: 'rgba(251, 191, 36, 0.4)'
	}
};

export const EVENT_STYLE_CRIMSON: CardStyleDefinition = {
	id: 'event_v6_crimson',
	name: 'Crimson',
	description: 'Blood pact - war, violence, brutal sacrifice',
	colors: {
		primary: '#e11d48',
		secondary: '#be185d',
		accent: '#fda4af',
		text: '#fff1f2',
		textSecondary: '#fb7185',
		glow: 'rgba(225, 29, 72, 0.6)',
		shadow: 'rgba(30, 0, 10, 0.95)'
	},
	frame: {
		type: 'spiked',
		thickness: 4,
		cornerStyle: 'thorns',
		color: '#e11d48',
		secondaryColor: '#7f1d1d'
	},
	background: {
		baseColor: '#0c0506',
		gradientType: 'linear',
		gradientColors: ['rgba(225, 29, 72, 0.28)', 'rgba(190, 24, 93, 0.20)'],
		gradientAngle: 160,
		pattern: 'blood-splatter',
		patternOpacity: 0.12,
		vignetteStrength: 0.92,
		vignetteColor: 'rgba(12, 5, 6, 0.97)'
	},
	particles: {
		type: 'blood-drops',
		count: 6,
		color: '#e11d48',
		size: [3, 6],
		opacity: [0.3, 0.7],
		animated: true
	},
	divider: {
		type: 'chains',
		color: '#7f1d1d',
		width: 140
	},
	typography: {
		titleColor: '#fff1f2',
		titleGlow: 'rgba(225, 29, 72, 0.5)',
		titleGlowStrength: 30,
		titleShadow: 'rgba(30, 0, 10, 0.95)',
		titleWeight: 900,
		titleLetterSpacing: '0.02em',
		titleTransform: 'uppercase',
		descriptionColor: '#fb7185',
		descriptionOpacity: 0.9,
		badgeColor: '#fda4af',
		badgeBgColor: 'rgba(225, 29, 72, 0.2)',
		badgeBorderColor: 'rgba(225, 29, 72, 0.4)'
	}
};

export const EVENT_STYLE_VOID: CardStyleDefinition = {
	id: 'event_v6_void',
	name: 'Void',
	description: 'Cosmic horror - eldritch, infinite space, impossible geometry',
	colors: {
		primary: '#4f46e5',
		secondary: '#1e1b4b',
		accent: '#a5b4fc',
		text: '#eef2ff',
		textSecondary: '#818cf8',
		glow: 'rgba(79, 70, 229, 0.5)',
		shadow: 'rgba(0, 0, 20, 0.98)'
	},
	frame: {
		type: 'warped',
		thickness: 2,
		cornerStyle: 'impossible',
		color: '#4f46e5',
		secondaryColor: '#312e81'
	},
	background: {
		baseColor: '#030712',
		gradientType: 'conic',
		gradientColors: ['rgba(79, 70, 229, 0.26)', 'rgba(30, 27, 75, 0.22)', 'rgba(79, 70, 229, 0.26)'],
		pattern: 'stars',
		patternOpacity: 0.3,
		vignetteStrength: 0.88,
		vignetteColor: 'rgba(3, 7, 18, 0.96)'
	},
	particles: {
		type: 'stars',
		count: 20,
		color: '#a5b4fc',
		size: [1, 3],
		opacity: [0.2, 0.8],
		animated: true
	},
	divider: {
		type: 'tentacles',
		color: '#4f46e5',
		width: 180
	},
	typography: {
		titleColor: '#eef2ff',
		titleGlow: 'rgba(79, 70, 229, 0.4)',
		titleGlowStrength: 50,
		titleShadow: 'rgba(0, 0, 20, 0.98)',
		titleWeight: 700,
		titleLetterSpacing: '0.1em',
		titleTransform: 'uppercase',
		descriptionColor: '#818cf8',
		descriptionOpacity: 0.85,
		badgeColor: '#a5b4fc',
		badgeBgColor: 'rgba(79, 70, 229, 0.15)',
		badgeBorderColor: 'rgba(79, 70, 229, 0.3)'
	}
};

export const EVENT_STYLE_FAIRY: CardStyleDefinition = {
	id: 'event_v6_fairy',
	name: 'Fairy',
	description: 'Enchanted grove - whimsical magic, sparkling wonder, fae blessing',
	colors: {
		primary: '#ec4899',
		secondary: '#a855f7',
		accent: '#fbcfe8',
		text: '#fdf2f8',
		textSecondary: '#f9a8d4',
		glow: 'rgba(236, 72, 153, 0.6)',
		shadow: 'rgba(30, 10, 25, 0.85)'
	},
	frame: {
		type: 'organic',
		thickness: 2,
		cornerStyle: 'vine',
		color: '#ec4899',
		secondaryColor: '#f472b6'
	},
	background: {
		baseColor: '#1a0a14',
		gradientType: 'radial',
		gradientColors: ['rgba(236, 72, 153, 0.28)', 'rgba(168, 85, 247, 0.18)'],
		pattern: 'stars',
		patternOpacity: 0.15,
		vignetteStrength: 0.75,
		vignetteColor: 'rgba(26, 10, 20, 0.88)'
	},
	particles: {
		type: 'sparkles',
		count: 14,
		color: '#fbcfe8',
		size: [2, 5],
		opacity: [0.4, 0.9],
		animated: true
	},
	divider: {
		type: 'halo',
		color: '#f472b6',
		width: 140
	},
	typography: {
		titleColor: '#fdf2f8',
		titleGlow: 'rgba(236, 72, 153, 0.5)',
		titleGlowStrength: 30,
		titleShadow: 'rgba(30, 10, 25, 0.85)',
		titleWeight: 700,
		titleLetterSpacing: '0.04em',
		titleTransform: 'capitalize',
		descriptionColor: '#f9a8d4',
		descriptionOpacity: 0.95,
		badgeColor: '#fbcfe8',
		badgeBgColor: 'rgba(236, 72, 153, 0.2)',
		badgeBorderColor: 'rgba(236, 72, 153, 0.4)'
	}
};

// ============================================================================
// STAGE LOCATION STYLES
// ============================================================================

export const LOCATION_STYLE_ARCANE: CardStyleDefinition = {
	id: 'stage_location_v6_arcane',
	name: 'Arcane',
	description: 'Mystical location - arcane elegance, magical atmosphere',
	colors: {
		primary: '#8b5cf6',
		secondary: '#3b82f6',
		accent: '#c4b5fd',
		text: '#f8fafc',
		textSecondary: '#cbd5e1',
		glow: 'rgba(139, 92, 246, 0.5)',
		shadow: 'rgba(0, 0, 0, 0.8)'
	},
	frame: {
		type: 'double-line',
		thickness: 2,
		cornerStyle: 'flourish',
		color: 'rgba(139, 92, 246, 0.6)',
		secondaryColor: 'rgba(139, 92, 246, 0.3)'
	},
	background: {
		baseColor: '#0a0618',
		gradientType: 'radial',
		gradientColors: ['rgba(139, 92, 246, 0.18)', 'rgba(59, 130, 246, 0.12)'],
		pattern: 'arcane-circles',
		patternOpacity: 0.06,
		vignetteStrength: 0.8,
		vignetteColor: 'rgba(10, 6, 24, 0.92)'
	},
	particles: {
		type: 'runes',
		count: 4,
		color: '#c4b5fd',
		size: [2, 3],
		opacity: [0.2, 0.5],
		animated: true
	},
	divider: {
		type: 'wings',
		color: 'rgba(139, 92, 246, 0.5)',
		width: 100
	},
	typography: {
		titleColor: '#f8fafc',
		titleGlow: 'rgba(139, 92, 246, 0.4)',
		titleGlowStrength: 20,
		titleShadow: 'rgba(0, 0, 0, 0.8)',
		titleWeight: 700,
		titleLetterSpacing: '0.03em',
		titleTransform: 'uppercase',
		descriptionColor: '#cbd5e1',
		descriptionOpacity: 0.9,
		badgeColor: '#c4b5fd',
		badgeBgColor: 'rgba(139, 92, 246, 0.15)',
		badgeBorderColor: 'rgba(139, 92, 246, 0.3)'
	}
};

export const LOCATION_STYLE_EMBER: CardStyleDefinition = {
	id: 'stage_location_v6_ember',
	name: 'Ember',
	description: 'Volcanic terrain - molten rivers, scorched earth, fierce heat',
	colors: {
		primary: '#f97316',
		secondary: '#dc2626',
		accent: '#fbbf24',
		text: '#fef3c7',
		textSecondary: '#fdba74',
		glow: 'rgba(249, 115, 22, 0.6)',
		shadow: 'rgba(0, 0, 0, 0.9)'
	},
	frame: {
		type: 'cracked',
		thickness: 3,
		cornerStyle: 'jagged',
		color: '#f97316',
		secondaryColor: '#dc2626'
	},
	background: {
		baseColor: '#0c0806',
		gradientType: 'radial',
		gradientColors: ['rgba(249, 115, 22, 0.22)', 'rgba(220, 38, 38, 0.15)'],
		pattern: 'cracks',
		patternOpacity: 0.1,
		vignetteStrength: 0.85,
		vignetteColor: 'rgba(12, 8, 6, 0.94)'
	},
	particles: {
		type: 'embers',
		count: 8,
		color: '#fbbf24',
		size: [2, 4],
		opacity: [0.3, 0.8],
		animated: true
	},
	divider: {
		type: 'flames',
		color: '#f97316',
		width: 120
	},
	typography: {
		titleColor: '#fef3c7',
		titleGlow: 'rgba(249, 115, 22, 0.5)',
		titleGlowStrength: 25,
		titleShadow: 'rgba(0, 0, 0, 0.9)',
		titleWeight: 800,
		titleLetterSpacing: '0.02em',
		titleTransform: 'uppercase',
		descriptionColor: '#fdba74',
		descriptionOpacity: 0.9,
		badgeColor: '#fbbf24',
		badgeBgColor: 'rgba(249, 115, 22, 0.2)',
		badgeBorderColor: 'rgba(249, 115, 22, 0.4)'
	}
};

export const LOCATION_STYLE_FROST: CardStyleDefinition = {
	id: 'stage_location_v6_frost',
	name: 'Frost',
	description: 'Frozen realm - crystalline glaciers, eternal winter',
	colors: {
		primary: '#06b6d4',
		secondary: '#6366f1',
		accent: '#e0f2fe',
		text: '#f0f9ff',
		textSecondary: '#7dd3fc',
		glow: 'rgba(6, 182, 212, 0.5)',
		shadow: 'rgba(0, 20, 40, 0.9)'
	},
	frame: {
		type: 'crystalline',
		thickness: 2,
		cornerStyle: 'hexagonal',
		color: '#06b6d4',
		secondaryColor: '#38bdf8'
	},
	background: {
		baseColor: '#020a14',
		gradientType: 'radial',
		gradientColors: ['rgba(6, 182, 212, 0.18)', 'rgba(99, 102, 241, 0.12)'],
		pattern: 'crystals',
		patternOpacity: 0.08,
		vignetteStrength: 0.75,
		vignetteColor: 'rgba(2, 10, 20, 0.9)'
	},
	particles: {
		type: 'snowflakes',
		count: 6,
		color: '#e0f2fe',
		size: [2, 5],
		opacity: [0.2, 0.6],
		animated: true
	},
	divider: {
		type: 'icicles',
		color: '#38bdf8',
		width: 100
	},
	typography: {
		titleColor: '#f0f9ff',
		titleGlow: 'rgba(56, 189, 248, 0.4)',
		titleGlowStrength: 18,
		titleShadow: 'rgba(0, 20, 40, 0.9)',
		titleWeight: 700,
		titleLetterSpacing: '0.04em',
		titleTransform: 'uppercase',
		descriptionColor: '#7dd3fc',
		descriptionOpacity: 0.9,
		badgeColor: '#e0f2fe',
		badgeBgColor: 'rgba(6, 182, 212, 0.15)',
		badgeBorderColor: 'rgba(6, 182, 212, 0.3)'
	}
};

export const LOCATION_STYLE_VERDANT: CardStyleDefinition = {
	id: 'stage_location_v6_verdant',
	name: 'Verdant',
	description: 'Ancient grove - living forest, primal nature spirits',
	colors: {
		primary: '#10b981',
		secondary: '#14b8a6',
		accent: '#a7f3d0',
		text: '#ecfdf5',
		textSecondary: '#6ee7b7',
		glow: 'rgba(16, 185, 129, 0.45)',
		shadow: 'rgba(5, 20, 10, 0.9)'
	},
	frame: {
		type: 'organic',
		thickness: 3,
		cornerStyle: 'vine',
		color: '#10b981',
		secondaryColor: '#065f46'
	},
	background: {
		baseColor: '#021a12',
		gradientType: 'radial',
		gradientColors: ['rgba(16, 185, 129, 0.18)', 'rgba(20, 184, 166, 0.12)'],
		pattern: 'leaves',
		patternOpacity: 0.07,
		vignetteStrength: 0.8,
		vignetteColor: 'rgba(2, 26, 18, 0.92)'
	},
	particles: {
		type: 'leaves',
		count: 5,
		color: '#6ee7b7',
		size: [3, 6],
		opacity: [0.15, 0.45],
		animated: true
	},
	divider: {
		type: 'vines',
		color: '#10b981',
		width: 140
	},
	typography: {
		titleColor: '#ecfdf5',
		titleGlow: 'rgba(16, 185, 129, 0.35)',
		titleGlowStrength: 15,
		titleShadow: 'rgba(5, 20, 10, 0.9)',
		titleWeight: 700,
		titleLetterSpacing: '0.02em',
		titleTransform: 'capitalize',
		descriptionColor: '#6ee7b7',
		descriptionOpacity: 0.9,
		badgeColor: '#a7f3d0',
		badgeBgColor: 'rgba(16, 185, 129, 0.15)',
		badgeBorderColor: 'rgba(16, 185, 129, 0.3)'
	}
};

export const LOCATION_STYLE_SHADOW: CardStyleDefinition = {
	id: 'stage_location_v6_shadow',
	name: 'Shadow',
	description: 'Twilight realm - ethereal mists, fading boundaries',
	colors: {
		primary: '#6b7280',
		secondary: '#7c3aed',
		accent: '#9ca3af',
		text: '#e5e7eb',
		textSecondary: '#9ca3af',
		glow: 'rgba(124, 58, 237, 0.35)',
		shadow: 'rgba(0, 0, 0, 0.95)'
	},
	frame: {
		type: 'dissolving',
		thickness: 2,
		cornerStyle: 'mist',
		color: 'rgba(107, 114, 128, 0.35)',
		secondaryColor: 'rgba(124, 58, 237, 0.25)'
	},
	background: {
		baseColor: '#06060a',
		gradientType: 'radial',
		gradientColors: ['rgba(107, 114, 128, 0.2)', 'rgba(124, 58, 237, 0.12)'],
		pattern: 'mist',
		patternOpacity: 0.15,
		vignetteStrength: 0.92,
		vignetteColor: 'rgba(6, 6, 10, 0.97)'
	},
	particles: {
		type: 'wisps',
		count: 4,
		color: '#9ca3af',
		size: [6, 15],
		opacity: [0.08, 0.22],
		animated: true
	},
	divider: {
		type: 'smoke',
		color: 'rgba(156, 163, 175, 0.35)',
		width: 160
	},
	typography: {
		titleColor: '#e5e7eb',
		titleGlow: 'rgba(124, 58, 237, 0.25)',
		titleGlowStrength: 30,
		titleShadow: 'rgba(0, 0, 0, 0.95)',
		titleWeight: 600,
		titleLetterSpacing: '0.06em',
		titleTransform: 'uppercase',
		descriptionColor: '#9ca3af',
		descriptionOpacity: 0.8,
		badgeColor: '#9ca3af',
		badgeBgColor: 'rgba(107, 114, 128, 0.1)',
		badgeBorderColor: 'rgba(107, 114, 128, 0.2)'
	}
};

export const LOCATION_STYLE_RADIANT: CardStyleDefinition = {
	id: 'stage_location_v6_radiant',
	name: 'Radiant',
	description: 'Sacred ground - divine light, celestial blessing',
	colors: {
		primary: '#fbbf24',
		secondary: '#f97316',
		accent: '#fef3c7',
		text: '#fffbeb',
		textSecondary: '#fcd34d',
		glow: 'rgba(251, 191, 36, 0.55)',
		shadow: 'rgba(60, 40, 0, 0.7)'
	},
	frame: {
		type: 'radiant',
		thickness: 2,
		cornerStyle: 'rays',
		color: '#fbbf24',
		secondaryColor: '#fef3c7'
	},
	background: {
		baseColor: '#14120a',
		gradientType: 'radial',
		gradientColors: ['rgba(251, 191, 36, 0.22)', 'rgba(249, 115, 22, 0.12)'],
		pattern: 'rays',
		patternOpacity: 0.1,
		vignetteStrength: 0.65,
		vignetteColor: 'rgba(20, 18, 10, 0.82)'
	},
	particles: {
		type: 'light-rays',
		count: 8,
		color: '#fef3c7',
		size: [2, 3],
		opacity: [0.3, 0.7],
		animated: true
	},
	divider: {
		type: 'halo',
		color: '#fbbf24',
		width: 120
	},
	typography: {
		titleColor: '#fffbeb',
		titleGlow: 'rgba(251, 191, 36, 0.5)',
		titleGlowStrength: 25,
		titleShadow: 'rgba(60, 40, 0, 0.7)',
		titleWeight: 700,
		titleLetterSpacing: '0.04em',
		titleTransform: 'uppercase',
		descriptionColor: '#fcd34d',
		descriptionOpacity: 0.95,
		badgeColor: '#fef3c7',
		badgeBgColor: 'rgba(251, 191, 36, 0.2)',
		badgeBorderColor: 'rgba(251, 191, 36, 0.4)'
	}
};

export const LOCATION_STYLE_CRIMSON: CardStyleDefinition = {
	id: 'stage_location_v6_crimson',
	name: 'Crimson',
	description: 'Battlefield - blood-soaked earth, war-torn ruins',
	colors: {
		primary: '#e11d48',
		secondary: '#be185d',
		accent: '#fda4af',
		text: '#fff1f2',
		textSecondary: '#fb7185',
		glow: 'rgba(225, 29, 72, 0.5)',
		shadow: 'rgba(30, 0, 10, 0.95)'
	},
	frame: {
		type: 'spiked',
		thickness: 3,
		cornerStyle: 'thorns',
		color: '#e11d48',
		secondaryColor: '#7f1d1d'
	},
	background: {
		baseColor: '#0a0304',
		gradientType: 'linear',
		gradientColors: ['rgba(225, 29, 72, 0.2)', 'rgba(190, 24, 93, 0.12)'],
		gradientAngle: 160,
		pattern: 'blood-splatter',
		patternOpacity: 0.08,
		vignetteStrength: 0.88,
		vignetteColor: 'rgba(10, 3, 4, 0.95)'
	},
	particles: {
		type: 'blood-drops',
		count: 4,
		color: '#e11d48',
		size: [2, 4],
		opacity: [0.2, 0.5],
		animated: true
	},
	divider: {
		type: 'chains',
		color: '#7f1d1d',
		width: 100
	},
	typography: {
		titleColor: '#fff1f2',
		titleGlow: 'rgba(225, 29, 72, 0.4)',
		titleGlowStrength: 22,
		titleShadow: 'rgba(30, 0, 10, 0.95)',
		titleWeight: 800,
		titleLetterSpacing: '0.02em',
		titleTransform: 'uppercase',
		descriptionColor: '#fb7185',
		descriptionOpacity: 0.9,
		badgeColor: '#fda4af',
		badgeBgColor: 'rgba(225, 29, 72, 0.2)',
		badgeBorderColor: 'rgba(225, 29, 72, 0.4)'
	}
};

export const LOCATION_STYLE_VOID: CardStyleDefinition = {
	id: 'stage_location_v6_void',
	name: 'Void',
	description: 'Cosmic abyss - reality-bending space, impossible geometry',
	colors: {
		primary: '#4f46e5',
		secondary: '#1e1b4b',
		accent: '#a5b4fc',
		text: '#eef2ff',
		textSecondary: '#818cf8',
		glow: 'rgba(79, 70, 229, 0.45)',
		shadow: 'rgba(0, 0, 20, 0.98)'
	},
	frame: {
		type: 'warped',
		thickness: 2,
		cornerStyle: 'impossible',
		color: '#4f46e5',
		secondaryColor: '#312e81'
	},
	background: {
		baseColor: '#020308',
		gradientType: 'conic',
		gradientColors: ['rgba(79, 70, 229, 0.18)', 'rgba(30, 27, 75, 0.14)', 'rgba(79, 70, 229, 0.18)'],
		pattern: 'stars',
		patternOpacity: 0.2,
		vignetteStrength: 0.85,
		vignetteColor: 'rgba(2, 3, 8, 0.95)'
	},
	particles: {
		type: 'stars',
		count: 15,
		color: '#a5b4fc',
		size: [1, 2],
		opacity: [0.15, 0.6],
		animated: true
	},
	divider: {
		type: 'tentacles',
		color: '#4f46e5',
		width: 140
	},
	typography: {
		titleColor: '#eef2ff',
		titleGlow: 'rgba(79, 70, 229, 0.35)',
		titleGlowStrength: 35,
		titleShadow: 'rgba(0, 0, 20, 0.98)',
		titleWeight: 700,
		titleLetterSpacing: '0.08em',
		titleTransform: 'uppercase',
		descriptionColor: '#818cf8',
		descriptionOpacity: 0.85,
		badgeColor: '#a5b4fc',
		badgeBgColor: 'rgba(79, 70, 229, 0.15)',
		badgeBorderColor: 'rgba(79, 70, 229, 0.3)'
	}
};

export const LOCATION_STYLE_FAIRY: CardStyleDefinition = {
	id: 'stage_location_v6_fairy',
	name: 'Fairy',
	description: 'Enchanted glade - magical sparkles, fae blessing',
	colors: {
		primary: '#ec4899',
		secondary: '#a855f7',
		accent: '#fbcfe8',
		text: '#fdf2f8',
		textSecondary: '#f9a8d4',
		glow: 'rgba(236, 72, 153, 0.5)',
		shadow: 'rgba(30, 10, 25, 0.85)'
	},
	frame: {
		type: 'organic',
		thickness: 2,
		cornerStyle: 'vine',
		color: '#ec4899',
		secondaryColor: '#f472b6'
	},
	background: {
		baseColor: '#140810',
		gradientType: 'radial',
		gradientColors: ['rgba(236, 72, 153, 0.2)', 'rgba(168, 85, 247, 0.12)'],
		pattern: 'stars',
		patternOpacity: 0.1,
		vignetteStrength: 0.7,
		vignetteColor: 'rgba(20, 8, 16, 0.85)'
	},
	particles: {
		type: 'sparkles',
		count: 10,
		color: '#fbcfe8',
		size: [2, 4],
		opacity: [0.3, 0.8],
		animated: true
	},
	divider: {
		type: 'halo',
		color: '#f472b6',
		width: 110
	},
	typography: {
		titleColor: '#fdf2f8',
		titleGlow: 'rgba(236, 72, 153, 0.4)',
		titleGlowStrength: 22,
		titleShadow: 'rgba(30, 10, 25, 0.85)',
		titleWeight: 700,
		titleLetterSpacing: '0.03em',
		titleTransform: 'capitalize',
		descriptionColor: '#f9a8d4',
		descriptionOpacity: 0.95,
		badgeColor: '#fbcfe8',
		badgeBgColor: 'rgba(236, 72, 153, 0.2)',
		badgeBorderColor: 'rgba(236, 72, 153, 0.4)'
	}
};

// ============================================================================
// TRAVELER-THEMED LOCATION STYLES
// ============================================================================

export const LOCATION_STYLE_PARCHMENT: CardStyleDefinition = {
	id: 'stage_location_v6_parchment',
	name: 'Parchment',
	description: 'Weathered explorer journal - leather-bound, sepia-toned, aged pages',
	colors: {
		primary: '#c9a86c',
		secondary: '#8b6914',
		accent: '#e8dcc4',
		text: '#4a3520',
		textSecondary: '#7a5a38',
		glow: 'rgba(201, 168, 108, 0.45)',
		shadow: 'rgba(45, 30, 15, 0.85)'
	},
	frame: {
		type: 'stitched',
		thickness: 3,
		cornerStyle: 'brass-clasp',
		color: '#8b6914',
		secondaryColor: '#c9a86c'
	},
	background: {
		baseColor: '#2a1f14',
		gradientType: 'radial',
		gradientColors: ['rgba(232, 220, 196, 0.15)', 'rgba(139, 105, 20, 0.1)'],
		pattern: 'paper',
		patternOpacity: 0.08,
		vignetteStrength: 0.75,
		vignetteColor: 'rgba(58, 40, 21, 0.9)'
	},
	particles: {
		type: 'dust',
		count: 8,
		color: '#e8dcc4',
		size: [1, 3],
		opacity: [0.2, 0.5],
		animated: true
	},
	divider: {
		type: 'ornate',
		color: '#c9a86c',
		width: 100
	},
	typography: {
		titleColor: '#e8dcc4',
		titleGlow: 'rgba(201, 168, 108, 0.4)',
		titleGlowStrength: 18,
		titleShadow: 'rgba(45, 30, 15, 0.9)',
		titleWeight: 800,
		titleLetterSpacing: '0.04em',
		titleTransform: 'uppercase',
		descriptionColor: '#d9c9a8',
		descriptionOpacity: 0.95,
		badgeColor: '#e8dcc4',
		badgeBgColor: 'rgba(139, 105, 20, 0.2)',
		badgeBorderColor: 'rgba(201, 168, 108, 0.4)'
	}
};

export const LOCATION_STYLE_CARTOGRAPHER: CardStyleDefinition = {
	id: 'stage_location_v6_cartographer',
	name: 'Cartographer',
	description: 'Maritime navigation charts - nautical teal, compass motifs, sea-worn',
	colors: {
		primary: '#2d5a5a',
		secondary: '#1a3d4d',
		accent: '#c9a86c',
		text: '#d4c5a9',
		textSecondary: '#7a9a8a',
		glow: 'rgba(45, 90, 90, 0.5)',
		shadow: 'rgba(15, 35, 45, 0.9)'
	},
	frame: {
		type: 'ruled',
		thickness: 3,
		cornerStyle: 'compass',
		color: '#2d5a5a',
		secondaryColor: '#c9a86c'
	},
	background: {
		baseColor: '#0d1f2a',
		gradientType: 'radial',
		gradientColors: ['rgba(45, 90, 90, 0.2)', 'rgba(26, 61, 77, 0.15)'],
		pattern: 'grid',
		patternOpacity: 0.06,
		vignetteStrength: 0.8,
		vignetteColor: 'rgba(13, 31, 42, 0.92)'
	},
	particles: {
		type: 'seafoam',
		count: 10,
		color: '#d4c5a9',
		size: [1, 2],
		opacity: [0.3, 0.6],
		animated: false
	},
	divider: {
		type: 'simple',
		color: '#c9a86c',
		width: 90
	},
	typography: {
		titleColor: '#d4c5a9',
		titleGlow: 'rgba(45, 90, 90, 0.45)',
		titleGlowStrength: 20,
		titleShadow: 'rgba(15, 35, 45, 0.95)',
		titleWeight: 700,
		titleLetterSpacing: '0.05em',
		titleTransform: 'uppercase',
		descriptionColor: '#7a9a8a',
		descriptionOpacity: 0.9,
		badgeColor: '#c9a86c',
		badgeBgColor: 'rgba(45, 90, 90, 0.2)',
		badgeBorderColor: 'rgba(201, 168, 108, 0.35)'
	}
};

export const LOCATION_STYLE_MERCHANT: CardStyleDefinition = {
	id: 'stage_location_v6_merchant',
	name: 'Merchant',
	description: 'Gilded trade ledger - deep velvet green, gold leaf, prosperous',
	colors: {
		primary: '#2a5a3a',
		secondary: '#1a3a28',
		accent: '#d4a84b',
		text: '#f0e6d2',
		textSecondary: '#a8c4a8',
		glow: 'rgba(212, 168, 75, 0.55)',
		shadow: 'rgba(20, 45, 30, 0.9)'
	},
	frame: {
		type: 'gilded',
		thickness: 4,
		cornerStyle: 'medallion',
		color: '#d4a84b',
		secondaryColor: '#2a5a3a'
	},
	background: {
		baseColor: '#0a1f15',
		gradientType: 'radial',
		gradientColors: ['rgba(42, 90, 58, 0.2)', 'rgba(26, 58, 40, 0.15)'],
		pattern: 'geometric',
		patternOpacity: 0.05,
		vignetteStrength: 0.78,
		vignetteColor: 'rgba(10, 31, 21, 0.92)'
	},
	particles: {
		type: 'goldleaf',
		count: 8,
		color: '#d4a84b',
		size: [1, 3],
		opacity: [0.3, 0.7],
		animated: true
	},
	divider: {
		type: 'deco',
		color: '#d4a84b',
		width: 100
	},
	typography: {
		titleColor: '#f0e6d2',
		titleGlow: 'rgba(212, 168, 75, 0.5)',
		titleGlowStrength: 22,
		titleShadow: 'rgba(20, 45, 30, 0.95)',
		titleWeight: 800,
		titleLetterSpacing: '0.03em',
		titleTransform: 'uppercase',
		descriptionColor: '#a8c4a8',
		descriptionOpacity: 0.92,
		badgeColor: '#d4a84b',
		badgeBgColor: 'rgba(212, 168, 75, 0.15)',
		badgeBorderColor: 'rgba(212, 168, 75, 0.4)'
	}
};

export const LOCATION_STYLE_ANCIENT: CardStyleDefinition = {
	id: 'stage_location_v6_ancient',
	name: 'Ancient',
	description: 'Unearthed bronze relic - weathered stone, amber glow, mystical runes',
	colors: {
		primary: '#8b5a2b',
		secondary: '#5a3a1e',
		accent: '#d4a574',
		text: '#e8dcc4',
		textSecondary: '#a89070',
		glow: 'rgba(212, 165, 116, 0.5)',
		shadow: 'rgba(45, 29, 15, 0.92)'
	},
	frame: {
		type: 'carved',
		thickness: 4,
		cornerStyle: 'rune-mark',
		color: '#8b5a2b',
		secondaryColor: '#d4a574'
	},
	background: {
		baseColor: '#1a0f08',
		gradientType: 'radial',
		gradientColors: ['rgba(139, 90, 43, 0.2)', 'rgba(90, 58, 30, 0.15)'],
		pattern: 'cracks',
		patternOpacity: 0.08,
		vignetteStrength: 0.85,
		vignetteColor: 'rgba(26, 15, 8, 0.94)'
	},
	particles: {
		type: 'cinders',
		count: 6,
		color: '#d4a574',
		size: [2, 4],
		opacity: [0.4, 0.8],
		animated: true
	},
	divider: {
		type: 'ornate',
		color: '#d4a574',
		width: 95
	},
	typography: {
		titleColor: '#e8dcc4',
		titleGlow: 'rgba(212, 165, 116, 0.55)',
		titleGlowStrength: 25,
		titleShadow: 'rgba(45, 29, 15, 0.95)',
		titleWeight: 900,
		titleLetterSpacing: '0.06em',
		titleTransform: 'uppercase',
		descriptionColor: '#a89070',
		descriptionOpacity: 0.9,
		badgeColor: '#d4a574',
		badgeBgColor: 'rgba(139, 90, 43, 0.2)',
		badgeBorderColor: 'rgba(212, 165, 116, 0.4)'
	}
};

// ============================================================================
// STYLE LOOKUP MAPS
// ============================================================================

export const EVENT_STYLES: Record<string, CardStyleDefinition> = {
	'event_v6': EVENT_STYLE_ARCANE,
	'event_v6_ember': EVENT_STYLE_EMBER,
	'event_v6_frost': EVENT_STYLE_FROST,
	'event_v6_verdant': EVENT_STYLE_VERDANT,
	'event_v6_shadow': EVENT_STYLE_SHADOW,
	'event_v6_radiant': EVENT_STYLE_RADIANT,
	'event_v6_crimson': EVENT_STYLE_CRIMSON,
	'event_v6_void': EVENT_STYLE_VOID,
	'event_v6_fairy': EVENT_STYLE_FAIRY
};

export const LOCATION_STYLES: Record<string, CardStyleDefinition> = {
	'stage_location_v6_arcane': LOCATION_STYLE_ARCANE,
	'stage_location_v6_ember': LOCATION_STYLE_EMBER,
	'stage_location_v6_frost': LOCATION_STYLE_FROST,
	'stage_location_v6_verdant': LOCATION_STYLE_VERDANT,
	'stage_location_v6_shadow': LOCATION_STYLE_SHADOW,
	'stage_location_v6_radiant': LOCATION_STYLE_RADIANT,
	'stage_location_v6_crimson': LOCATION_STYLE_CRIMSON,
	'stage_location_v6_void': LOCATION_STYLE_VOID,
	'stage_location_v6_fairy': LOCATION_STYLE_FAIRY,
	'stage_location_v6_parchment': LOCATION_STYLE_PARCHMENT,
	'stage_location_v6_cartographer': LOCATION_STYLE_CARTOGRAPHER,
	'stage_location_v6_merchant': LOCATION_STYLE_MERCHANT,
	'stage_location_v6_ancient': LOCATION_STYLE_ANCIENT
};

export function getEventStyleDefinition(styleId: string): CardStyleDefinition {
	return EVENT_STYLES[styleId] ?? EVENT_STYLE_ARCANE;
}

export function getLocationStyleDefinition(styleId: string): CardStyleDefinition {
	return LOCATION_STYLES[styleId] ?? LOCATION_STYLE_ARCANE;
}
