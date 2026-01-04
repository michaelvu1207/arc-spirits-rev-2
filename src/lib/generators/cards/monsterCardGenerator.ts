import type { MonsterRow, RewardRow, SpecialEffectRow } from '$lib/types/gameData';
import { canvasToBlob, createCanvas, getContext, loadImage, loadOpsilonFont, roundRect, wrapText } from '../shared/canvas';

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

// Resolved reward row with icon URLs
type ResolvedRewardRow = RewardRow & {
	icon_urls: (string | null)[];
};

const MONSTER_CARD_WIDTH = 600;
const MONSTER_CARD_HEIGHT = 437;
const EXPORT_SCALE = 2;
const LEFT_PANEL_WIDTH = Math.round(MONSTER_CARD_WIDTH * 0.6); // 1.2fr of 2.0fr
const RIGHT_PANEL_WIDTH = MONSTER_CARD_WIDTH - LEFT_PANEL_WIDTH;

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

function computeRewardSectionHeight(iconCount: number, availableWidth: number): { height: number; rows: number; perRow: number } {
	const iconSize = 36;
	const gap = 6;
	const labelLineHeight = 13;
	const perRow = Math.max(1, Math.floor((availableWidth + gap) / (iconSize + gap)));
	const rows = Math.max(1, Math.ceil(iconCount / perRow));
	const iconsHeight = rows * iconSize + Math.max(0, rows - 1) * gap;
	const height = labelLineHeight + gap + iconsHeight;
	return { height, rows, perRow };
}

export async function generateMonsterCardPNG(
	monster: MonsterRow & { effects?: SpecialEffectRow[] },
	artUrl?: string | null,
	iconUrl?: string | null,
	rewardRows?: ResolvedRewardRow[]
): Promise<Blob> {
	if (!monster.id || !monster.name) {
		throw new Error('Monster missing ID or name');
	}

	await loadOpsilonFont();

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

	const stateColors: Record<string, string> = {
		tainted: '#dc2626',
		corrupt: '#991b1b',
		fallen: '#7f1d1d',
		arcane: '#0ea5e9',
		inactive: '#64748b'
	};

	const classificationLabels: Record<string, string> = {
		monster: 'Monster',
		abyss_guardian: 'Abyss Guardian',
		boss: 'Boss'
	};

	const classificationColors: Record<string, string> = {
		abyss_guardian: '#0ea5e9',
		boss: '#450a0a'
	};

	const stateColor = stateColors[monster.state ?? 'tainted'] ?? '#dc2626';
	const classification = monster.monster_classification ?? 'monster';
	const classificationText = classificationLabels[classification]?.toUpperCase() ?? 'MONSTER';

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
	const artH = MONSTER_CARD_HEIGHT;

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

	// Floating stat bar (centered on art panel, 50% larger)
	const barPaddingX = 12;
	const barPaddingY = 9;
	const barGap = 9;
	const statSlotSize = 81;
	const barW = barPaddingX * 2 + statSlotSize * 2 + barGap;
	const barH = barPaddingY * 2 + statSlotSize;
	const barX = artX + (artW - barW) / 2;
	const barY = artY + artH - 12 - barH;

	ctx.save();
	ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
	ctx.shadowBlur = 12;
	ctx.shadowOffsetY = 2;
	const barBg = ctx.createLinearGradient(barX, barY, barX + barW, barY + barH);
	barBg.addColorStop(0, 'rgba(20, 8, 8, 0.92)');
	barBg.addColorStop(1, 'rgba(15, 5, 5, 0.95)');
	ctx.fillStyle = barBg;
	roundRect(ctx, barX, barY, barW, barH, 9);
	ctx.fill();
	ctx.shadowColor = 'transparent';
	ctx.strokeStyle = 'rgba(120, 40, 40, 0.6)';
	ctx.lineWidth = 1;
	roundRect(ctx, barX, barY, barW, barH, 9);
	ctx.stroke();

	function drawStatSlot(slotX: number, slotY: number, kind: 'damage' | 'barrier', value: number) {
		const slotGrad = ctx.createLinearGradient(slotX, slotY, slotX + statSlotSize, slotY + statSlotSize);
		if (kind === 'damage') {
			slotGrad.addColorStop(0, 'rgba(80, 20, 20, 0.6)');
			slotGrad.addColorStop(1, 'rgba(20, 5, 5, 0.7)');
		} else {
			slotGrad.addColorStop(0, 'rgba(60, 25, 25, 0.5)');
			slotGrad.addColorStop(1, 'rgba(20, 5, 5, 0.7)');
		}

		ctx.fillStyle = slotGrad;
		roundRect(ctx, slotX, slotY, statSlotSize, statSlotSize, 6);
		ctx.fill();

		ctx.textAlign = 'center';
		ctx.fillStyle = 'rgba(240, 220, 220, 0.95)';
		ctx.font = '800 32px Opsilon, serif';
		ctx.fillText(String(value), slotX + statSlotSize / 2, slotY + 45);

		const labelText = kind === 'damage' ? 'DAMAGE' : 'BARRIER';
		let labelFontSize = 12;
		ctx.font = `800 ${labelFontSize}px Opsilon, serif`;
		let labelW = ctx.measureText(labelText).width;
		const maxLabelW = statSlotSize - 22;
		while (labelW > maxLabelW && labelFontSize > 9) {
			labelFontSize -= 1;
			ctx.font = `800 ${labelFontSize}px Opsilon, serif`;
			labelW = ctx.measureText(labelText).width;
		}
		const pillPadX = 10;
		const pillH = 18;
		const pillW = Math.min(statSlotSize - 10, labelW + pillPadX * 2);
		const pillX = slotX + (statSlotSize - pillW) / 2;
		const pillY = slotY + statSlotSize - 8 - pillH;

		ctx.save();
		ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
		roundRect(ctx, pillX, pillY, pillW, pillH, 9);
		ctx.fill();

		ctx.fillStyle = 'rgba(248, 250, 252, 0.95)';
		ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
		ctx.shadowBlur = 2;
		ctx.shadowOffsetY = 1;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(labelText, slotX + statSlotSize / 2, pillY + pillH / 2 + 0.5);
		ctx.restore();

		ctx.textAlign = 'left';
	}

	const statY = barY + barPaddingY;
	drawStatSlot(barX + barPaddingX, statY, 'damage', monster.damage ?? 0);
	drawStatSlot(barX + barPaddingX + statSlotSize + barGap, statY, 'barrier', (monster as any).barrier ?? 0);
	ctx.restore();

	// Main panel (left)
	const mainGrad = ctx.createLinearGradient(0, 0, LEFT_PANEL_WIDTH, MONSTER_CARD_HEIGHT);
	mainGrad.addColorStop(0, 'rgba(45, 10, 10, 0.9)');
	mainGrad.addColorStop(1, 'rgba(26, 5, 5, 0.95)');
	ctx.fillStyle = mainGrad;
	ctx.fillRect(0, 0, LEFT_PANEL_WIDTH, MONSTER_CARD_HEIGHT);

	// Slash marks in top-right of main panel
	drawSlashMarks(ctx, LEFT_PANEL_WIDTH - 10 - 60, 10, 60, 80);

	const innerX = MAIN_PADDING;
	const innerW = LEFT_PANEL_WIDTH - MAIN_PADDING * 2;
	let yPos = MAIN_PADDING;

	// Header row: icon + name
	const headerIconSize = 52;
	const headerGap = 12;
	const nameX = innerX + (iconUrl || monster.icon ? headerIconSize + headerGap : 0);

	if (iconUrl) {
		try {
			const iconImg = await loadImage(iconUrl);
			ctx.save();
			ctx.shadowColor = 'rgba(220, 38, 38, 0.4)';
			ctx.shadowBlur = 15;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
			roundRect(ctx, innerX, yPos, headerIconSize, headerIconSize, 4);
			ctx.fill();
			ctx.shadowColor = 'transparent';
			drawImageContain(ctx, iconImg, innerX, yPos, headerIconSize, headerIconSize);
			ctx.strokeStyle = '#991b1b';
			ctx.lineWidth = 2;
			roundRect(ctx, innerX, yPos, headerIconSize, headerIconSize, 4);
			ctx.stroke();
			ctx.restore();
		} catch (err) {
			console.warn('Failed to load monster icon:', err);
		}
	} else if (monster.icon) {
		ctx.save();
		ctx.font = '800 44px Opsilon, serif';
		ctx.fillStyle = '#fecaca';
		ctx.shadowColor = 'rgba(220, 38, 38, 0.6)';
		ctx.shadowBlur = 8;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(monster.icon, innerX + headerIconSize / 2, yPos + headerIconSize / 2 + 2);
		ctx.restore();
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
	}

	const monsterName = monster.name.toUpperCase();
	const maxNameWidth = innerX + innerW - nameX;
	let nameFontSize = 34;
	ctx.fillStyle = '#fecaca';
	while (nameFontSize > 18) {
		ctx.font = `800 ${nameFontSize}px Opsilon, serif`;
		if (ctx.measureText(monsterName).width <= maxNameWidth) break;
		nameFontSize -= 2;
	}

	ctx.save();
	ctx.shadowColor = 'rgba(220, 38, 38, 0.5)';
	ctx.shadowBlur = 10;
	ctx.shadowOffsetY = 0;
	ctx.shadowOffsetX = 0;
	ctx.fillText(monsterName, nameX, yPos + 30);
	ctx.restore();

	if ((monster as any).invade_location_name) {
		ctx.font = 'italic 600 12px Opsilon, serif';
		ctx.fillStyle = '#b89090';
		ctx.fillText(`Invades: ${(monster as any).invade_location_name}`, nameX, yPos + 46);
	}

	yPos += headerIconSize + CONTENT_GAP;

	// Reward sections (kill + defeat)
	const resolvedRows = (rewardRows ?? []) as ResolvedRewardRow[];
	const killRewardRow = resolvedRows.find((row) => row.type === 'all_in_combat' && row.icon_urls?.some(Boolean));
	const killPickOneRewardRow = resolvedRows.find((row) => row.type === 'all_in_combat_pick_one' && row.icon_urls?.some(Boolean));
	const defeatRewardRow = resolvedRows.find((row) => row.type === 'all_losers' && row.icon_urls?.some(Boolean));

	const rewardSections: { label: string; icons: string[] }[] = [];
	if (killRewardRow) {
		rewardSections.push({
			label: 'On kill, all in combat gain:',
			icons: (killRewardRow.icon_urls ?? []).filter(Boolean) as string[]
		});
	}
	if (killPickOneRewardRow) {
		rewardSections.push({
			label: 'On kill, all in combat pick 1:',
			icons: (killPickOneRewardRow.icon_urls ?? []).filter(Boolean) as string[]
		});
	}
	if (defeatRewardRow) {
		rewardSections.push({
			label: 'All in monster combat gain:',
			icons: (defeatRewardRow.icon_urls ?? []).filter(Boolean) as string[]
		});
	}

	const rewardLayout = rewardSections.map((section) =>
		computeRewardSectionHeight(section.icons.length, innerW)
	);
	const rewardHeightsSum = rewardLayout.reduce((sum, r) => sum + r.height, 0);

	// Footer and state badge
	const footerHeight = 34;
	const innerBottom = MONSTER_CARD_HEIGHT - MAIN_PADDING;

	// Effects section: flexes to fill remaining space when present.
	const effects = monster.effects ?? [];
	const showEffects = effects.length > 0;

	if (showEffects) {
		const rewardCount = rewardSections.length;
		const itemCount = 1 + rewardCount + 1; // effects + rewards + footer
		const totalGaps = (itemCount - 1) * CONTENT_GAP;
		const available = innerBottom - yPos;
		const effectsHeight = Math.max(0, available - (rewardHeightsSum + footerHeight + totalGaps));

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
			ctx.fillRect(effectsX, effectsY, 3, effectsH);

			const pad = 12;
			const bulletSize = 6;
			const bulletGap = 8;
			const lineHeight = 18;

			let effectY = effectsY + pad + lineHeight - 6;
			const maxY = effectsY + effectsH - pad;
			const maxTextW = effectsW - pad * 2 - bulletSize - bulletGap;

			for (const effect of effects.slice(0, 2)) {
				if (effectY > maxY) break;
				const desc = stripHtml(effect.description).trim();

				// Bullet diamond
				const bulletX = effectsX + pad + bulletSize / 2;
				ctx.save();
				ctx.translate(bulletX, effectY - 5);
				ctx.rotate(Math.PI / 4);
				ctx.fillStyle = '#dc2626';
				ctx.fillRect(-bulletSize / 2, -bulletSize / 2, bulletSize, bulletSize);
				ctx.restore();

				const textX = effectsX + pad + bulletSize + bulletGap;
				ctx.font = '700 12px Opsilon, serif';
				ctx.fillStyle = '#fca5a5';
				const nameText = `${effect.name}:`;
				const nameW = ctx.measureText(nameText).width;
				ctx.fillText(nameText, textX, effectY);

				ctx.font = '400 12px Opsilon, serif';
				ctx.fillStyle = '#a8a0b0';

				const firstLineX = textX + nameW + 4;
				const firstLineMaxW = Math.max(10, effectsX + effectsW - pad - firstLineX);
				const firstLine = desc ? wrapText(ctx, desc, firstLineMaxW)[0] ?? '' : '';
				if (firstLine) {
					ctx.fillText(firstLine, firstLineX, effectY);
				}

				let used = firstLine ? firstLine.split(' ').length : 0;
				let remainder = desc;
				if (firstLine && desc) {
					// Remove the used words from the remainder (approximation, good enough for short lines).
					const words = desc.split(/\s+/);
					remainder = words.slice(used).join(' ').trim();
				}

				effectY += lineHeight;
				if (remainder) {
					const lines = wrapText(ctx, remainder, maxTextW);
					for (const line of lines) {
						if (effectY > maxY) break;
						ctx.fillText(line, textX, effectY);
						effectY += lineHeight;
					}
				}

				effectY += 8; // gap between effects
			}

			ctx.restore();
			yPos += effectsH + CONTENT_GAP;
		}
	}

	// Rewards
	for (let i = 0; i < rewardSections.length; i++) {
		const section = rewardSections[i];
		const layout = rewardLayout[i];

		ctx.font = '600 11px Opsilon, serif';
		ctx.fillStyle = '#b89090';
		ctx.fillText(section.label, innerX, yPos + 11);

		const iconSize = 36;
		const iconGap = 6;
		let iconX = innerX;
		let iconY = yPos + 11 + iconGap;

		for (let idx = 0; idx < section.icons.length; idx++) {
			const url = section.icons[idx];
			const col = idx % layout.perRow;
			const row = Math.floor(idx / layout.perRow);
			const x = iconX + col * (iconSize + iconGap);
			const y = iconY + row * (iconSize + iconGap);

			try {
				const img = await loadImage(url);
				drawImageContain(ctx, img, x, y, iconSize, iconSize);
			} catch (err) {
				console.warn('Failed to load reward icon', err);
			}
		}

		yPos += layout.height;
		if (i < rewardSections.length - 1) yPos += CONTENT_GAP;
	}

	// Footer (always present)
	if (rewardSections.length > 0 || showEffects) {
		yPos += CONTENT_GAP;
	}

	// Footer line
	ctx.strokeStyle = 'rgba(220, 38, 38, 0.3)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(innerX, yPos);
	ctx.lineTo(innerX + innerW, yPos);
	ctx.stroke();

	const footerTextY = yPos + 22;
	ctx.font = '600 11px Opsilon, serif';
	ctx.fillStyle = '#991b1b';
	ctx.fillText('Arc Spirits // Monster', innerX, footerTextY);

	const stateText = (monster.state ?? 'tainted').toUpperCase();
	ctx.font = '700 10px Opsilon, serif';
	const badgePadX = 10;
	const badgeH = 18;
	const badgeY = yPos + 10;
	const badgeGap = 6;
	let badgeRightX = innerX + innerW;

	if (classification !== 'monster') {
		const textW = ctx.measureText(classificationText).width;
		const badgeW = textW + badgePadX * 2;
		const badgeX = badgeRightX - badgeW;
		badgeRightX = badgeX - badgeGap;
		ctx.fillStyle = classificationColors[classification] ?? '#334155';
		roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 3);
		ctx.fill();
		ctx.fillStyle = '#e2e8f0';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(classificationText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 0.5);
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
	}

	{
		const badgeTextW = ctx.measureText(stateText).width;
		const badgeW = badgeTextW + badgePadX * 2;
		const badgeX = badgeRightX - badgeW;
		ctx.fillStyle = stateColor;
		roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 3);
		ctx.fill();
		ctx.fillStyle = '#fecaca';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(stateText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 0.5);
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
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
