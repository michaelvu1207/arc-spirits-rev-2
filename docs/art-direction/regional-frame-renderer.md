# Regional edge styling

The original 3000 × 3000 composite is the layout authority. Keep its artwork placement, lower-left nameplate, inner rim, origin icon and class icons unchanged. No top cost badge is added.

`regionalHexEdges.js` applies region palettes and cost-dependent facets/inlays only within a narrow perimeter band measured against the original hex. It preserves alpha and every pixel outside that band. Cost 3 uses broad color facets; 7 and 9 introduce progressively closer metallic inlays. Region palettes come from `resolveFrame`; purple is reserved for Moon in this edge treatment.

The browser batch pipeline first runs its existing front/icon compositor, then optionally calls `generateRegionalHexFront(data, originalFrontBlob)`. Region and cost come from the spirit-data callback. Raw artwork is never used as a replacement for the original layout. Browser Canvas may round translucent RGB values during PNG decoding; the local Sharp export verifies exact preservation of protected RGBA pixels.

Export: `node scripts/export_regional_edges.mjs`, then `.venv-psd/bin/python scripts/build_regional_edge_galleries.py`. Outputs are in `exports/spirit-regional-edges-v2`. The manifest records each baseline source, finished image and changed-pixel count. Validation checks every exported image.

The prior whole-layout SVG renderer and `spirit-regional-frames-v1` gallery are superseded experiments and should not be used for production fronts.
