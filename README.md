# Pi web_search

Local workspace for the Pi `web_search` tool.

- `src/` — source for the global Pi `web_search` extension.
- `package.json` — Pi package entry with `pi.extensions: ["./src/index.ts"]`.
- `/Users/syabro/.pi/agent/settings.json` — loads this project through `packages`.
- `upstream/websearch/` — copied websearch implementation from `code-yeongyu/senpi` for reference and porting.

Runtime defaults:

- keys are read from environment variables, no JSON config is required;
- configured env providers run in priority order with fallback enabled;
- if no search provider keys are present, the extension falls back to `duckduckgo-html`;
- pass `provider` to `web_search` to force one enabled provider by provider name or configured id;
- use `web_search_status` or `/websearch status` to show enabled providers without exposing keys.

Supported env keys:

- `SERPER_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `TAVILY_API_KEY`
- `EXA_API_KEY`
- `PERPLEXITY_API_KEY`
- `GOOGLE_CSE_API_KEY` plus `GOOGLE_CSE_ID` or `GOOGLE_SEARCH_ENGINE_ID`

Later work:

- random or round-robin provider routing;
- cooldown/exhaustion tracking for quota, billing, auth, and rate-limit failures.
