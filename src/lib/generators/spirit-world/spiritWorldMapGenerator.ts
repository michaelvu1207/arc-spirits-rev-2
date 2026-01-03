import { canvasToBlob, createCanvas, getContext, loadImage } from '$lib/generators/shared/canvas';

export type SpiritWorldMapPlacement = {
	imageUrl: string;
	x: number;
	y: number;
	scale?: number;
	/** Rotation in degrees (clockwise). */
	rotation?: number;
};

export async function generateSpiritWorldMapImage(options: {
	backgroundUrl: string;
	placements: SpiritWorldMapPlacement[];
}): Promise<Blob> {
	const bg = await loadImage(options.backgroundUrl);
	const canvas = createCanvas(bg.width, bg.height);
	const ctx = getContext(canvas);

	ctx.drawImage(bg, 0, 0);

	for (const placement of options.placements) {
		try {
			const img = await loadImage(placement.imageUrl);
			const scale = placement.scale ?? 1;
			const rotationDeg = placement.rotation ?? 0;
			const rotationRad = (rotationDeg * Math.PI) / 180;

			ctx.save();
			ctx.translate(placement.x, placement.y);
			if (rotationRad) ctx.rotate(rotationRad);
			ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);
			ctx.restore();
		} catch (err) {
			console.warn('Failed to load placed location image for Spirit World export', placement.imageUrl, err);
		}
	}

	return canvasToBlob(canvas);
}
