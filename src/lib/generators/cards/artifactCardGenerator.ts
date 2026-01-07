import type { ArtifactRow, OriginRow, RuneRow, ArtifactTagRow, GuardianRow } from '$lib/types/gameData';
import { generateRuneIconCanvas } from '$lib/utils/runeIconGenerator';
import { supabase } from '$lib/api/supabaseClient';
import { createCanvas, getContext, loadImage, canvasToBlob, roundRect, loadOpsilonFont, wrapText } from '../shared/canvas';

function measureTextWithLetterSpacing(
	ctx: CanvasRenderingContext2D,
	text: string,
	letterSpacing: number
): number {
	if (!text) return 0;
	const chars = Array.from(text);
	let width = 0;
	for (const ch of chars) width += ctx.measureText(ch).width;
	if (chars.length > 1) width += letterSpacing * (chars.length - 1);
	return width;
}

function fillTextWithLetterSpacing(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	letterSpacing: number
): void {
	if (!letterSpacing || !text) {
		ctx.fillText(text, x, y);
		return;
	}

	const align = ctx.textAlign;
	const alignMode = align === 'center' ? 'center' : align === 'right' || align === 'end' ? 'right' : 'left';
	const totalWidth = measureTextWithLetterSpacing(ctx, text, letterSpacing);
	let startX = x;
	if (alignMode === 'center') startX = x - totalWidth / 2;
	else if (alignMode === 'right') startX = x - totalWidth;

	const originalAlign = ctx.textAlign;
	ctx.textAlign = 'left';
	for (const ch of Array.from(text)) {
		ctx.fillText(ch, startX, y);
		startX += ctx.measureText(ch).width + letterSpacing;
	}
	ctx.textAlign = originalAlign;
}

/**
 * V17 Diagonal Sidebar Layout - Canvas Implementation
 * Matches the Svelte component ArtifactCardV17.svelte
 */
export async function generateArtifactCardPNG(
	artifact: ArtifactRow,
	origins: OriginRow[],
	runes: RuneRow[],
	tags: ArtifactTagRow[] = [],
	guardians: Pick<GuardianRow, 'id' | 'name'>[] = []
): Promise<Blob> {
	if (!artifact.id || !artifact.name) {
		throw new Error('Artifact missing ID or name');
	}

	// Load Opsilon font
	await loadOpsilonFont();

	// Card dimensions: 300px x 225px at 4x resolution
	const scale = 4;
	const width = 300;
	const height = 225;

	// Create canvas at 4x resolution
	const canvas = createCanvas(width * scale, height * scale);
	const ctx = getContext(canvas);
	ctx.scale(scale, scale);

	// Colors matching V17
	const colors = {
		cardBg: '#1a1520',
		mainAreaBg1: '#2a2035',
		mainAreaBg2: '#1a1520',
		sidebarBg1: '#3a2a40',
		sidebarBg2: '#2a1a30',
		gold: '#c4a060',
		goldLight: 'rgba(196, 160, 96, 0.6)',
		goldDim: 'rgba(196, 160, 96, 0.4)',
		textPrimary: '#e8d4b8',
		textSecondary: '#a8a0b0',
		textMuted: '#908898'
	};

	// Get guardian name
	const guardian = guardians.find((g) => g.id === artifact.guardian_id);
	const guardianName = guardian?.name || null;

	// Get tag names
	const tagNames = (artifact.tag_ids || [])
		.map((id) => tags.find((t) => t.id === id)?.name)
		.filter(Boolean) as string[];

	// Helper to get rune icon URL
	const getRuneIconUrl = async (runeId: string): Promise<string | null> => {
		const rune = runes.find((r) => r.id === runeId);
		if (!rune) return null;
		const origin = origins.find((o) => o.id === rune.origin_id);
		if (!origin) return null;

		// If rune has a saved icon_path, use that
		if (rune.icon_path) {
			const { data } = supabase.storage.from('game_assets').getPublicUrl(rune.icon_path);
			if (data?.publicUrl) return data.publicUrl;
		}

		// Otherwise try to generate from origin icon
		let iconUrl = null;
		let iconEmoji = null;

		if (origin.icon_png) {
			const path = origin.icon_png.startsWith('origin_icons/') ? origin.icon_png : `origin_icons/${origin.icon_png}`;
			const { data } = supabase.storage.from('game_assets').getPublicUrl(path);
			iconUrl = data?.publicUrl || null;
		} else if (origin.icon_emoji) {
			iconEmoji = origin.icon_emoji;
		}

			// Load rune background
			let runeBackgroundUrl: string | null = null;
			try {
				const candidates = [
					rune.icon_background_path ?? null,
					'rune_backgrounds/background.png'
				].filter((path): path is string => !!path);

				for (const candidate of candidates) {
					const normalized = candidate.startsWith('game_assets/') ? candidate.slice('game_assets/'.length) : candidate;
					const { data } = supabase.storage.from('game_assets').getPublicUrl(normalized);
					if (!data?.publicUrl) continue;
					const response = await fetch(data.publicUrl, { method: 'HEAD' });
					if (response.ok) {
						runeBackgroundUrl = data.publicUrl;
						break;
					}
				}
			} catch {
				// Background not available
			}

		try {
			return await generateRuneIconCanvas({
				originIconUrl: iconUrl,
				originIconEmoji: iconEmoji,
				backgroundUrl: runeBackgroundUrl,
				size: 192 // 48px * 4x scale
			});
		} catch {
			return null;
		}
	};

	// Collect recipe icon URLs
	const recipeIcons: string[] = [];
	if (artifact.recipe_box && artifact.recipe_box.length > 0) {
		for (const item of artifact.recipe_box) {
			for (let i = 0; i < item.quantity; i++) {
				const iconUrl = await getRuneIconUrl(item.rune_id);
				if (iconUrl) recipeIcons.push(iconUrl);
			}
		}
	}

	// === Draw Card ===

	// Card background
	ctx.fillStyle = colors.cardBg;
	roundRect(ctx, 0, 0, width, height, 6);
	ctx.fill();

	// Main area with diagonal clip (covers left ~80% of card)
	ctx.save();
	ctx.beginPath();
	ctx.moveTo(0, 0);
	// Match ArtifactCardV17.svelte: clip-path polygon(0 0, 100% 0, 80% 100%, 0 100%)
	ctx.lineTo(width, 0);
	ctx.lineTo(width * 0.8, height);
	ctx.lineTo(0, height);
	ctx.closePath();
	ctx.clip();

	// Main area gradient background
	const mainGradient = ctx.createLinearGradient(0, 0, width, height);
	mainGradient.addColorStop(0, colors.mainAreaBg1);
	mainGradient.addColorStop(1, colors.mainAreaBg2);
	ctx.fillStyle = mainGradient;
	ctx.fillRect(0, 0, width, height);

	// Diagonal accent (subtle gold gradient on right edge of main area)
	// Match ArtifactCardV17.svelte: width 60px, positioned at right: 0, with a 135deg gradient.
	const accentWidth = 60;
	const accentGradient = ctx.createLinearGradient(width - accentWidth, 0, width, height);
	accentGradient.addColorStop(0, 'transparent');
	accentGradient.addColorStop(0.4, 'transparent');
	accentGradient.addColorStop(1, 'rgba(180, 140, 100, 0.1)');
	ctx.fillStyle = accentGradient;
	ctx.fillRect(width - accentWidth, 0, accentWidth, height);

	ctx.restore();

	// === Draw Content ===

	const padding = 12;
	const contentMaxX = width - 93; // padding-right: 93px

	// Header row: Sigil + Name
	ctx.fillStyle = colors.gold;
	ctx.font = '24px Opsilon, serif';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.shadowColor = 'rgba(196, 160, 96, 0.5)';
	ctx.shadowBlur = 8;
	ctx.fillText('◆', padding, padding);
	ctx.shadowBlur = 0;

	ctx.fillStyle = colors.textPrimary;
	ctx.font = '700 22px Opsilon, serif';
	const nameX = padding + 32; // gap: 8px + sigil width
	// Match CSS letter-spacing: 0.5px
	fillTextWithLetterSpacing(ctx, artifact.name, nameX, padding, 0.5);

	// Slant divider (skewed line below name)
	const dividerY = padding + 32; // margin-bottom: 8px after title
	ctx.save();
	ctx.translate(padding, dividerY);
	ctx.transform(1, 0, -0.105, 1, 0, 0); // skewX(-6deg)
	const dividerGradient = ctx.createLinearGradient(0, 0, contentMaxX * 0.8, 0);
	dividerGradient.addColorStop(0, colors.gold);
	dividerGradient.addColorStop(1, 'transparent');
	ctx.fillStyle = dividerGradient;
	ctx.fillRect(0, 0, contentMaxX * 0.8, 4); // height: 4px
	ctx.restore();

	// Benefit text
	ctx.fillStyle = colors.textSecondary;
	ctx.font = '13px Opsilon, serif';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';

	const benefitText = artifact.benefit || '';
	const benefitStartY = dividerY + 14; // margin-bottom: 10px
	const maxBenefitWidth = contentMaxX - padding;
	const lines = wrapText(ctx, benefitText, maxBenefitWidth);

	const lineHeight = 18.2; // 13px * 1.4
	lines.forEach((line, i) => {
		ctx.fillText(line, padding, benefitStartY + i * lineHeight);
	});

	// Bottom info section
	const bottomY = height - padding - 14;

	// Draw separator line
	ctx.strokeStyle = 'rgba(180, 140, 100, 0.2)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(padding, bottomY - 9);
	ctx.lineTo(contentMaxX, bottomY - 9);
	ctx.stroke();

	ctx.font = '13px Opsilon, serif';
	ctx.textBaseline = 'top';

	if (guardianName) {
		ctx.fillStyle = colors.gold;
		ctx.font = '600 13px Opsilon, serif';
		ctx.fillText(`⚔ ${guardianName}`, padding, bottomY);
	}

	if (tagNames.length > 0) {
		ctx.fillStyle = colors.textMuted;
		ctx.font = '13px Opsilon, serif';
		ctx.textAlign = 'right';
		ctx.fillText(tagNames.join(' • '), contentMaxX, bottomY);
		ctx.textAlign = 'left';
	}

	// === Draw Diagonal Sidebar ===

	const sidebarWidth = 59;
	const sidebarX = width - sidebarWidth;

	// Sidebar background with skew
	ctx.save();
	ctx.beginPath();
	// Create skewed parallelogram shape
	const skewOffset = Math.tan(8 * Math.PI / 180) * height; // 8 degrees
	ctx.moveTo(sidebarX + sidebarWidth * 0.3 + skewOffset, 0);
	ctx.lineTo(width, 0);
	ctx.lineTo(width, height);
	ctx.lineTo(sidebarX + sidebarWidth * 0.3 - skewOffset, height);
	ctx.closePath();
	ctx.clip();

	const sidebarGradient = ctx.createLinearGradient(0, 0, 0, height);
	sidebarGradient.addColorStop(0, colors.sidebarBg1);
	sidebarGradient.addColorStop(1, colors.sidebarBg2);
	ctx.fillStyle = sidebarGradient;
	ctx.fillRect(sidebarX, 0, sidebarWidth, height);

	// Sidebar gold border (left edge)
	ctx.strokeStyle = colors.gold;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(sidebarX + sidebarWidth * 0.3 + skewOffset, 0);
	ctx.lineTo(sidebarX + sidebarWidth * 0.3 - skewOffset, height);
	ctx.stroke();

	ctx.restore();

	// Draw rune stack (staggered left, starting from top)
	if (recipeIcons.length > 0) {
		const runeSize = 48;
		const runeGap = 6;
		const startY = 9 + runeSize / 2; // margin-top: 9px
		const centerX = sidebarX + sidebarWidth / 2; // margin-left: 0px

		for (let i = 0; i < recipeIcons.length; i++) {
			const offsetX = i * -9; // -9px offset per rune
			const x = centerX + offsetX;
			const y = startY + i * (runeSize + runeGap);
			const radius = runeSize / 2;

			// Rune slot background (circle)
			ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
			ctx.beginPath();
			ctx.arc(x, y, radius, 0, Math.PI * 2);
			ctx.fill();

			// Rune slot border (circle)
			ctx.strokeStyle = colors.goldLight;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(x, y, radius, 0, Math.PI * 2);
			ctx.stroke();

			// Draw rune icon (clipped to circle)
			try {
				const img = await loadImage(recipeIcons[i]);
				ctx.save();
				ctx.beginPath();
				ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
				ctx.clip();
				ctx.drawImage(img, x - radius + 2, y - radius + 2, runeSize - 4, runeSize - 4);
				ctx.restore();
			} catch {
				// Fallback if image fails
				ctx.fillStyle = colors.goldDim;
				ctx.font = '18px Opsilon, serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText('✧', x, y);
			}
		}
	} else {
		// Empty slot placeholder
		ctx.fillStyle = colors.goldDim;
		ctx.font = '18px Opsilon, serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('✧', sidebarX + sidebarWidth / 2, height / 2);
	}

	// Sidebar label ("COST")
	ctx.save();
	ctx.translate(width - 8, height - 8);
	ctx.rotate(-Math.PI / 2);
	ctx.fillStyle = 'rgba(196, 160, 96, 0.6)';
	ctx.font = '8px Opsilon, serif';
	ctx.textAlign = 'right';
	ctx.textBaseline = 'bottom';
	// Match CSS letter-spacing: 2px
	fillTextWithLetterSpacing(ctx, 'COST', 0, 0, 2);
	ctx.restore();

	// Card border radius clip
	ctx.globalCompositeOperation = 'destination-in';
	ctx.fillStyle = '#000';
	roundRect(ctx, 0, 0, width, height, 6);
	ctx.fill();
	ctx.globalCompositeOperation = 'source-over';

	// Card shadow (outer glow)
	// Note: Canvas doesn't support box-shadow the same way, but we've drawn the card

	// Export as PNG to match TTS expectations
	return canvasToBlob(canvas);
}

// Legacy function name for backwards compatibility
export async function generateArtifactCardSVG(
	artifact: ArtifactRow,
	origins: OriginRow[],
	runes: RuneRow[],
	tags: ArtifactTagRow[] = [],
	guardians: Pick<GuardianRow, 'id' | 'name'>[] = []
): Promise<string> {
	// Just return empty string - we're using PNG generation directly now
	return '';
}

// Convert SVG to PNG using Canvas API (legacy - not used anymore)
export async function convertSVGtoPNG(svg: string): Promise<Blob> {
	throw new Error('convertSVGtoPNG is deprecated. Use generateArtifactCardPNG instead.');
}
