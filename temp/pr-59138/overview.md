# PR Overview: feat(websearch): add a SearXNG provider configured by server URL

- **PR Number:** #59138
- **Repository:** `anomalyco/opencode`
- **Author:** [He-Xun](https://github.com/He-Xun)
- **Status:** Open
- **Branch:** `feat/websearch-searxng-provider` -> `dev`
- **HTML URL:** https://github.com/anomalyco/opencode/pull/59138

## Description

Adds `searxng` as a built-in web search provider, next to exa/tavily/firecrawl/parallel/tinyfish, so search can run against a self-hosted SearXNG instance with no third-party API key.

The problem: every current provider calls a hosted service. There is no self-hosted option, so a user who wants search to stay on their own network cannot have it.

### Integration Details

SearXNG's account is a server address, not an API key, so `{ type: "key" }` cannot express it. It registers an `external` method whose form takes the URL, plus the usual `env` method for `SEARXNG_URL`:

```ts
editor.method.update({
  integrationID: "searxng",
  method: {
    id: "server",
    type: "external",
    label: "Your SearXNG server",
    form: [{ key: "url", type: "string", format: "uri", title: "Server URL", placeholder: "http://localhost:8080", required: true }],
  },
})
```

`execute` reads that URL back from the resolved credential's `metadata.url`, falling back to `SEARXNG_URL`. A bare host like `localhost:8088` gets `http://` prepended so it searches instead of throwing, and results without a `url` are dropped like the other providers do. Everything else follows `tavily.ts`: `Schema` for the response, `HttpClientRequest.get` + `filterStatusOk`, a 25s timeout, `{ url, title, content, time }`, first 8 results.

The instance must publish the JSON format (`search.formats` including `json` in `settings.yml`); otherwise SearXNG answers 403 and the request fails rather than silently returning nothing.

## Changed Files (4 files, +195 / -2)

1. `packages/core/src/plugin/websearch/index.ts` - Registers `WebSearchSearxng.Plugin` in `WebSearchPlugins`.
2. `packages/core/src/plugin/websearch/searxng.ts` - Implements the SearXNG web search provider plugin, response schema, and URL resolution.
3. `packages/core/test/plugin/websearch-fixture.ts` - Updates test fixture to support bodyless GET requests (SearXNG).
4. `packages/core/test/plugin/websearch.test.ts` - Adds comprehensive unit tests for SearXNG integration registration, external server URL config, and query response mapping.
