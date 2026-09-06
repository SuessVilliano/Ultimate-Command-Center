# LIV8 AR Studio

A standalone WebAR MVP inside Ultimate Command Center.

## What works now

- Drag/drop up to 20 GLB/GLTF models (100 MB total local-scene guardrail)
- Desktop/mobile 3D preview
- Drag to rotate, pinch/zoom, adjustable scale/yaw/shadow/exposure
- Built-in GLTF animation playback and optional auto-spin
- Mobile AR launch using WebXR / Android Scene Viewer / iOS Quick Look through `<model-viewer>`
- Shareable scan-to-AR QR links when a model is hosted at a public HTTPS URL
- QR carries scene settings so the receiver opens the same configured object
- Mobile shared-viewer mode optimized for scanning a QR and immediately entering AR

## Run

```bash
cd apps/ar-studio
npm install
npm run dev
```

Open the HTTPS deployment on a phone. Camera/AR features require a secure context.

## Why the first viewer uses model-viewer

The first slice intentionally uses the browser-native AR path for the fastest reliable cross-device object placement. The official `8thwall/8thwall` open-source repository can be layered in for image-target tracking, face effects, sky effects, and richer camera pipelines. The separately distributed 8th Wall engine binary includes SLAM/world tracking but has its own limited-use license.

## Production phase

1. Object storage: direct uploads to a public/private asset bucket so local files become shareable without manually pasting a URL.
2. Scene persistence: project/scene records, owner, slug, QR, analytics, expiration, access rules.
3. 8th Wall image targets: upload a poster/photo/logo/marker, process target, bind 3D/video content to it.
4. Geofenced unlocks: radius-based location checks for scavenger hunts, giveaways, sweepstakes and event activations.
5. Video planes: MP4/WebM textures that appear on walls, memorial cards, framed photos, signs and portals.
6. Multi-object scene composer: position X/Y/Z, rotation, scale, timeline, animation triggers, sound and interactions.
7. Collectibles: claim codes, inventory, one-time unlocks, leaderboards and campaign analytics.
8. Moderation/rights controls for uploaded characters, brand assets and memorial content.

## Recommended asset limits

The editor accepts 20 model files and 100 MB total for the MVP. For actual mobile AR, target 5–15 MB per GLB and keep a normal scene under roughly 50 MB whenever possible. Texture compression and mesh optimization matter more than raw file count.
