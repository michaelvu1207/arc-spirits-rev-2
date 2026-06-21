# Image/Asset Generators

Organized directory structure for all image and asset generation code in the Arc Spirits Planner application.

## Directory Structure

```
generators/
├── cards/               # Card image generators
│   ├── artifactCardGenerator.ts
│   ├── eventCardGenerator.ts
│   ├── monsterCardGenerator.ts
│   └── index.ts
├── dice/                # Dice side image generators
│   ├── diceSideGenerator.ts
│   └── index.ts
├── shared/              # Shared utilities for all generators
│   ├── canvas.ts        # Canvas utility functions
│   ├── types.ts         # Shared TypeScript types
│   └── index.ts
└── index.ts             # Main barrel export
```

## Usage

### Card Generators

Generate PNG images for game cards (artifacts, monsters, events).

```typescript
import { generateArtifactCardPNG, generateMonsterCardPNG, generateEventCardPNG } from '$lib/generators/cards';

// Generate artifact card
const artifactBlob = await generateArtifactCardPNG(artifact, origins, runes, tags, guardians);

// Generate monster card
const monsterBlob = await generateMonsterCardPNG(monster, artUrl, iconUrl, rewardIconUrls, 'en');

// Generate event card
const eventBlob = await generateEventCardPNG(event);

```

### Dice Generators

Generate dice side images with custom backgrounds and text.

```typescript
import { generateDiceSide } from '$lib/generators/dice';

const diceSideDataUrl = await generateDiceSide({
	backgroundUrl: 'https://example.com/background.png',
	text: '6',
	size: 800,
	fontSize: 400,
	fontColor: '#ffffff'
});
```

### Shared Utilities

Reusable canvas utilities for all generators.

```typescript
import { createCanvas, getContext, loadImage, canvasToBlob, roundRect, wrapText } from '$lib/generators/shared';

// Create a canvas
const canvas = createCanvas(600, 400);
const ctx = getContext(canvas);

// Load an image
const img = await loadImage('https://example.com/image.png');

// Draw rounded rectangle
roundRect(ctx, 0, 0, 300, 200, 12);
ctx.fill();

// Wrap text to fit width
const lines = wrapText(ctx, 'Long text here...', 280);

// Convert to blob
const blob = await canvasToBlob(canvas);
```

## Shared Canvas Utilities

The `shared/canvas.ts` module provides these utilities:

### Canvas Management
- `createCanvas(width, height)` - Create canvas element
- `getContext(canvas)` - Get 2D context with error handling
- `canvasToBlob(canvas, type)` - Convert canvas to Blob

### Image Loading
- `loadImage(url)` - Load image with CORS support
- `loadImageFromBlob(blob)` - Load image from Blob

### Drawing Utilities
- `roundRect(ctx, x, y, width, height, radius)` - Draw rounded rectangle path
- `wrapText(ctx, text, maxWidth)` - Word wrap text to array of lines
- `truncateText(ctx, text, maxWidth)` - Truncate text with ellipsis
- `computeTrimRect(img)` - Compute trimmed bounding box (removes transparent pixels)

### Image Manipulation
- `renderEmojiToBlob(emoji, size)` - Render emoji to PNG blob
- `normalizeImageBuffer(buffer, size)` - Resize image buffer to specific size

## Card Generator Details

### Artifact Cards
- **Dimensions**: 300x225px
- **Features**: Border color based on guardian/tag, recipe box with rune icons, tag badges
- **Dependencies**: Requires rune icon generation utilities

### Monster Cards
- **Dimensions**: 600x437px (Blood Crimson template, exported at 2x resolution)
- **Features**: Full-height art panel with floating stat bar, vein/slash overlays, effect list, kill/defeat reward icons
- **Stages**: stage_1/stage_2/stage_3/final_stage/inactive (formerly tainted/corrupt/fallen/arcane)

### Event Cards
- **Dimensions**: 600x400px
- **Features**: Diagonal overlay, grayscale zoomed art (130%), order badge
- **Styling**: Blue accent color for events

## Dice Generator Details

### Dice Side Generator
- **Default Size**: 800x800px
- **Font**: Bebas Neue (loaded from Google Fonts)
- **Features**: Custom background image, text overlay with outline, SVG fallback
- **Options**: Customizable size, font size, font color, font family

## Migration Notes

All generator code was previously in `/src/lib/utils/`. Files have been reorganized:

**Moved Files:**
- `utils/monsterCardGenerator.ts` → `generators/cards/monsterCardGenerator.ts`
- `utils/eventCardGenerator.ts` → `generators/cards/eventCardGenerator.ts`
- `utils/artifactCardGenerator.ts` → `generators/cards/artifactCardGenerator.ts`
- `utils/diceSideGenerator.ts` → `generators/dice/diceSideGenerator.ts`

**Updated Imports:**
All imports have been updated to use the new structure via barrel exports:
- `$lib/utils/monsterCardGenerator` → `$lib/generators/cards`
- `$lib/utils/eventCardGenerator` → `$lib/generators/cards`
- `$lib/utils/artifactCardGenerator` → `$lib/generators/cards`
- `$lib/utils/diceSideGenerator` → `$lib/generators/dice`

**Refactored Code:**
- Removed duplicate helper functions (roundRect, wrapText, computeTrimRect, etc.)
- Consolidated canvas utilities into `shared/canvas.ts`
- Updated all generators to use shared utilities
- Replaced direct Image/Canvas creation with utility functions
- Improved error handling and consistency

## Contributing

When adding new generators:

1. Place card generators in `cards/` directory
2. Place dice/icon generators in `dice/` directory (or create new category)
3. Use shared utilities from `shared/canvas.ts` for common operations
4. Export new generators from appropriate `index.ts` barrel file
5. Add documentation to this README

When adding new shared utilities:

1. Add to `shared/canvas.ts` for canvas operations
2. Add to `shared/types.ts` for shared types
3. Document in this README
