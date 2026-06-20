# Pi web_search

Local workspace for the Pi `web_search` tool.

- `src/` — source for the global Pi `web_search` extension.
- `package.json` — Pi package entry with `pi.extensions: ["./src/index.ts"]`.
- `/Users/syabro/.pi/agent/settings.json` — loads this project through `packages`.

Runtime defaults:

- keys are read from environment variables, no JSON config is required;
- configured env providers run in priority order with fallback enabled;
- set `WEB_SEARCH_PROVIDER_ORDER` or `providerOrder` in `websearch.json` to override provider order;
- if no search provider keys are present, the extension falls back to `duckduckgo-html`;
- pass `provider` to `web_search` to force one enabled provider by provider name or configured id;
- use `web_search_status` or `/websearch status` to show enabled providers without exposing keys.

Recommended setup:

- Use Parallel first for agent-oriented search results with compressed excerpts and a large starter credit.
- Use Serper second as a Google SERP fallback with simple setup and good free quota.
- Use Brave third as an independent-index fallback with monthly credits.
- Add Tavily or Exa when another quota pool or semantic search behavior is useful.
- Keep DuckDuckGo HTML as the no-key fallback only.

Recommended env order:

```env
WEB_SEARCH_PROVIDER_ORDER=parallel,serper,brave,tavily,exa
```

Supported env keys:

- `WEB_SEARCH_PROVIDER_ORDER`
- `SERPER_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `PARALLEL_API_KEY`
- `TAVILY_API_KEY`
- `EXA_API_KEY`
- `PERPLEXITY_API_KEY`
- `GOOGLE_CSE_API_KEY` plus `GOOGLE_CSE_ID` or `GOOGLE_SEARCH_ENGINE_ID`

Later work:

- random or round-robin provider routing;
- cooldown/exhaustion tracking for quota, billing, auth, and rate-limit failures.

Credits:

- This package is based on [`code-yeongyu/pi-websearch`](https://github.com/code-yeongyu/pi-websearch).
