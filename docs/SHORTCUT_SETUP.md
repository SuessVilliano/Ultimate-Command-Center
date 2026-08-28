# LIV8 iOS Shortcut — Hands-Free Command Center

Endpoint: `POST /api/shortcut/voice`

Required server environment variable:

`LIV8_SHORTCUT_TOKEN=<long-random-secret>`

Shortcut flow:
1. **Dictate Text** — prompt: `Talk to LIV8`
2. **Get Contents of URL** — your Command Center API URL + `/api/shortcut/voice`
3. Method: `POST`
4. Header: `Authorization: Bearer <LIV8_SHORTCUT_TOKEN>`
5. JSON body:
   - `text`: Dictated Text
   - `mode`: `auto`
   - `source`: `ios_shortcut`
6. Read `spokenText` from the JSON result.
7. **Speak Text** — speak `spokenText`.

Modes:
- `auto`: journal real-life observations when detected, otherwise route to Juno/tools.
- `journal`: fast private Life Journal capture; skips AI generation.
- `assistant`: ask Juno/tool router without automatic journaling.

Examples:
- “I had eggs, oatmeal, and a protein shake for breakfast.” → Life Journal + Juno acknowledgement.
- “I feel stressed, stress 8 out of 10, and tired.” → mood/stress/energy observation.
- “What meetings do I have tomorrow?” → Calendar tool through Juno.
- “How was my recovery today?” → Health/Oura tools through Juno.
- “Log that I’m proud I finished the landing page.” → Life Journal win.

Do not put the secret token into source code or a public URL. Keep it only in the server environment and the private iOS Shortcut.