# LIV8 iOS Shortcut — Hands-Free Command Center

Endpoint: `POST /api/shortcut/voice`

Server secret:

`LIV8_SHORTCUT_TOKEN=<long-random-secret>`

If `LIV8_SHORTCUT_TOKEN` is not set, the endpoint also accepts the existing `APPLE_HEALTH_INGEST_TOKEN`. Keep the secret only in server environment variables and the private Shortcut.

## Best setup: one LIV8 Shortcut

Build one Shortcut with a small menu: **Talk**, **Sync Health**, **Journal**, **Ask Juno**.

### Talk / Ask Juno
1. **Dictate Text** — prompt: `Talk to LIV8`
2. **Get Contents of URL** — `<your Command Center API>/api/shortcut/voice`
3. Method: `POST`
4. Header: `Authorization: Bearer <your token>`
5. JSON body:
   - `text`: Dictated Text
   - `mode`: `auto` for Talk, or `assistant` for Ask Juno
   - `source`: `ios_shortcut`
6. Get `spokenText` from the JSON response.
7. **Speak Text** — speak `spokenText`.

### Sync Health
Use Apple Health / Health actions in Shortcuts to get the latest values you want, then send them in the same endpoint:

```json
{
  "mode": "sync",
  "source": "ios_shortcut",
  "health": {
    "date": "Current Date formatted yyyy-MM-dd",
    "steps": 0,
    "active_calories": 0,
    "exercise_min": 0,
    "stand_hours": 0,
    "resting_hr": 0,
    "walking_hr": 0,
    "hrv": 0,
    "respiratory_rate": 0,
    "oxygen_saturation": 0,
    "sleep_hours": 0,
    "weight": 0,
    "body_fat": 0
  }
}
```

Only include fields the Shortcut successfully reads; missing fields are allowed. The response says `Your Apple Health data is synced to LIV8.`

### Talk + sync health in one request
You can also send both `text` and `health` with `mode: auto`. LIV8 will ingest the health snapshot first, journal the observation when appropriate, route the spoken request to Juno/tools, then return one `spokenText` response.

## Modes
- `auto`: private life observations are journaled; other requests route to Juno/tools. May include `health`.
- `journal`: fast private Life Journal capture; skips AI generation. May include `health`.
- `assistant`: ask Juno/tool router without automatic journaling. May include `health`.
- `sync`: health-only update; no AI call required.

## Examples
- “I had eggs, oatmeal, and a protein shake for breakfast.” → Life Journal + Juno acknowledgement.
- “I feel stressed, stress 8 out of 10, and tired.” → mood/stress/energy observation.
- “What meetings do I have tomorrow?” → Calendar tool through Juno.
- “How was my recovery today?” → Health/Oura tools through Juno.
- “Log that I’m proud I finished the landing page.” → Life Journal win.

The Command Center **Sync All** button pulls every source the server can refresh directly. Apple Health is different because HealthKit lives on the iPhone; the Shortcut is the secure push bridge that makes Apple Health current inside LIV8.