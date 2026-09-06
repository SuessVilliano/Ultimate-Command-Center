# LIV8 AR Studio

A no-app-required WebAR creator and physical-world content layer inside Ultimate Command Center.

## Working model now

- Local `.glb` drag/drop preview with 20-file / 100 MB editor guardrails. Local GLTF was deliberately removed because external `.bin`/texture companions make single-file blob preview unreliable.
- Public HTTPS `.glb` / complete `.gltf` assets can be shared and published.
- 3D controls: rotate, pinch/zoom, scale, yaw, shadow, exposure, animation autoplay, auto-spin and fixed/adjustable AR scale.
- AR launch through WebXR / Android Scene Viewer / iOS Quick Look via `<model-viewer>`.
- QR-anywhere and GPS-geofence triggers. Geofenced viewers request location only when needed and unlock by Haversine distance.
- SQR server integration: dynamic short link + branded QR publishing with `SQR_API_KEY` kept server-only.
- Configurable SQR custom domain/project IDs, ready for `scan.elevate.co` after the domain is verified in SQR.
- Development scene persistence with a repository-style JSON store, plus internal AR analytics events.
- MVP collectible claims with a per-browser UUID and a finite claim limit. Production must move claims to authenticated users and a transactional database.
- Automated Node tests for URL/HTTPS rules, asset limits, geofencing and claim limits.

## Run the complete local stack

```bash
cd apps/ar-studio
cp .env.example .env
npm install
npm run start:all
```

`start:all` starts the API on port 8787 and Vite on 5173. Vite proxies `/api` to the AR API.

Local development is for editing/testing only. A QR intended for another phone is blocked until `VITE_PUBLIC_AR_BASE_URL` points to a real HTTPS deployment.

## SQR + scan.elevate.co setup

1. In SQR, add and verify `scan.elevate.co` as a custom domain and complete the DNS record SQR requests.
2. Retrieve its SQR domain ID from the SQR dashboard/API and set `SQR_DOMAIN_ID` on the server.
3. Optionally create a dedicated `LIV8 AR` SQR project and set `SQR_PROJECT_ID`.
4. Put the lifetime-account API key in the deployment secret `SQR_API_KEY`. Never expose it as a `VITE_` variable and never commit it.
5. Deploy the AR viewer/API over HTTPS and set `VITE_PUBLIC_AR_BASE_URL`, for example `https://ar.elevate.co/`.
6. In AR Studio, add a public HTTPS model, configure the scene and press **Publish dynamic SQR experience**.

Publishing creates or updates the dynamic SQR link, then creates the QR tied to that link. The physical QR can remain unchanged while its destination is retargeted later.

## Data ownership

SQR owns QR/short-link delivery and scan analytics. LIV8 owns scene configuration and in-experience events such as `scene_open`, `ar_button`, `ar_session`, `geo_unlock`, `geo_denied` and collectible claims. The current JSON store is intentionally replaceable; Supabase/Postgres should be the production persistence layer.

## Production limits / next adapters

- Direct asset upload/object storage is still required to turn a file dropped from a user's computer into a public model without manually providing an HTTPS asset URL.
- The JSON dev store is not appropriate for horizontally scaled production or high-value sweepstakes claims.
- Image-target recognition, wall/poster tracking, richer camera effects and multi-object world composition remain the next layer. The official open 8th Wall stack can be used as an optional adapter where it adds image-target/world-tracking capability without making LIV8 dependent on it.
- Add authenticated ownership, moderation/rights controls, transactional claims, rate limiting and production analytics storage before public multi-tenant launch.

## Recommended mobile assets

The editor guardrail is 20 files / 100 MB, but production mobile AR should generally target 5–15 MB per GLB and keep normal experiences well below 50 MB. Mesh simplification and compressed textures have the biggest impact on load time.
