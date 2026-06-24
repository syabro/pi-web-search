# pi-web-search

Pi extension that adds `web_search` and `web_search_status`.

Pi agents often need current web data, but reliable search is not always available out of the box. This package adds provider-backed web search to Pi in a few minutes. Start with one free/starter provider key, add more later, and keep search working through fallback routing.

If no provider keys are configured, pi-web-search falls back to DuckDuckGo HTML.

## Quick start

```bash
git clone https://github.com/syabro/pi-web-search.git
cd pi-web-search
bun install
```

Export at least one provider key:

```bash
export WEB_SEARCH_PARALLEL_API_KEY="your_key"
```

Add the extension to Pi settings:

```json
{
  "packages": ["/absolute/path/to/pi-web-search"]
}
```

Restart Pi, then verify:

```text
/websearch status
```

Example use:

```text
web_search(query="latest Bun release notes")
web_search(query="Parallel Search API quickstart", provider="parallel")
```

The extension reads the process environment at startup. It does not load `.env` files by itself. Use `.env.default` as a reference for provider keys and free-tier notes.

## Providers

| Provider | Env var | Sign up |
|---|---|---|
| Parallel | `WEB_SEARCH_PARALLEL_API_KEY` | https://platform.parallel.ai/settings?tab=api-keys |
| Serper | `WEB_SEARCH_SERPER_API_KEY` | https://serper.dev/ |
| Brave | `WEB_SEARCH_BRAVE_SEARCH_API_KEY` | https://api-dashboard.search.brave.com/app/plans |
| Tavily | `WEB_SEARCH_TAVILY_API_KEY` | https://app.tavily.com/ |
| Exa | `WEB_SEARCH_EXA_API_KEY` | https://dashboard.exa.ai/api-keys |
| Perplexity | `WEB_SEARCH_PERPLEXITY_API_KEY` | https://www.perplexity.ai/settings/api |
| Google CSE | `WEB_SEARCH_GOOGLE_CSE_API_KEY` + `WEB_SEARCH_GOOGLE_CSE_ID` or `WEB_SEARCH_GOOGLE_SEARCH_ENGINE_ID` | https://developers.google.com/custom-search/v1/overview |

Also supported through JSON config: OpenAI, Anthropic, xAI, Kimi, Z.AI, Codex.

## Provider order and fallback

Set provider order explicitly:

```bash
export WEB_SEARCH_PROVIDER_ORDER="parallel,serper,brave,tavily,exa"
```

Without `WEB_SEARCH_PROVIDER_ORDER` or JSON `providerOrder`, env-configured providers are recognized in this order:

```text
serper → brave → parallel → tavily → exa → perplexity → google-cse
```

Pass `provider` to force one enabled provider by name or configured id:

```text
web_search(query="some query", provider="serper")
```

If a provider fails and fallback is enabled, pi-web-search tries the next configured provider. If no provider has usable credentials, it uses DuckDuckGo HTML.

## Advanced JSON config

Most users only need env vars. Use JSON for ids, max results, domain filters, custom base URLs, models, weights, or provider order.

Create `.pi/websearch.json` in the project or `~/.pi/websearch.json` in your home directory:

```json
{
  "strategy": "priority",
  "fallback": true,
  "providerOrder": ["parallel", "serper", "brave"],
  "providers": [
    { "id": "parallel-main", "provider": "parallel", "maxResults": 10 },
    { "id": "serper-fallback", "provider": "serper", "maxResults": 10 },
    { "id": "brave-fallback", "provider": "brave", "maxResults": 10 }
  ]
}
```

Config rules:

- Project `.pi/websearch.json` is checked before `~/.pi/websearch.json`.
- The first JSON config file found is used; files are not merged.
- Env credentials take precedence over matching JSON credentials.
- `WEB_SEARCH_PROVIDER_ORDER` overrides JSON `providerOrder`.
- JSON can still provide non-secret provider settings.
- Restart Pi after changing environment variables.

## Credits

Based on [code-yeongyu/pi-websearch](https://github.com/code-yeongyu/pi-websearch).

MIT license.
