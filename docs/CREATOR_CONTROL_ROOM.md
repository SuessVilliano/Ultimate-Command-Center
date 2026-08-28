# Creator Control Room

The Creator Control Room turns Content Engine into the operating surface for production rather than another isolated tab.

## Compartments
- Native LIV8 Content Engine
- Clipped It livestream intelligence app
- OBS Remote studio/stream-control app
- Agent orchestration lane for Juno and specialist agents

The external/local apps remain their own source systems. Command Center embeds or launches them rather than reimplementing their internals.

## Configuration
```env
VITE_CLIPPEDIT_URL=
VITE_OBS_REMOTE_URL=
```

For local Mac use, OBS Remote can point to the private local/tunnel address for the studio controller. For deployed use, provide an authenticated HTTPS endpoint.

## Design rule
Juno is the executive operator. Specialist leads own domains (content, trading, DevOps, GHL/business, health/life), and worker agents perform bounded tasks. External/destructive/high-risk writes stay approval-gated.
