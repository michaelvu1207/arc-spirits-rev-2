import type { MonsterRow, SpecialEffectRow } from '$lib/types/gameData';
import { canvasToBlob, createCanvas, getContext, loadImage, loadOpsilonFont, roundRect, wrapText } from '../shared/canvas';
import { getMonsterCardUi, type MonsterCardUiLanguage } from '$lib/i18n/monsterCardUi';

/**
 * Strip HTML tags and decode HTML entities for plain text rendering
 */
function stripHtml(html: string | null | undefined): string {
	if (!html) return '';
	// Remove HTML tags
	let text = html.replace(/<[^>]*>/g, '');
	// Decode common HTML entities
	text = text
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
		.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
	return text;
}

const MONSTER_CARD_WIDTH = 600;
const MONSTER_CARD_HEIGHT = 437;
const EXPORT_SCALE = 2;
const LEFT_PANEL_WIDTH = Math.round(MONSTER_CARD_WIDTH * 0.6); // 1.2fr of 2.0fr
const RIGHT_PANEL_WIDTH = MONSTER_CARD_WIDTH - LEFT_PANEL_WIDTH;
const BOTTOM_BAR_HEIGHT = 72;

const MAIN_PADDING = 20;
const CONTENT_GAP = 10;

function drawImageCover(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	x: number,
	y: number,
	w: number,
	h: number
) {
	const naturalW = img.naturalWidth || img.width || w;
	const naturalH = img.naturalHeight || img.height || h;
	const safeW = naturalW > 0 ? naturalW : w;
	const safeH = naturalH > 0 ? naturalH : h;
	const scale = Math.max(w / safeW, h / safeH);
	const drawW = safeW * scale;
	const drawH = safeH * scale;
	const drawX = x + (w - drawW) / 2;
	const drawY = y + (h - drawH) / 2;
	ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

function drawImageContain(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	x: number,
	y: number,
	w: number,
	h: number
) {
	const naturalW = img.naturalWidth || img.width || w;
	const naturalH = img.naturalHeight || img.height || h;
	const safeW = naturalW > 0 ? naturalW : w;
	const safeH = naturalH > 0 ? naturalH : h;
	const scale = Math.min(w / safeW, h / safeH);
	const drawW = safeW * scale;
	const drawH = safeH * scale;
	const drawX = x + (w - drawW) / 2;
	const drawY = y + (h - drawH) / 2;
	ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

function drawVeinOverlay(ctx: CanvasRenderingContext2D, width: number, height: number) {
	const patternCanvas = document.createElement('canvas');
	patternCanvas.width = 100;
	patternCanvas.height = 100;
	const pctx = patternCanvas.getContext('2d');
	if (!pctx) return;

	pctx.clearRect(0, 0, 100, 100);
	pctx.lineCap = 'round';

	pctx.strokeStyle = 'rgba(69, 10, 10, 0.3)';
	pctx.lineWidth = 1;
	pctx.beginPath();
	pctx.moveTo(10, 50);
	pctx.quadraticCurveTo(30, 20, 50, 50);
	pctx.quadraticCurveTo(70, 80, 90, 50);
	pctx.stroke();

	pctx.strokeStyle = 'rgba(69, 10, 10, 0.2)';
	pctx.lineWidth = 0.75;
	pctx.beginPath();
	pctx.moveTo(20, 30);
	pctx.quadraticCurveTo(40, 60, 60, 30);
	pctx.quadraticCurveTo(80, 0, 100, 30);
	pctx.stroke();

	const pattern = ctx.createPattern(patternCanvas, 'repeat');
	if (!pattern) return;

	ctx.save();
	ctx.globalAlpha = 0.8;
	ctx.fillStyle = pattern;
	ctx.fillRect(0, 0, width, height);
	ctx.restore();
}

function drawSlashMarks(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
	ctx.save();
	ctx.globalAlpha = 1;
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.clip();

	ctx.translate(x + w / 2, y + h / 2);
	ctx.rotate((-45 * Math.PI) / 180);
	ctx.translate(-(x + w / 2), -(y + h / 2));

	ctx.fillStyle = 'rgba(220, 38, 38, 0.2)';
	const stripeW = 2;
	const period = 10;
	const long = Math.max(w, h) * 3;
	for (let i = -long; i < long; i += period) {
		ctx.fillRect(x + i, y - long, stripeW, h + long * 2);
	}

	ctx.restore();
}

function normalizeRewardTrackUrls(track: unknown, killedIndex: number): string[][] {
	const targetLen = killedIndex + 1; // includes slot0 participation
	const safe: string[][] = Array.isArray(track)
		? track.map((slot) =>
				Array.isArray(slot)
					? slot
							.filter((url): url is string => typeof url === 'string')
							.map((url) => url.trim())
							.filter(Boolean)
					: []
			)
		: [];

	while (safe.length < targetLen) safe.push([]);
	return safe.slice(0, targetLen);
}

export async function generateMonsterCardPNG(
	monster: MonsterRow & { effects?: SpecialEffectRow[] },
	artUrl?: string | null,
	iconUrl?: string | null,
	rewardTrackIconUrls?: (string | null)[][],
	language: MonsterCardUiLanguage = 'base'
): Promise<Blob> {
	if (!monster.id || !monster.name) {
		throw new Error('Monster missing ID or name');
	}

	await loadOpsilonFont();
	const ui = getMonsterCardUi(language);

	// Create canvas
	const canvas = createCanvas(MONSTER_CARD_WIDTH * EXPORT_SCALE, MONSTER_CARD_HEIGHT * EXPORT_SCALE);
	const ctx = getContext(canvas);
	ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
	ctx.imageSmoothingEnabled = true;
	try {
		ctx.imageSmoothingQuality = 'high';
	} catch {
		// ignore
	}

		const stageColors: Record<string, string> = {
			stage_1: '#dc2626',
			stage_2: '#991b1b',
			stage_3: '#7f1d1d',
			final_stage: '#a855f7',
			inactive: '#64748b'
		};

		const classificationColors: Record<string, string> = {
			abyss_guardian: '#0ea5e9',
			boss: '#450a0a',
			final_boss: '#be123c'
		};

	const effectTypeColors: Record<string, string> = {
		before_combat: '#f59e0b',
		during_combat: '#ef4444',
		after_combat: '#22c55e',
		combat_type: '#8b5cf6'
	};

	const stageColor = stageColors[monster.stage ?? 'stage_1'] ?? '#dc2626';
	const classification = monster.monster_classification ?? 'monster';
	const classificationText = (ui.classification[classification] ?? ui.classification.monster).toUpperCase();
	const stageKey = monster.stage ?? 'stage_1';
	const stageText = (ui.stage[stageKey as keyof typeof ui.stage] ?? String(stageKey)).toUpperCase();

	ctx.save();
	roundRect(ctx, 0, 0, MONSTER_CARD_WIDTH, MONSTER_CARD_HEIGHT, 4);
	ctx.clip();

	// Base background gradient
	const cardGrad = ctx.createLinearGradient(0, 0, MONSTER_CARD_WIDTH, MONSTER_CARD_HEIGHT);
	cardGrad.addColorStop(0, '#1a0505');
	cardGrad.addColorStop(0.5, '#430d4a');
	cardGrad.addColorStop(1, '#0d0202');
	ctx.fillStyle = cardGrad;
	ctx.fillRect(0, 0, MONSTER_CARD_WIDTH, MONSTER_CARD_HEIGHT);

	drawVeinOverlay(ctx, MONSTER_CARD_WIDTH, MONSTER_CARD_HEIGHT);

	// Art panel (right)
	const artX = LEFT_PANEL_WIDTH;
	const artY = 0;
	const artW = RIGHT_PANEL_WIDTH;
	const contentH = MONSTER_CARD_HEIGHT - BOTTOM_BAR_HEIGHT;
	const artH = contentH;

	if (artUrl) {
		try {
			const artImg = await loadImage(artUrl);
			ctx.save();
			ctx.filter = 'saturate(80%) contrast(120%) brightness(90%)';
			drawImageCover(ctx, artImg, artX, artY, artW, artH);
			ctx.restore();
		} catch (err) {
			console.warn('Failed to load monster art:', err);
		}
	} else {
		const noArtGrad = ctx.createLinearGradient(artX, artY, artX + artW, artY + artH);
		noArtGrad.addColorStop(0, '#1a0505');
		noArtGrad.addColorStop(1, '#0d0202');
		ctx.fillStyle = noArtGrad;
		ctx.fillRect(artX, artY, artW, artH);
	}

	// Art gradient overlay
	const artGrad = ctx.createLinearGradient(artX, 0, artX + artW, 0);
	artGrad.addColorStop(0, 'rgba(26, 5, 5, 0.9)');
	artGrad.addColorStop(0.3, 'rgba(45, 10, 10, 0.4)');
	artGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
	artGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = artGrad;
	ctx.fillRect(artX, artY, artW, artH);

	// Main panel (left)
	const mainGrad = ctx.createLinearGradient(0, 0, LEFT_PANEL_WIDTH, contentH);
	mainGrad.addColorStop(0, 'rgba(45, 10, 10, 0.9)');
	mainGrad.addColorStop(1, 'rgba(26, 5, 5, 0.95)');
	ctx.fillStyle = mainGrad;
	ctx.fillRect(0, 0, LEFT_PANEL_WIDTH, contentH);

	// Slash marks in top-right of main panel
	drawSlashMarks(ctx, LEFT_PANEL_WIDTH - 10 - 60, 10, 60, 80);

	const innerX = MAIN_PADDING;
	const innerW = LEFT_PANEL_WIDTH - MAIN_PADDING * 2;
	let yPos = MAIN_PADDING;

	// Header row: icon + name
	const headerIconSize = 62;
	const headerGap = 14;
	const nameX = innerX + (iconUrl || monster.icon ? headerIconSize + headerGap : 0);
	const headerStartY = yPos;
	const nameTopY = headerStartY;

	const monsterName = monster.name.toUpperCase();
	const maxNameWidth = innerX + innerW - nameX;
	let nameFontSize = 42;
	ctx.fillStyle = '#fecaca';
	while (nameFontSize > 22) {
		ctx.font = `800 ${nameFontSize}px Opsilon, serif`;
		if (ctx.measureText(monsterName).width <= maxNameWidth) break;
		nameFontSize -= 2;
	}

	const nameMetrics = ctx.measureText(monsterName);
	const nameAscent = nameMetrics.actualBoundingBoxAscent || nameFontSize * 0.8;
	const nameDescent = nameMetrics.actualBoundingBoxDescent || nameFontSize * 0.2;
	const nameLineH = nameAscent + nameDescent;
	const nameBaselineY = nameTopY + nameAscent;

	ctx.save();
	ctx.shadowColor = 'rgba(220, 38, 38, 0.5)';
	ctx.shadowBlur = 10;
	ctx.shadowOffsetY = 0;
	ctx.shadowOffsetX = 0;
	ctx.fillText(monsterName, nameX, nameBaselineY);
	ctx.restore();

	// Tags under the name (classification + stage)
	const tagFontSize = 13;
	const tagH = 22;
	const tagPadX = 12;
	const tagGap = 8;
	const tagRadius = 4;
	const tagsY = nameTopY + nameLineH + 6;

	ctx.save();
	ctx.font = `700 ${tagFontSize}px Opsilon, serif`;
	let tagX = nameX;

	if (classification !== 'monster') {
		const tagText = classificationText;
		const tagW = ctx.measureText(tagText).width + tagPadX * 2;
		ctx.fillStyle = classificationColors[classification] ?? '#334155';
		roundRect(ctx, tagX, tagsY, tagW, tagH, tagRadius);
		ctx.fill();
		ctx.fillStyle = '#e2e8f0';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(tagText, tagX + tagW / 2, tagsY + tagH / 2 + 0.5);
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		tagX += tagW + tagGap;
	}

	{
		const tagText = stageText;
		const tagW = ctx.measureText(tagText).width + tagPadX * 2;
		ctx.fillStyle = stageColor;
		roundRect(ctx, tagX, tagsY, tagW, tagH, tagRadius);
		ctx.fill();
		ctx.fillStyle = '#fecaca';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(tagText, tagX + tagW / 2, tagsY + tagH / 2 + 0.5);
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
	}

	ctx.restore();

	let nameBlockBottomY = tagsY + tagH;

	if ((monster as any).invade_location_name) {
		const sep = ui.invadesPrefix.endsWith('：') ? '' : ' ';
		const invadeText = `${ui.invadesPrefix}${sep}${(monster as any).invade_location_name}`;
		ctx.font = 'italic 600 15px Opsilon, serif';
		const invadeMetrics = ctx.measureText(invadeText);
		const invadeAscent = invadeMetrics.actualBoundingBoxAscent || 10;
		const invadeDescent = invadeMetrics.actualBoundingBoxDescent || 4;
		const invadeLineH = invadeAscent + invadeDescent;
		const invadeTopY = nameBlockBottomY + 4;
		const invadeBaselineY = invadeTopY + invadeAscent;

		ctx.fillStyle = '#b89090';
		ctx.fillText(invadeText, nameX, invadeBaselineY);
		nameBlockBottomY = invadeTopY + invadeLineH;
	}

	const nameBlockH = nameBlockBottomY - nameTopY;
	const headerH = Math.max(headerIconSize, nameBlockH);
	const iconY = headerStartY + (headerH - headerIconSize) / 2;

	if (iconUrl) {
		try {
			const iconImg = await loadImage(iconUrl);
			ctx.save();
			ctx.shadowColor = 'rgba(220, 38, 38, 0.4)';
			ctx.shadowBlur = 15;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
			roundRect(ctx, innerX, iconY, headerIconSize, headerIconSize, 4);
			ctx.fill();
			ctx.shadowColor = 'transparent';
			drawImageContain(ctx, iconImg, innerX, iconY, headerIconSize, headerIconSize);
			ctx.strokeStyle = '#991b1b';
			ctx.lineWidth = 2;
			roundRect(ctx, innerX, iconY, headerIconSize, headerIconSize, 4);
			ctx.stroke();
			ctx.restore();
		} catch (err) {
			console.warn('Failed to load monster icon:', err);
		}
	} else if (monster.icon) {
		ctx.save();
		ctx.font = '800 52px Opsilon, serif';
		ctx.fillStyle = '#fecaca';
		ctx.shadowColor = 'rgba(220, 38, 38, 0.6)';
		ctx.shadowBlur = 10;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(monster.icon, innerX + headerIconSize / 2, iconY + headerIconSize / 2 + 2);
		ctx.restore();
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
	}

	yPos = headerStartY + headerH + CONTENT_GAP;

	// Content area ends above the bottom bar.
	const innerBottom = contentH - MAIN_PADDING;

	// Effects section: flexes to fill remaining space and always renders (hosts damage box).
	const effects = monster.effects ?? [];
	const effectTypeOrder = ['before_combat', 'during_combat', 'after_combat', 'combat_type'] as const;
	const available = innerBottom - yPos;
	const effectsHeight = Math.max(0, available);

	// Effects section background
	const effectsX = innerX;
	const effectsY = yPos;
	const effectsW = innerW;
	const effectsH = effectsHeight;

	if (effectsH > 0) {
		ctx.save();
		ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
		ctx.beginPath();
		ctx.moveTo(effectsX, effectsY);
		ctx.lineTo(effectsX + effectsW, effectsY);
		ctx.lineTo(effectsX + effectsW - 6, effectsY + effectsH);
		ctx.lineTo(effectsX, effectsY + effectsH);
		ctx.closePath();
		ctx.fill();

		ctx.fillStyle = '#dc2626';
		ctx.fillRect(effectsX, effectsY, 4, effectsH);

			const pad = 14;
			const bulletSize = 8;
			const bulletGap = 10;
			const EFFECT_TEXT_SCALE = 0.8;
			const lineHeight = Math.max(10, Math.round(20 * EFFECT_TEXT_SCALE));
			const typeBadgeHeight = Math.max(10, Math.round(18 * EFFECT_TEXT_SCALE));
			const effectGap = Math.max(6, Math.round(10 * EFFECT_TEXT_SCALE));
			const typeBadgeGap = Math.max(3, Math.round(5 * EFFECT_TEXT_SCALE));
			const firstLineYOffset = Math.max(8, Math.round(12 * EFFECT_TEXT_SCALE));
			const bulletBaselineOffset = Math.max(3, Math.round(5 * EFFECT_TEXT_SCALE));
			const noEffectsFontSize = Math.max(10, Math.round(15 * EFFECT_TEXT_SCALE));
			const typeFontSize = Math.max(10, Math.round(14 * EFFECT_TEXT_SCALE));
			const effectNameFontSize = Math.max(10, Math.round(15 * EFFECT_TEXT_SCALE));
			const effectBodyFontSize = Math.max(10, Math.round(15 * EFFECT_TEXT_SCALE));

			let effectY = effectsY + pad;
			const maxY = effectsY + effectsH - pad;
			const maxTextW = effectsW - pad * 2 - bulletSize - bulletGap;
			const textX = effectsX + pad + bulletSize + bulletGap;
			const bulletX = effectsX + pad + bulletSize / 2;

			if (effects.length === 0) {
				ctx.font = `400 ${noEffectsFontSize}px Opsilon, serif`;
				ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
				ctx.fillText(ui.noSpecialEffects, effectsX + pad, effectY + firstLineYOffset);
			} else {
				const displayedEffects = effects.slice(0, 4);
				const byType = new Map<(typeof effectTypeOrder)[number], typeof displayedEffects>();

			for (const effect of displayedEffects) {
				const effectType = ((effect as any).effect_type ?? 'during_combat') as (typeof effectTypeOrder)[number];
				const next = byType.get(effectType) ?? [];
				next.push(effect);
				byType.set(effectType, next);
			}

			for (const effectType of effectTypeOrder) {
				const group = byType.get(effectType);
				if (!group || group.length === 0) continue;
				if (effectY > maxY) break;

				const typeLabel = ui.effectType[effectType as keyof typeof ui.effectType] ?? ui.effectType.during_combat;
					const typeColor = effectTypeColors[effectType] ?? effectTypeColors.during_combat;

					ctx.save();
					ctx.font = `700 ${typeFontSize}px Opsilon, serif`;
					ctx.fillStyle = typeColor;
					ctx.globalAlpha = 0.9;
					ctx.fillText(typeLabel, effectsX + pad, effectY + typeBadgeHeight);
					ctx.restore();

					effectY += typeBadgeHeight + typeBadgeGap;

					for (const effect of group) {
						if (effectY > maxY) break;

						const desc = stripHtml(effect.description).trim();

						// First line baseline
						const firstLineY = effectY + firstLineYOffset;

						// Bullet diamond (vertically centered with first line text)
						ctx.save();
						ctx.translate(bulletX, firstLineY - bulletBaselineOffset);
						ctx.rotate(Math.PI / 4);
						ctx.fillStyle = '#dc2626';
						ctx.fillRect(-bulletSize / 2, -bulletSize / 2, bulletSize, bulletSize);
						ctx.restore();

						ctx.font = `700 ${effectNameFontSize}px Opsilon, serif`;
						ctx.fillStyle = '#fca5a5';
						const nameText = `${effect.name}:`;
						const nameW = ctx.measureText(nameText).width;
						ctx.fillText(nameText, textX, firstLineY);

						ctx.font = `400 ${effectBodyFontSize}px Opsilon, serif`;
						ctx.fillStyle = '#a8a0b0';

					const firstLineX = textX + nameW + 4;
					const firstLineMaxW = Math.max(10, effectsX + effectsW - pad - firstLineX);
					const firstLine = desc ? wrapText(ctx, desc, firstLineMaxW)[0] ?? '' : '';
					if (firstLine) {
						ctx.fillText(firstLine, firstLineX, firstLineY);
					}

					let used = firstLine ? firstLine.split(' ').length : 0;
					let remainder = desc;
					if (firstLine && desc) {
						const words = desc.split(/\s+/);
						remainder = words.slice(used).join(' ').trim();
					}

					effectY = firstLineY + lineHeight;
					if (remainder) {
						const lines = wrapText(ctx, remainder, maxTextW);
						for (const line of lines) {
							if (effectY > maxY) break;
							ctx.fillText(line, textX, effectY);
							effectY += lineHeight;
						}
					}

					effectY += effectGap;
				}
			}
		}

		ctx.restore();
	}

	yPos += effectsH;

	// Bottom damage bar (spans entire card)
	const bottomBarY = MONSTER_CARD_HEIGHT - BOTTOM_BAR_HEIGHT;
	const bottomBarH = BOTTOM_BAR_HEIGHT;
	const barPadX = 14;
	const barGap = 12;

	const bottomGrad = ctx.createLinearGradient(0, bottomBarY, 0, bottomBarY + bottomBarH);
	bottomGrad.addColorStop(0, 'rgba(20, 8, 8, 0.95)');
	bottomGrad.addColorStop(1, 'rgba(10, 4, 4, 0.98)');
	ctx.fillStyle = bottomGrad;
	ctx.fillRect(0, bottomBarY, MONSTER_CARD_WIDTH, bottomBarH);

	ctx.strokeStyle = 'rgba(120, 40, 40, 0.7)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, bottomBarY + 0.5);
	ctx.lineTo(MONSTER_CARD_WIDTH, bottomBarY + 0.5);
	ctx.stroke();

	// Floating stats block (right side, hovering over the bottom bar)
	// Contains both BARRIER and DAMAGE side by side
	const statsW = 130;
	const statsH = 55;
	const statsX = MONSTER_CARD_WIDTH - barPadX - statsW;
	const statsY = bottomBarY - statsH;
	const statColW = statsW / 2;
	const dividerX = statsX + statColW;

	// Stats block gradient background
	const statsGrad = ctx.createLinearGradient(statsX, statsY, statsX, statsY + statsH);
	statsGrad.addColorStop(0, '#4a0a0a');
	statsGrad.addColorStop(0.5, '#2a0606');
	statsGrad.addColorStop(1, '#1a0404');
	ctx.fillStyle = statsGrad;
	roundRect(ctx, statsX, statsY, statsW, statsH, 8);
	ctx.fill();

	// Border (no bottom edge to blend with bottom bar)
	ctx.strokeStyle = '#7f1d1d';
	ctx.lineWidth = 2;
	ctx.save();
	ctx.beginPath();
	ctx.moveTo(statsX, statsY + statsH);
	ctx.lineTo(statsX, statsY + 8);
	ctx.arcTo(statsX, statsY, statsX + 8, statsY, 8);
	ctx.lineTo(statsX + statsW - 8, statsY);
	ctx.arcTo(statsX + statsW, statsY, statsX + statsW, statsY + 8, 8);
	ctx.lineTo(statsX + statsW, statsY + statsH);
	ctx.stroke();
	ctx.restore();

	// Divider line between stats
	ctx.fillStyle = 'rgba(127, 29, 29, 0.6)';
	ctx.fillRect(dividerX - 0.5, statsY + 8, 1, statsH - 16);

	// BARRIER stat (left column)
	const barrierValue = Math.max(0, Math.round(monster.barrier ?? 0));
	ctx.fillStyle = '#fecaca';
	ctx.font = '800 28px Opsilon, serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.save();
	ctx.shadowColor = 'rgba(220, 38, 38, 0.6)';
	ctx.shadowBlur = 20;
	ctx.fillText(String(barrierValue), statsX + statColW / 2, statsY + 32);
	ctx.restore();

	ctx.font = '700 8px Opsilon, serif';
	ctx.fillStyle = 'rgba(248, 250, 252, 0.7)';
	ctx.textBaseline = 'top';
	ctx.fillText(ui.statsBarrier, statsX + statColW / 2, statsY + 36);

	// DAMAGE stat (right column)
	ctx.fillStyle = '#fecaca';
	ctx.font = '800 28px Opsilon, serif';
	ctx.textBaseline = 'alphabetic';
	ctx.save();
	ctx.shadowColor = 'rgba(220, 38, 38, 0.6)';
	ctx.shadowBlur = 20;
	ctx.fillText(String(monster.damage ?? 0), dividerX + statColW / 2, statsY + 32);
	ctx.restore();

	ctx.font = '700 8px Opsilon, serif';
	ctx.fillStyle = 'rgba(248, 250, 252, 0.7)';
	ctx.textBaseline = 'top';
	ctx.fillText(ui.statsDamage, dividerX + statColW / 2, statsY + 36);

	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';

	// Barrier reward track (marker start + damage/killed slots; participation renders in the callout box)
	const killedBarrierIndex = Math.max(1, barrierValue);
	const rewardSlots = normalizeRewardTrackUrls(rewardTrackIconUrls, killedBarrierIndex);
	const showTutorial = (monster as any).show_tutorial ?? true;
	const participationUrls = rewardSlots[0] ?? [];
	const displaySlotCount = killedBarrierIndex; // excludes participation (slot 0), includes KILLED
	const showCallout = showTutorial || participationUrls.length > 0;

	// Tutorial / Participation callout (left side, hovering over the bottom bar)
	if (showCallout) {
		const calloutW = 200;
		const calloutH = 55;
		const calloutX = 12;
		const calloutY = bottomBarY - calloutH;

		ctx.save();
		const calloutGrad = ctx.createLinearGradient(0, calloutY, 0, calloutY + calloutH);
		calloutGrad.addColorStop(0, '#4a0a0a');
		calloutGrad.addColorStop(0.5, '#2a0606');
		calloutGrad.addColorStop(1, '#1a0404');
		ctx.fillStyle = calloutGrad;
		roundRect(ctx, calloutX, calloutY, calloutW, calloutH, 10);
		ctx.fill();

		// Border (hide bottom edge to match the UI)
		ctx.strokeStyle = '#7f1d1d';
		ctx.lineWidth = 2;
		roundRect(ctx, calloutX, calloutY, calloutW, calloutH, 10);
		ctx.stroke();
		ctx.fillStyle = bottomGrad;
		ctx.fillRect(calloutX - 1, calloutY + calloutH - 2, calloutW + 2, 4);

		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillStyle = 'rgba(248, 250, 252, 0.7)';
		ctx.font = '800 12px Opsilon, serif';

		const calloutTitle = showTutorial ? ui.calloutTutorialTitle : ui.calloutParticipationTitle;
		ctx.fillText(calloutTitle, calloutX + calloutW / 2, calloutY + 8);

		if (showTutorial) {
			ctx.fillStyle = 'rgba(248, 250, 252, 0.5)';
			ctx.font = '500 10px Opsilon, serif';
			const maxW = calloutW - 24;
			const lines = wrapText(ctx, ui.calloutTutorialText, maxW).slice(0, 2);
			const startY = calloutY + 26;
			for (let i = 0; i < lines.length; i++) {
				ctx.fillText(lines[i], calloutX + calloutW / 2, startY + i * 12);
			}
		} else {
			const iconSize = 30;
			const iconGap = 6;
			const maxIcons = 5;
			const urls = participationUrls.slice(0, maxIcons);
			const totalW = urls.length * iconSize + Math.max(0, urls.length - 1) * iconGap;
			let x = calloutX + (calloutW - totalW) / 2;
			const y = calloutY + 24;
			for (const url of urls) {
				try {
					const img = await loadImage(url);
					drawImageContain(ctx, img, x, y, iconSize, iconSize);
				} catch (err) {
					console.warn('Failed to load participation icon', err);
				}
				x += iconSize + iconGap;
			}
		}

		ctx.restore();
	}

	// Barrier track styling to match live preview
	const trackPad = 4;
	const segmentGap = 2;
	const trackY = bottomBarY + trackPad;
	const trackH = bottomBarH - trackPad * 2;
	const trackX = trackPad;
	const trackRightX = MONSTER_CARD_WIDTH - trackPad;
	const trackW = Math.max(0, trackRightX - trackX);

	// Helper to get gradient color from red to black (matching live preview)
	function getGradientColor(step: number, totalSteps: number): { top: string; bottom: string } {
		const t = totalSteps > 0 ? step / totalSteps : 1;
		const r = Math.round(74 * (1 - t));
		const g = Math.round(21 * (1 - t));
		const b = Math.round(21 * (1 - t));
		const r2 = Math.round(45 * (1 - t));
		const g2 = Math.round(10 * (1 - t));
		const b2 = Math.round(10 * (1 - t));
		return {
			top: `rgb(${r}, ${g}, ${b})`,
			bottom: `rgb(${r2}, ${g2}, ${b2})`
		};
	}

	if (displaySlotCount > 0 && trackW > 0 && trackH > 0) {
		const totalSegmentCount = displaySlotCount + 1; // marker start + reward slots
		const totalGaps = (totalSegmentCount - 1) * segmentGap;
		const segmentW = (trackW - totalGaps) / totalSegmentCount;
		const labelFontSize = 12;
		const labelLineH = 11;
		const iconGap = 4;
		const iconSize = 32;

		ctx.save();

		// Draw each segment as individual rounded rect with gradient
		for (let segIdx = 0; segIdx <= displaySlotCount; segIdx++) {
			const segX = trackX + segIdx * (segmentW + segmentGap);
			const colors = getGradientColor(segIdx, killedBarrierIndex);

			// Segment background gradient
			const segGrad = ctx.createLinearGradient(segX, trackY, segX, trackY + trackH);
			segGrad.addColorStop(0, colors.top);
			segGrad.addColorStop(1, colors.bottom);
			ctx.fillStyle = segGrad;
			roundRect(ctx, segX, trackY, segmentW, trackH, 3);
			ctx.fill();

			// Label
			ctx.fillStyle = 'rgba(248, 250, 252, 0.6)';
			ctx.font = `700 ${labelFontSize}px Opsilon, serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'top';

			const centerX = segX + segmentW / 2;
			const labelY = trackY + 4;

			if (segIdx === 0) {
				// Marker Start
				ctx.fillText(ui.trackMarker, centerX, labelY);
				ctx.fillText(ui.trackStart, centerX, labelY + labelLineH);
			} else if (segIdx === killedBarrierIndex) {
				// KILLED
				ctx.fillText(ui.trackKilled, centerX, labelY);
			} else {
				// Damage N
				ctx.fillText(ui.trackDamage(segIdx), centerX, labelY);
			}

			// Icons for this slot (skip marker start which is slot 0)
			if (segIdx > 0) {
				const urls = rewardSlots[segIdx] ?? [];
				if (urls.length > 0) {
					const iconZoneY = trackY + 4 + labelLineH + 6;
					const iconZoneH = Math.max(0, trackH - (4 + labelLineH + 6) - 4);

					const maxCols = Math.max(1, Math.min(3, Math.floor((segmentW - 4 + iconGap) / (iconSize + iconGap))));
					const cols = Math.max(1, Math.min(urls.length, maxCols));
					const rows = Math.max(1, Math.ceil(urls.length / cols));

					const gridW = cols * iconSize + (cols - 1) * iconGap;
					const gridH = rows * iconSize + (rows - 1) * iconGap;
					const startX = segX + (segmentW - gridW) / 2;
					const startY = iconZoneY + (iconZoneH - gridH) / 2;

					for (let idx = 0; idx < urls.length; idx++) {
						const url = urls[idx];
						if (!url) continue;
						const col = idx % cols;
						const row = Math.floor(idx / cols);
						const x = startX + col * (iconSize + iconGap);
						const y = startY + row * (iconSize + iconGap);

						try {
							const img = await loadImage(url);
							ctx.save();
							ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
							ctx.shadowBlur = 2;
							ctx.shadowOffsetY = 1;
							drawImageContain(ctx, img, x, y, iconSize, iconSize);
							ctx.restore();
						} catch (err) {
							console.warn('Failed to load reward track icon', err);
						}
					}
				}
			}
		}

		ctx.restore();
	}

	ctx.restore();

	// Card border
	ctx.strokeStyle = '#3d0363';
	ctx.lineWidth = 2;
	roundRect(ctx, 1, 1, MONSTER_CARD_WIDTH - 2, MONSTER_CARD_HEIGHT - 2, 4);
	ctx.stroke();

	// Convert canvas to blob
	return canvasToBlob(canvas);
}
