# Full Diff: PR #59138

```diff
diff --git a/packages/core/src/plugin/websearch/index.ts b/packages/core/src/plugin/websearch/index.ts
index 8399904ece42..948c63e5046c 100644
--- a/packages/core/src/plugin/websearch/index.ts
+++ b/packages/core/src/plugin/websearch/index.ts
@@ -1,6 +1,7 @@
 import { WebSearchExa } from "./exa.js"
 import { WebSearchFirecrawl } from "./firecrawl.js"
 import { WebSearchParallel } from "./parallel.js"
+import { WebSearchSearxng } from "./searxng.js"
 import { WebSearchTavily } from "./tavily.js"
 import { WebSearchTinyFish } from "./tinyfish.js"
 
@@ -8,6 +9,7 @@ export const WebSearchPlugins = [
   WebSearchExa.Plugin,
   WebSearchFirecrawl.Plugin,
   WebSearchParallel.Plugin,
+  WebSearchSearxng.Plugin,
   WebSearchTavily.Plugin,
   WebSearchTinyFish.Plugin,
 ] as const
diff --git a/packages/core/src/plugin/websearch/searxng.ts b/packages/core/src/plugin/websearch/searxng.ts
new file mode 100644
index 000000000000..bfd31481162c
--- /dev/null
+++ b/packages/core/src/plugin/websearch/searxng.ts
@@ -0,0 +1,119 @@
+export * as WebSearchSearxng from "./searxng.js"
+
+import { define } from "@opencode/plugin/effect/plugin"
+import { Duration, Effect, Schema, Scope } from "effect"
+import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http"
+import { App } from "../../app.js"
+
+/**
+ * SearXNG is a metasearch server the user runs, so its account is an address
+ * rather than an API key: the integration offers an `external` method whose
+ * form takes the server URL, and `SEARXNG_URL` covers a user who already
+ * exported it. The instance has to publish the JSON format
+ * (`search.formats: [html, json]` in settings.yml), otherwise it answers 403.
+ */
+const SearchResponse = Schema.Struct({
+  results: Schema.Array(
+    Schema.Struct({
+      // SearXNG emits entries without a URL and `"publishedDate": null`; both
+      // are filtered or ignored below instead of failing the whole response.
+      url: Schema.optional(Schema.NullOr(Schema.String)),
+      title: Schema.optional(Schema.NullOr(Schema.String)),
+      content: Schema.optional(Schema.NullOr(Schema.String)),
+      publishedDate: Schema.optional(Schema.NullOr(Schema.String)),
+    }),
+  ),
+})
+
+const DEFAULT_LIMIT = 8
+
+export const Plugin = define<HttpClient.HttpClient | Scope.Scope>({
+  id: "opencode.websearch.searxng",
+  effect: Effect.fn("WebSearchSearxng.Plugin")(function* (ctx) {
+    const http = yield* HttpClient.HttpClient
+    yield* ctx.integration.transform((editor) => {
+      editor.update("searxng", (integration) => (integration.name = "SearXNG"))
+      editor.method.update({
+        integrationID: "searxng",
+        method: {
+          id: "server",
+          type: "external",
+          label: "Your SearXNG server",
+          form: [
+            {
+              key: "url",
+              type: "string",
+              format: "uri",
+              title: "Server URL",
+              placeholder: "http://localhost:8080",
+              required: true,
+            },
+          ],
+        },
+      })
+      editor.method.update({
+        integrationID: "searxng",
+        method: { type: "env", names: ["SEARXNG_URL"] },
+      })
+    })
+    yield* ctx.websearch.transform((editor) => {
+      editor.add({
+        id: "searxng",
+        name: "SearXNG",
+        execute: (input) =>
+          Effect.gen(function* () {
+            const connection = yield* ctx.integration.connection.active("searxng")
+            const credential = connection ? yield* ctx.integration.connection.resolve(connection) : undefined
+            const server = serverUrl(credential)
+            if (!server)
+              return yield* Effect.fail(
+                new Error("SearXNG has no server URL yet. Set it in Settings, or export SEARXNG_URL."),
+              )
+            const request = HttpClientRequest.get(searchUrl(server, input.query)).pipe(
+              HttpClientRequest.acceptJson,
+              HttpClientRequest.setHeaders({ "User-Agent": App.useragent(ctx.app) }),
+            )
+            const response = yield* HttpClient.withScope(HttpClient.filterStatusOk(http))
+              .execute(request)
+              .pipe(
+                Effect.flatMap(HttpClientResponse.schemaBodyJson(SearchResponse)),
+                Effect.scoped,
+                Effect.timeoutOrElse({
+                  duration: Duration.seconds(25),
+                  orElse: () => Effect.fail(new Error("SearXNG web search request timed out")),
+                }),
+              )
+            return response.results.flatMap((item) => {
+              if (!item.url || !item.url.trim()) return []
+              const published = item.publishedDate ? Date.parse(item.publishedDate) : undefined
+              const title = item.title?.trim() || undefined
+              const content = item.content?.trim() || undefined
+              return [
+                {
+                  url: item.url,
+                  ...(title ? { title } : {}),
+                  ...(content ? { content } : {}),
+                  time: { ...(published !== undefined && Number.isFinite(published) ? { published } : {}) },
+                },
+              ]
+            }).slice(0, DEFAULT_LIMIT)
+          }),
+      })
+    })
+  }),
+})
+
+const serverUrl = (credential: { type: string; metadata?: Record<string, unknown> } | undefined) => {
+  const saved = credential?.type === "external" ? credential.metadata?.url : undefined
+  const value = typeof saved === "string" && saved.trim() ? saved.trim() : process.env.SEARXNG_URL?.trim()
+  return value || undefined
+}
+
+/** A user typing `localhost:8080` means a host, not the `localhost:` scheme. */
+const searchUrl = (server: string, query: string) => {
+  const base = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(server) ? server : `http://${server}`
+  const url = new URL(`${base.replace(/\/+$/, "")}/search`)
+  url.searchParams.set("q", query)
+  url.searchParams.set("format", "json")
+  return url.toString()
+}
diff --git a/packages/core/test/plugin/websearch-fixture.ts b/packages/core/test/plugin/websearch-fixture.ts
index 4c750f1d652f..e73c2cc426f8 100644
--- a/packages/core/test/plugin/websearch-fixture.ts
+++ b/packages/core/test/plugin/websearch-fixture.ts
@@ -39,11 +39,20 @@ const http = Layer.succeed(
   HttpClient.make((request, _url, signal) =>
     Effect.sync(() => {
       signals.push(signal)
-      if (request.body._tag !== "Uint8Array") throw new Error(`Unexpected request body: ${request.body._tag}`)
+      // GET providers (SearXNG) send no body; record undefined for them and
+      // keep failing on anything that is neither bytes nor empty.
+      let body: unknown
+      if (request.body._tag === "Uint8Array") {
+        body = JSON.parse(new TextDecoder().decode(request.body.body))
+      } else if (request.body._tag === "Empty") {
+        body = undefined
+      } else {
+        throw new Error(`Unexpected request body: ${request.body._tag}`)
+      }
       requests.push({
         url: request.url,
         headers: request.headers,
-        body: JSON.parse(new TextDecoder().decode(request.body.body)),
+        body,
       })
       return HttpClientResponse.fromWeb(
         request,
diff --git a/packages/core/test/plugin/websearch.test.ts b/packages/core/test/plugin/websearch.test.ts
index b691e6a6dbb7..6ef1c62cd218 100644
--- a/packages/core/test/plugin/websearch.test.ts
+++ b/packages/core/test/plugin/websearch.test.ts
@@ -5,6 +5,7 @@ import { WebSearch } from "@opencode/core/websearch"
 import { WebSearchExa } from "@opencode/core/plugin/websearch/exa"
 import { WebSearchFirecrawl } from "@opencode/core/plugin/websearch/firecrawl"
 import { WebSearchParallel } from "@opencode/core/plugin/websearch/parallel"
+import { WebSearchSearxng } from "@opencode/core/plugin/websearch/searxng"
 import { WebSearchTavily } from "@opencode/core/plugin/websearch/tavily"
 import { WebSearchTinyFish } from "@opencode/core/plugin/websearch/tinyfish"
 import { host, integrationHost, webSearchHost } from "./host"
@@ -43,6 +44,7 @@ describe("built-in web search providers", () => {
     WebSearchFirecrawl.Plugin,
     WebSearchTavily.Plugin,
     WebSearchTinyFish.Plugin,
+    WebSearchSearxng.Plugin,
   ].forEach((plugin) => {
     it.effect(`releases rate-limited HTTP requests for ${plugin.id} before caching their errors`, () =>
       Effect.gen(function* () {
@@ -50,6 +52,15 @@ describe("built-in web search providers", () => {
         const integrations = yield* Integration.Service
         const websearch = yield* WebSearch.Service
         yield* plugin.effect(host({ integration: integrationHost(integrations), websearch: webSearchHost(websearch) }))
+        // SearXNG's account is a server address: without one it fails before
+        // any request, so the shared 429 path needs a configured server.
+        if (plugin.id === "opencode.websearch.searxng") {
+          yield* integrations.connection.external({
+            integrationID: Integration.ID.make("searxng"),
+            methodID: Integration.MethodID.make("server"),
+            answer: { url: "http://localhost:8080" },
+          })
+        }
         yield* websearch.select("random")
         expect(yield* websearch.query({ query: "limited" }).pipe(Effect.flip)).toBeInstanceOf(WebSearch.RequestError)
         expect(signals).toHaveLength(1)
@@ -370,4 +381,56 @@ describe("built-in web search providers", () => {
Divider
       expect(requests[3]?.headers["x-tinyfish-access-mode"]).toBeUndefined()
     }),
   )
+
+  it.effect("searches a SearXNG server configured by its URL form", () =>
+    Effect.gen(function* () {
+      resetWebSearchFixture(
+        JSON.stringify({
+          results: [
+            {
+              url: "https://effect.website/docs",
+              title: "Effect docs",
+              content: "Effect documentation",
+              publishedDate: "2026-07-25T00:00:00.000Z",
+            },
+            { title: "A result without a URL is dropped" },
+          ],
+        }),
+      )
+      const integrations = yield* Integration.Service
+      const websearch = yield* WebSearch.Service
+      yield* WebSearchSearxng.Plugin.effect(
+        host({ integration: integrationHost(integrations), websearch: webSearchHost(websearch) }),
+      )

+      expect(yield* integrations.get(Integration.ID.make("searxng"))).toMatchObject({
+        id: "searxng",
+        name: "SearXNG",
+        methods: [
+          { id: "server", type: "external" },
+          { type: "env", names: ["SEARXNG_URL"] },
+        ],
+      })
+
+      yield* integrations.connection.external({
+        integrationID: Integration.ID.make("searxng"),
+        methodID: Integration.MethodID.make("server"),
+        answer: { url: "http://localhost:8080" },
+      })
+      expect(yield* websearch.query({ query: "effect docs", providerID: WebSearch.ID.make("searxng") })).toEqual(
+        new WebSearch.Response({
+          providerID: WebSearch.ID.make("searxng"),
+          results: [
+            {
+              url: "https://effect.website/docs",
+              title: "Effect docs",
+              content: "Effect documentation",
+              time: { published: Date.parse("2026-07-25T00:00:00.000Z") },
+            },
+          ],
+        }),
+      )
+      expect(requests[0]?.url).toBe("http://localhost:8080/search?q=effect+docs&format=json")
+    }),
+  )
 })
```
