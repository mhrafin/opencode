import { Plugin } from "@opencode/plugin"
import zlib from "node:zlib"
import fs from "node:fs/promises"
import fsSync from "node:fs"
import path from "node:path"

/**
 * puml-guard — enforce the plantuml-validate skill workflow structurally.
 *
 * Layer 1 (hard): permission evaluate hook denies write/edit on *.puml files
 *   in sessions where the plantuml-validate skill has not been loaded.
 * Layer 2 (soft): dirty flag per session; while a .puml has been edited and no
 *   successful render has been observed, every model call gets a system reminder.
 * Layer 3 (auto): after a .puml edit the plugin renders the file itself against
 *   the PlantUML server; success clears the flag, failure attaches the error.
 */

const SKILL_ID = "plantuml-validate"
const RENDER_URL = "http://www.plantuml.com/plantuml/svg/~1"
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "image/svg+xml,image/*,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
}
const RENDER_URL_MARKER = /plantuml\.com\/plantuml\/|kroki\.io\/plantuml\//

// The plugin is set up once per active location, so hooks can be registered
// multiple times; this set keeps concurrent duplicate auto-renders out.
const inflight = new Set<string>()

// console.log from plugin code does not reach opencode.log, so audit to a file.
const AUDIT_LOG = "/tmp/opencode/puml-guard.log"
const log = (msg: string) => {
  try {
    fsSync.appendFileSync(AUDIT_LOG, `${new Date().toISOString()} [puml-guard] ${msg}\n`)
  } catch {
    /* audit must never break the hook */
  }
}

// ---------- PlantUML URL encoding (same algorithm as plantuml-encoder) ----------
function encode6bit(b: number): string {
  if (b < 10) return String.fromCharCode(48 + b)
  b -= 10
  if (b < 26) return String.fromCharCode(65 + b)
  b -= 26
  if (b < 26) return String.fromCharCode(97 + b)
  b -= 26
  if (b === 0) return "-"
  if (b === 1) return "_"
  return "?"
}
function append3(b1: number, b2: number, b3: number): string {
  return (
    encode6bit(b1 >> 2) +
    encode6bit(((b1 & 0x3) << 4) | (b2 >> 4)) +
    encode6bit(((b2 & 0xf) << 2) | (b3 >> 6)) +
    encode6bit(b3 & 0x3f)
  )
}
function encodeSource(buf: Buffer): string {
  let out = ""
  for (let i = 0; i < buf.length; i += 3) {
    out += append3(buf[i], i + 1 < buf.length ? buf[i + 1] : 0, i + 2 < buf.length ? buf[i + 2] : 0)
  }
  return out
}

// ---------- helpers ----------
interface SessionState {
  skillLoaded: boolean
  dirty: boolean
  notified?: boolean
  lastError?: string
}
const states = new Map<string, SessionState>()
function stateOf(sessionID: string): SessionState {
  let s = states.get(sessionID)
  if (!s) {
    s = { skillLoaded: false, dirty: false }
    states.set(sessionID, s)
  }
  return s
}
// Persist across plugin reloads/upgrades: a skill already loaded into a
// session's context is still loaded after the plugin re-sets-up.
async function hydrate(ctx: { storage: { get(k: string): Promise<unknown>; set(k: string, v: unknown): Promise<void> } }) {
  try {
    const saved = (await ctx.storage.get("states")) as Record<string, SessionState> | undefined
    if (saved) for (const [id, s] of Object.entries(saved)) states.set(id, s)
  } catch {
    /* start fresh on any storage problem */
  }
}
function persist(ctx: { storage: { set(k: string, v: unknown): Promise<void> } }) {
  void ctx.storage.set("states", Object.fromEntries(states)).catch(() => {})
}

// One live interjection per dirty episode: system-append text can be deprioritized
// by a narrow user instruction; a queued message in the conversation cannot be
// as easily scoped away.
async function notifyOnce(
  ctx: {
    storage: { set(k: string, v: unknown): Promise<void> }
    session: { synthetic(i: { sessionID: string; text: string }): Promise<unknown> }
  },
  sessionID: string,
  s: SessionState,
  what: string,
) {
  if (s.notified) return
  s.notified = true
  persist(ctx)
  try {
    await ctx.session.synthetic({
      sessionID,
      text:
        `[puml-guard] Validation required: ${what} does not pass a render check` +
        (s.lastError ? ` — ${s.lastError}` : "") +
        `. Before you send your next response, load the plantuml-validate skill if ` +
        `it is not loaded, render the file, and fix it until it renders clean. ` +
        `This applies even if the user's request appeared complete.`,
    })
    log(`synthetic validation notice sent (session ${sessionID})`)
  } catch (e) {
    log(`synthetic notice FAILED: ${(e as Error).message}`)
  }
}

function isPumlPath(p: unknown): p is string {
  return typeof p === "string" && p.toLowerCase().endsWith(".puml")
}
function inputPaths(input: unknown): string[] {
  if (!input || typeof input !== "object") return []
  const i = input as Record<string, unknown>
  const out: string[] = []
  if (isPumlPath(i.path)) out.push(i.path)
  if (isPumlPath(i.filePath)) out.push(i.filePath)
  if (Array.isArray(i.paths)) for (const p of i.paths) if (isPumlPath(p)) out.push(p)
  return out
}
function shellCommand(input: unknown): string {
  if (input && typeof input === "object" && typeof (input as any).command === "string")
    return (input as any).command
  return ""
}
function shellWritesPuml(cmd: string): boolean {
  if (!/\.puml\b/i.test(cmd)) return false
  if (/>>?\s*[^;&|]*\.puml\b/i.test(cmd)) return true // redirect into a puml file
  return /\b(?:tee|sed\s+-i|cp|mv)\b[^;&|]*\.puml\b/i.test(cmd)
}

async function autoRender(
  src: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(RENDER_URL + encodeSource(zlib.deflateSync(Buffer.from(src))), {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15_000),
    })
    if (res.status === 200) {
      const body = await res.text()
      if (body.includes("<svg")) return { ok: true }
      return { ok: false, error: "unexpected render response" }
    }
    const body = await res.text()
    const text = body
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    // The actual error details follow the help text, starting at "From string".
    const focus = text.includes("From string")
      ? text.slice(text.indexOf("From string"))
      : text
    return { ok: false, error: `render rejected (HTTP ${res.status}): ${focus.slice(0, 400)}` }
  } catch (e) {
    return { ok: false, error: `render service unreachable (${(e as Error).message})` }
  }
}

export default Plugin.define({
  id: "puml-guard",
  async setup(ctx) {
    await hydrate(ctx)
    log("loaded")

    // Layer 1: hard gate — no .puml edits unless the validate skill is loaded.
    await ctx.permission.hook("evaluate", (event) => {
      if (event.effect === "deny") return
      const s = stateOf(event.sessionID)
      if (s.skillLoaded) return
      const skillHint = `Load the "${SKILL_ID}" skill with the skill tool, then retry.`
      if (event.action === "edit" && event.resources.some((r) => r.toLowerCase().endsWith(".puml"))) {
        event.effect = "deny"
        event.message = `puml-guard: editing *.puml files requires the ${SKILL_ID} skill. ${skillHint}`
        log(`deny edit (skill not loaded) in session ${event.sessionID}`)
        return
      }
      if (event.action === "shell" && shellWritesPuml(event.resources.join(" "))) {
        event.effect = "deny"
        event.message = `puml-guard: modifying *.puml files via shell requires the ${SKILL_ID} skill. ${skillHint}`
        log(`deny shell write (skill not loaded) in session ${event.sessionID}`)
      }
    })

    // Observations: skill load, puml edits (dirty + auto-render), render evidence.
    await ctx.tool.hook("execute.after", async (event) => {
      const s = stateOf(event.sessionID)

      // skill load opens the gate
      if (event.tool === "skill" && event.status === "completed") {
        const id = (event.input as { id?: string } | null)?.id
        if (id === SKILL_ID) {
          s.skillLoaded = true
          persist(ctx)
          log(`skill loaded in session ${event.sessionID}`)
        }
        return
      }
      if (event.status !== "completed") return

      // puml edit → mark dirty, then auto-validate (layer 3)
      if (event.tool === "write" || event.tool === "edit" || event.tool === "patch") {
        const paths = inputPaths(event.input)
        if (paths.length === 0) return
        const target = paths[0]
        s.dirty = true
        s.lastError = undefined
        const key = `${event.sessionID}:${target}`
        if (inflight.has(key)) return
        inflight.add(key)
        log(`puml edited: ${target}; auto-validating`)
        try {
          let readTarget = target
          if (!path.isAbsolute(readTarget)) {
            try {
              const sess = (await ctx.session.get({ sessionID: event.sessionID })) as {
                directory?: string
              }
              if (sess.directory) readTarget = path.resolve(sess.directory, readTarget)
            } catch {
              /* fall through to raw path */
            }
          }
          const result = await autoRender(await fs.readFile(readTarget, "utf8"))
          if (result.ok) {
            s.dirty = false
            s.notified = false
            s.lastError = undefined
            log(`auto-validate OK: ${target}`)
          } else if (s.dirty) {
            s.lastError = `${path.basename(target)}: ${result.error}`
            log(`auto-validate FAILED: ${s.lastError}`)
            await notifyOnce(ctx, event.sessionID, s, path.basename(target))
          }
        } catch (e) {
          if (s.dirty) {
            s.lastError = `${path.basename(target)}: could not read for auto-validation (${(e as Error).message})`
            log(`auto-validate ERROR: ${s.lastError}`)
            await notifyOnce(ctx, event.sessionID, s, path.basename(target))
          }
        } finally {
          inflight.delete(key)
          persist(ctx)
        }
        return
      }

      // render evidence from other tools clears the dirty flag (layer 2)
      if (!s.dirty) return
      if (event.tool === "shell") {
        const cmd = shellCommand(event.input)
        if (/plantuml|kroki/i.test(cmd)) {
          s.dirty = false
          s.notified = false
          s.lastError = undefined
          persist(ctx)
          log("render evidence: shell")
          return
        }
        if (shellWritesPuml(cmd)) {
          s.dirty = true
          s.lastError = "puml modified via shell; automatic validation not attempted"
          persist(ctx)
          log("shell puml write observed; reminder stays on")
          await notifyOnce(ctx, event.sessionID, s, "a .puml file modified via shell")
          return
        }
        return
      }
      if (event.tool !== "skill" && RENDER_URL_MARKER.test(JSON.stringify(event.input ?? {}))) {
        s.dirty = false
        s.notified = false
        s.lastError = undefined
        persist(ctx)
        log(`render evidence: ${event.tool}`)
      }
    })

    // Layer 2: reminder on every model step while a puml edit is unverified.
    await ctx.session.hook("context", (event) => {
      const s = stateOf(event.sessionID)
      if (!s.dirty) return
      // Multiple hook registrations share this event; push at most once.
      if (
        event.system.some(
          (part) =>
            part.type === "text" &&
            typeof part.text === "string" &&
            part.text.includes("[puml-guard]"),
        )
      )
        return
      const skillBit = s.skillLoaded
        ? `Load and follow the "${SKILL_ID}" skill workflow now.`
        : `First load the "${SKILL_ID}" skill with the skill tool, then follow its workflow.`
      const errBit = s.lastError ? ` Latest automatic validation result: ${s.lastError}` : ""
      log(`reminder pushed (session ${event.sessionID}; error: ${s.lastError ?? "none"})`)
      event.system.push({
        type: "text",
        text:
          `[puml-guard] A .puml file was modified in this session but no successful ` +
          `render has been observed yet. ${skillBit} Do not conclude work on the ` +
          `diagram until it renders successfully.${errBit}`,
      })
    })
  },
})
