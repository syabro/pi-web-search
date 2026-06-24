<p align="center">
  <img src="./assets/hero.png" alt="Free web search for Pi agents" />
</p>

# pi-web-search

Free web search for Pi agents — roughly 40,000 searches/month across five free provider quotas.

Pi gets a `web_search` tool. It tries configured providers in order; if one fails or hits a limit, the next one takes over.

Free quotas:

- Parallel — ~16,000 requests
- Exa — 20,000 requests/month
- Serper — 2,500 queries
- Brave — ~1,000 searches/month
- Tavily — 1,000 searches/month

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

5. Ask Pi questions that need current web data.

   Examples:

   ```text
   Search the web for the latest Bun release notes.
   Search the web for current GLM 5.2 benchmarks.
   ```

   Pi will call `web_search` when it needs fresh sources.

## Provider order and fallback

Set provider order when you want a specific route:

```bash
export WEB_SEARCH_PROVIDER_ORDER="parallel,serper,brave,tavily,exa"
```

Without `WEB_SEARCH_PROVIDER_ORDER` or JSON `providerOrder`, env-configured providers are recognized in this order:

```text
serper → brave → parallel → tavily → exa → perplexity → google-cse
```

To force a provider, ask Pi to use one enabled provider by name, for example Serper or Parallel.

## Optional providers

Extra supported providers:

- Google CSE
- Perplexity
- OpenAI, Anthropic, xAI, Kimi, Z.AI, Codex through JSON config

See `.env.default` and `examples/websearch.json` for details.

## Advanced config

Normal setup uses env vars. For custom limits, domain filters, custom base URLs, model settings, or JSON-only providers, use `.pi/websearch.json` or `~/.pi/websearch.json`.

See `examples/websearch.json`.

## Local development

```bash
git clone https://github.com/syabro/pi-web-search.git
pi install /absolute/path/to/pi-web-search
```

## Credits

Based on [code-yeongyu/pi-websearch](https://github.com/code-yeongyu/pi-websearch).

MIT license.
