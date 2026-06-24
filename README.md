# pi-web-search

Free web search for Pi agents — roughly 40,000 searches/month across five free provider quotas.

Pi gets a `web_search` tool. It tries configured providers in order; if one fails or hits a limit, the next one takes over.

Free quotas:

- Parallel — ~16,000 requests
- Exa — 20,000 requests/month
- Serper — 2,500 queries
- Brave — ~1,000 searches/month
- Tavily — 1,000 API credits/month

## Quick start

1. Install:

   ```bash
   pi install git:github.com/syabro/pi-web-search
   ```

2. Register free accounts:

   - Parallel — https://platform.parallel.ai/settings?tab=api-keys
   - Serper — https://serper.dev/
   - Brave — https://api-dashboard.search.brave.com/app/plans
   - Tavily — https://app.tavily.com/
   - Exa — https://dashboard.exa.ai/api-keys

3. Export the keys in the environment that starts Pi.

   Use `.env.default` for the exact variable names.

4. Restart Pi and verify:

   ```text
   /websearch status
   ```

5. Search:

   ```text
   web_search(query="latest Bun release notes")
   web_search(query="something specific", provider="parallel")
   ```

## Provider order and fallback

Set provider order when you want a specific route:

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

## Optional providers

These are supported, but are not part of the main free five-provider setup:

- Google CSE
- Perplexity
- OpenAI, Anthropic, xAI, Kimi, Z.AI, Codex through JSON config

See `.env.default` and `examples/websearch.json` for details.

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

Rules:

- Project `.pi/websearch.json` is checked before `~/.pi/websearch.json`.
- The first JSON config file found is used; files are not merged.
- Env credentials take precedence over matching JSON credentials.
- `WEB_SEARCH_PROVIDER_ORDER` overrides JSON `providerOrder`.

## Local development

```bash
git clone https://github.com/syabro/pi-web-search.git
pi install /absolute/path/to/pi-web-search
```

## Credits

Based on [code-yeongyu/pi-websearch](https://github.com/code-yeongyu/pi-websearch).

MIT license.
