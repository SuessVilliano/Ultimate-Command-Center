# SQR integration plan for LIV8 AR Studio

SQR is the QR/link infrastructure layer; LIV8 AR Studio remains the source of truth for AR scenes, assets, permissions, claims, and experience logic.

## Why use SQR

SQR provides dynamic short links, branded/custom domains, QR styling, analytics, projects, pixels, targeting, password protection, temporary destinations, UTM campaigns, A/B testing, and an authenticated REST API. This means a physical printed QR can stay unchanged while LIV8 changes the destination experience behind it.

## Recommended architecture

Creator -> LIV8 AR Studio -> LIV8 scene record -> public AR scene URL
                                      |
                                      v
                               SQR dynamic link
                                      |
                                      v
                                  SQR QR code
                                      |
                                      v
                              printed / shared QR

A scan hits the SQR link first for routing + analytics, then redirects to a LIV8 public scene URL. The LIV8 scene ID is stable even when the AR content, model, video, scale, animation, campaign state, location rules, or ownership changes.

## Internal data model

Store these fields in our own DB:

- scene_id
- owner_id
- title / description
- public_slug
- scene_url
- trigger_type: qr | image | location | world | hybrid
- assets[]
- transforms / animation / audio settings
- visibility / publish status
- geofence rules
- claim / collectible rules
- created_at / updated_at
- sqr_link_id
- sqr_qr_id
- sqr_project_id
- sqr_domain_id (optional)
- sqr_short_url
- sqr_qr_asset_url

SQR IDs are foreign references, not our primary keys.

## Secrets

Never place an SQR API key in browser JavaScript. Set `SQR_API_KEY` only on the server environment. The included `server/sqr.js` proxy keeps the key server-side.

## Current proxy routes

- `GET /health` -> confirms whether SQR is configured
- `GET /qr-codes` -> lists SQR QR codes
- `GET /links` -> lists SQR links
- `POST /qr-codes` -> creates a branded URL QR code

Mount the router at a server route such as `/api/sqr` in the AR Studio production server.

## Publish flow to build next

1. Upload GLB/GLTF/image/video to object storage.
2. Save a LIV8 scene record and issue a stable public URL, e.g. `https://ar.liv8.co/x/abc123`.
3. Create or reuse an SQR dynamic short link pointing to that stable LIV8 scene URL.
4. Create an SQR URL QR linked to that dynamic link and an SQR Project.
5. Save returned SQR IDs/URLs in our DB.
6. Show the creator the branded QR image + short URL.
7. Pull SQR link statistics into the LIV8 analytics dashboard.
8. Keep AR interaction analytics in LIV8: AR-open, placement, animation, CTA, claim, dwell time, conversion, geofence success, etc.

## Important split of responsibilities

SQR owns scan routing and QR/link analytics. LIV8 owns AR content and user behavior inside the experience. We combine both datasets in one dashboard.

## White-label direction

Use a dedicated custom domain such as `scan.liv8.co`, `ar.liv8.co`, or a brand-specific domain. A QR can therefore expose a LIV8-branded short URL while SQR powers routing underneath.
