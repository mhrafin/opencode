---
name: c4-architecture-review
description: Review C4 or other architecture diagrams for structural correctness and missing system design, and keep diagrams coherent with ADRs. Use when reviewing/updating a .puml C4 diagram, when asked "what system design am I missing", or when a diagram change conflicts with an existing ADR.
---

# C4 Architecture Review

Review in two passes: **structure** (is the diagram mechanically valid C4) then **completeness** (does it describe a buildable system). Ground every review in the repo's docs first.

## Phase 0: Ground yourself

Before judging the diagram, read:

1. The diagram file itself
2. All ADRs (`docs/03-adr/` or wherever the repo keeps them)
3. The docs README / project description

Nothing below works without knowing what the project actually is and already decided.

## Phase 1: Structural checklist (mechanics)

These are the bugs found in real reviews — check each:

- **Boundaries are not relationship targets.** `Container_Boundary(...)`/`System_Boundary(...)` create grouping boxes, not addressable elements. `Rel(x, the_boundary, ...)` is invalid structure. Declare `Container(nextjs, "Name", "Tech", "Desc")` *inside* the boundary and relate to that.
- **No orphaned elements.** Every declared element participates in at least one relationship. A data-access component with only a DB link and no link from its own app is floating.
- **One abstraction level per diagram.** Pick the matching include — `C4_Context.puml`, `C4_Container.puml`, or `C4_Component.puml` — and don't mix levels (e.g. a component-level "Data Access (Drizzle)" inside a container-level diagram).
- **Standard boilerplate:** `!pragma layout smetana` and the plantuml-stdlib C4 include (raw.githubusercontent.com URL) unless the repo uses local includes.
- **Descriptions on every element.** Only external systems having descriptions while internals have none is backwards.
- **Relationship labels describe real flows** ("Writes lead (pending), updates status"), not vague arrows.

## Phase 2: Design-completeness checklist (what's missing)

Work through each category and state explicitly whether it applies, is deliberately out of scope, or is a gap:

1. **Third-party failure paths.** Every `System_Ext` dependency is a single point of failure. What happens when it's down, rate-limits, or rejects? If the owner's only channel is email, an email-API outage silently loses the product's output — look for a resilience path (e.g. write-with-pending-status first, scheduled retry job).
2. **Deployment target vs infrastructure choices.** Cross-check the diagram's datastore/deployment against the ADRs. Classic conflict: serverless hosting (Vercel/Netlify, ephemeral filesystem) vs a local SQLite file — that combination is unbuildable and needs a hosted variant (Turso/LibSQL, Postgres) or a VPS decision.
3. **Spam/abuse on public endpoints.** Any public form triggering outbound email needs rate limiting + CAPTCHA/honeypot.
4. **PII handling.** Names/emails in a database deserve a retention/deletion note or ADR.
5. **Observability & analytics.** Logging/error tracking, and for lead-gen tools, conversion measurement (the stated business goal).
6. **Owner/admin surface.** Email-only vs dashboard is a real tradeoff — email-only keeps "not a CRM" scope but raises the stakes on (1).
7. **Unresolved decisions → TBD notes on the diagram.** Render open questions as `note` blocks anchored to the relevant element (e.g. estimator config location: TS module vs DB-driven) so the diagram is honest about what's undecided.

## Phase 3: Ask before proposing

When a gap's resolution depends on a user decision, use the `question` tool before writing anything. Decision-shaped questions from real reviews: hosting target (VPS vs serverless vs undecided), owner access model (email-only vs admin page), config location (code vs DB). Options should include the recommendation first, labeled "(Recommended)".

## Phase 4: Report structure

Split findings into two sections — they fix differently:

1. **Diagram mechanics** (Phase 1): bugs in the file
2. **Missing design** (Phase 2): gaps in the system

End with a concrete proposed rewrite (show the new `.puml` inline) and any ADR work it implies.

## Phase 5: ADR coherence

When the proposed diagram change contradicts an existing ADR:

1. **Write a new ADR** (e.g. `docs/03-adr/002-hosting.md`) following **the repo's existing ADR format** — read the current ADRs and match their heading structure (this repo uses `# Decision` / `# Reason` / `# Other Options`); do not import an outside template.
2. **Cross-reference the old ADR:** add a short superseded-note blockquote right under its Decision stating what changed and what still stands, linking to the new ADR.
3. Never silently contradict a written decision.

## Phase 6: Validate

After rewriting any `.puml`, run the **plantuml-validate** skill (render remotely via browser, visually confirm, full cleanup including the MCP-spawned browser process).
