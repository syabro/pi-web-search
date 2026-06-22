# Pi web_search

Global Pi extension that provides `web_search` and `web_search_status` tools with provider-backed web search, fallback routing, and environment-based configuration.

## Install

```bash
git clone https://github.com/syabro/pi-web-search.git
cd pi-web-search
bun install
cp .env.default .env
```

Add the checkout path to Pi settings:

```json
{
  "packages": ["/path/to/pi-web-search"]
}
```

Restart Pi after changing environment variables. Use `/reload` only for code or package changes.

## Runtime defaults

- Keys are read from environment variables, no JSON config is required.
- Env keys override matching `apiKey` values in JSON config.
- JSON config can define defaults such as `providerOrder`, `strategy`, `fallback`, ids, max results, weights, and domain filters.
- Configured providers run in priority order with fallback enabled.
- Set `WEB_SEARCH_PROVIDER_ORDER` or `providerOrder` in `websearch.json` to override provider order.
- If no search provider keys are present, the extension falls back to `duckduckgo-html`.
- Pass `provider` to `web_search` to force one enabled provider by provider name or configured id.
- Use `web_search_status` or `/websearch status` to show enabled providers without exposing keys.

Config resolution:

1. `provider` argument on a `web_search` call selects one enabled provider.
2. The first JSON config found is loaded: project `.pi/websearch.json`, then `~/websearch.json`, then `~/.pi/websearch.json`.
3. Environment variables override matching JSON keys and `WEB_SEARCH_PROVIDER_ORDER` overrides JSON `providerOrder`.
4. JSON can still supply non-secret settings such as ids, max results, weights, and domain filters.
5. If no configured provider has credentials, the built-in DuckDuckGo HTML fallback is used.

## Recommended setup

- Use Parallel first for agent-oriented search results with compressed excerpts and a large starter credit.
- Use Serper second as a Google SERP fallback with simple setup and good free quota.
- Use Brave third as an independent-index fallback with monthly credits.
- Add Tavily or Exa when another quota pool or semantic search behavior is useful.
- Keep DuckDuckGo HTML as the no-key fallback only.

Recommended env order:

```env
WEB_SEARCH_PROVIDER_ORDER=parallel,serper,brave,tavily,exa
```

## Environment keys

- `WEB_SEARCH_PROVIDER_ORDER`
- `SERPER_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `PARALLEL_API_KEY`
- `TAVILY_API_KEY`
- `EXA_API_KEY`
- `PERPLEXITY_API_KEY`
- `GOOGLE_CSE_API_KEY` plus `GOOGLE_CSE_ID` or `GOOGLE_SEARCH_ENGINE_ID`

## JSON config

Environment variables are enough for normal use. If you need per-provider ids, custom base URLs, weights, or domain filters, create `.pi/websearch.json`, `~/websearch.json`, or `~/.pi/websearch.json`.

Keep secrets in env when possible. JSON `apiKey` values still work as a fallback when the matching env key is not set.

See `examples/websearch.json` for a minimal provider list. Providers named only in `providerOrder` can still be enabled through env keys.

## Later work

- Random or round-robin provider routing.
- Cooldown/exhaustion tracking for quota, billing, auth, and rate-limit failures.

## Credits

This package is based on [`code-yeongyu/pi-websearch`](https://github.com/code-yeongyu/pi-websearch).
