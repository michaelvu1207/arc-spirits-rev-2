import { describe, it, expect } from 'vitest';
import { artifactService } from './artifactService';
import type { OriginRow, RuneRow } from '$lib/types/gameData';

describe('artifactService', () => {
    describe('replacePlaceholders', () => {
        it('should replace {origin} placeholder', () => {
            const text = 'Sword of {origin}';
            const origin: OriginRow = {
                id: '1', name: 'Fire', description: '', icon_emoji: '🔥', icon_png: null, icon_token_png: null, position: 0, created_at: '',
                color: null, updated_at: null, calling_card: null
            };
            expect(artifactService.replacePlaceholders(text, origin)).toBe('Sword of Fire');
        });

        it('should replace {quantity} placeholder', () => {
            const text = 'Grants {quantity} strength';
            expect(artifactService.replacePlaceholders(text, null, 5)).toBe('Grants 5 strength');
        });

        it('should handle multiple placeholders', () => {
            const text = '{origin} {class} Artifact +{quantity}';
            const origin: OriginRow = {
                id: '1', name: 'Ice', description: '', icon_emoji: '❄️', icon_png: null, icon_token_png: null, position: 0, created_at: '',
                color: null, updated_at: null, calling_card: null
            };
            expect(artifactService.replacePlaceholders(text, origin, 10)).toBe('Ice Ice Artifact +10');
            // Note: The current implementation replaces both {origin} and {class} with entity.name if entity is provided.
            // If we pass an origin, it treats it as the entity.
        });

        it('should return original text if no placeholders', () => {
            expect(artifactService.replacePlaceholders('Simple Text', null)).toBe('Simple Text');
        });

        it('should return empty string if text is empty', () => {
            expect(artifactService.replacePlaceholders('', null)).toBe('');
        });
    });

	    describe('getOriginRunes', () => {
	        it('should filter runes by origin_id', () => {
	            const runes: RuneRow[] = [
	                { id: '1', name: 'Fire Rune', origin_id: 'origin1', class_id: null, created_at: '', updated_at: null, icon_path: null, icon_background_path: null },
	                { id: '2', name: 'Water Rune', origin_id: 'origin2', class_id: null, created_at: '', updated_at: null, icon_path: null, icon_background_path: null },
	                { id: '3', name: 'Another Fire Rune', origin_id: 'origin1', class_id: null, created_at: '', updated_at: null, icon_path: null, icon_background_path: null }
	            ];
	            const result = artifactService.getOriginRunes('origin1', runes);
	            expect(result).toHaveLength(2);
	            expect(result.map(r => r.id)).toContain('1');
	            expect(result.map(r => r.id)).toContain('3');
	        });

	        it('should return empty array if no runes match', () => {
	            const runes: RuneRow[] = [
	                { id: '1', name: 'Fire Rune', origin_id: 'origin1', class_id: null, created_at: '', updated_at: null, icon_path: null, icon_background_path: null }
	            ];
	            const result = artifactService.getOriginRunes('origin3', runes);
	            expect(result).toHaveLength(0);
	        });
	    });

});
