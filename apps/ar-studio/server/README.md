# AR Studio server adapters

## SQR

Set `SQR_API_KEY` as a server-side environment variable. Do not expose it through Vite/browser environment variables.

Available modules:

- `sqr.js`: QR list/create and link list routes
- `sqr-links.js`: dynamic-link create/update and custom-domain list routes

Recommended production mount:

```js
import sqrRouter from './sqr.js'
import sqrLinksRouter from './sqr-links.js'

app.use('/api/sqr', sqrRouter)
app.use('/api/sqr', sqrLinksRouter)
```

The intended publish sequence is:

1. LIV8 creates/persists an AR scene and stable scene URL.
2. Server creates an SQR dynamic link to that scene URL.
3. Server creates an SQR branded QR code attached to the dynamic link.
4. LIV8 stores the returned SQR IDs as external references.
5. SQR handles physical QR continuity/routing and scan analytics; LIV8 handles scene analytics and AR interaction data.
