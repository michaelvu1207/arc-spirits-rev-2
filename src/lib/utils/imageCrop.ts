/**
 * Crops transparent areas from an image using trim-canvas library
 * @param input The image file or blob to crop
 * @param mimeType Optional mime type (defaults to 'image/png')
 * @returns A Promise that resolves to a cropped Blob
 */
export async function cropTransparentArea(input: File | Blob, mimeType?: string): Promise<Blob> {
	const { default: trimCanvas } = await import('trim-canvas');
	const type = mimeType ?? ((input instanceof File ? input.type : 'image/png') || 'image/png');

	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(input);

		img.onload = () => {
			// Cleanup object URL
			URL.revokeObjectURL(url);

			try {
				// Draw image to canvas
				const canvas = document.createElement('canvas');
				canvas.width = img.width;
				canvas.height = img.height;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					reject(new Error('Could not get canvas context'));
					return;
				}
				ctx.drawImage(img, 0, 0);

				// Use trim-canvas to remove transparent pixels
				const trimmedCanvas = trimCanvas(canvas);

				// Convert to blob
				trimmedCanvas.toBlob(
					(blob: Blob | null) => {
						if (blob) {
							resolve(blob);
						} else {
							reject(new Error('Failed to create blob from canvas'));
						}
					},
					type,
					0.95
				);
			} catch (err) {
				reject(err);
			}
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}

