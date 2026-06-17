# ▶️ START HERE — LIV8 Command Center (Mac App)

This runs the whole Command Center as a **real app on your laptop**. Nothing runs in
the cloud. The AI runs **locally and free** (Ollama). Your tickets only ever get
**drafts** — it never sends anything by itself.

---

## ✅ One-time setup (do this once, ~10 minutes)

**Step 1 — Install Node.js**
Go to <https://nodejs.org> → download the big green **LTS** button → open it → click
through Install.

**Step 2 — Install Ollama (the free local AI)**
Go to <https://ollama.com/download> → download → open it. That's it for now.

**Step 3 — Have your Freshdesk info ready**
You'll paste three things the first time you launch:
- **Domain** — the part before `.freshdesk.com` (e.g. `gohighlevelassist`)
- **API Key** — in Freshdesk: click your profile picture → **Profile Settings** →
  **Your API Key** (right side)
- **Agent ID** — your agent number

---

## 🚀 How to start it (every day)

**Step 1 —** Open the project folder in **Finder**.

**Step 2 —** Double-click **`Launch LIV8 Command Center.command`**

> 🔒 The very first time, Mac may say *"unidentified developer."*
> If so: **right-click** the file → **Open** → **Open**. You only do this once.

**Step 3 —** A black Terminal window opens and sets things up automatically
(downloads the AI model and installs pieces the first time — this can take a few
minutes once, then it's fast).

**Step 4 — (first launch only)** A text file (`server/.env`) pops open. Find these
three lines, paste your info after the `=`, then **save (⌘S) and close** the window:
```
FRESHDESK_DOMAIN=yourcompany
FRESHDESK_API_KEY=your_key_here
FRESHDESK_AGENT_ID=your_agent_id
```
Go back to the Terminal window and press **Return**.

**Step 5 —** The **LIV8 Command Center app window opens.** You're in. ✅

> Keep the little black Terminal window open in the background while you work.
> Closing it (or quitting the app) shuts everything down cleanly.

---

## 💬 How you'll handle a ticket

1. Open the **Tickets** page — your real Freshdesk tickets load.
2. Click a ticket → **Generate Response** (or **Pipeline** for the full,
   SOP-checked draft). You can also just talk to the voice assistant.
3. Read the draft. Edit anything.
4. Click **Copy & Open in Freshdesk** — it copies the draft *and* opens that ticket.
5. In Freshdesk: click **Reply**, paste (**⌘V**), read it once more, hit **Send**.

**The AI never sends for you. The Send click is always yours.**

---

## 🆘 If something's off

| Problem | Fix |
|---|---|
| Tickets won't load | Keep the Terminal window open; check the 3 Freshdesk lines in `server/.env` are right. Re-launch. |
| AI buttons greyed out / "offline" | The engine needs a second to start. Wait, then refresh. Make sure Ollama is installed. |
| First AI reply is slow | Normal — the local model warms up on the first question, then it's quick. |
| Want to redo Freshdesk setup | Delete `server/.env`, then double-click the launcher again. |

That's everything. Just double-click **`Launch LIV8 Command Center.command`** to start.

> Prefer it in a browser tab instead of an app window? Double-click **`start.command`**
> instead. More detail lives in **`LOCAL_SETUP.md`**.

---

## 🏗️ (Optional) Make a real app you drag into Applications

If you'd rather have a proper app in your Applications folder — no Terminal window
at all — you can build one once:

**Step 1 —** Make sure Node.js and Ollama are installed (same as above), and run
`ollama pull llama3.1` once in Terminal.

**Step 2 —** Double-click **`Build Mac App.command`**. It builds everything and, when
done, opens a **`release`** folder. (First time takes several minutes.)

**Step 3 —** In `release`, open **`LIV8 Command Center-1.0.0-*.dmg`**, then drag the
**LIV8 Command Center** icon onto the **Applications** shortcut.

**Step 4 —** Open it from Launchpad/Applications. The first time, **right-click the
app → Open → Open** (one time — it's not signed by Apple, so this clears the warning).

From then on it's a normal app: click the icon, the window opens, everything runs on
your laptop. Your settings/database live safely in
`~/Library/Application Support/LIV8 Command Center/` (so updates never wipe them).

> The app still needs **Node.js** and **Ollama** installed on the Mac — it uses them
> under the hood. Enter your Freshdesk details inside the app (Tickets page), or via
> the app menu **LIV8 Command Center → Open Settings File…**.

**Requirements to build:** you must run `Build Mac App.command` **on a Mac** (Apple's
app/dmg tooling is macOS-only). You build it once; then just use the app.
