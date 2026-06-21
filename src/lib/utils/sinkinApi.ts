/**
 * Download an image from URL and convert to Blob
 * Uses server-side proxy to bypass CORS restrictions
 */
export async function downloadImageAsBlob(url: string): Promise<Blob> {
	try {
		// First try direct fetch (in case CORS is allowed)
		try {
			const directResponse = await fetch(url, {
				mode: 'cors',
				credentials: 'omit',
				cache: 'no-cache'
			});
			
			if (directResponse.ok) {
				const blob = await directResponse.blob();
				if (blob.type.startsWith('image/')) {
					return blob;
				}
			}
		} catch {
			// If direct fetch fails, use server proxy
		}

		// Use server-side proxy to bypass CORS
		const proxyResponse = await fetch('/api/download-image', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ url })
		});

		if (!proxyResponse.ok) {
			const error = await proxyResponse.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `Failed to download image via proxy: ${proxyResponse.statusText}`);
		}

		const result = await proxyResponse.json();
		
		if (result.error) {
			throw new Error(result.error);
		}

		// Convert base64 back to blob
		const binaryString = atob(result.data);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		
		return new Blob([bytes], { type: result.contentType || 'image/png' });
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		}
		throw new Error('Failed to download image');
	}
}


