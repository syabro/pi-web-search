import { DynamicBorder, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container, matchesKey, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import { loadWebsearchConfig, SEARCH_PROVIDERS } from "./websearch/config.ts";
import { createSearchRoutingState, formatSearchText, performSearch, type SearchRoutingState } from "./websearch/search.ts";
import type { SearchErrorDetails, SearchProgressDetails, SearchRenderDetails, SearchProviderEntry } from "./websearch/types.ts";

const Params = Type.Object(
	{
		query: Type.String({ minLength: 2, description: "The search query to use" }),
		allowed_domains: Type.Optional(Type.Array(Type.String(), { description: "Only include search results from these domains" })),
		blocked_domains: Type.Optional(Type.Array(Type.String(), { description: "Never include search results from these domains" })),
	},
	{ additionalProperties: false },
);

const StatusParams = Type.Object({}, { additionalProperties: false });

type WebSearchParams = {
	query: string;
	allowed_domains?: string[];
	blocked_domains?: string[];
};

type ToolContext = { cwd?: string };

type ProviderStatusRow = {
	provider: string;
	name: string;
	state: "Enabled" | "Disabled";
	configuration: string;
};

type ProviderStatusDetails = {
	phase: "status";
	source?: string;
	strategy?: string;
	fallback?: boolean;
	auto?: boolean;
	providerCount?: number;
	providers?: Array<{
		label: string;
		provider: string;
		id?: string;
		maxResults?: number;
		model?: string;
		hasCustomBaseUrl: boolean;
		hasSearchEngineId: boolean;
	}>;
	disabledProviders?: string[];
	rows?: ProviderStatusRow[];
	error?: string;
	reason?: string;
};

const STATUS_PROVIDER_ORDER = ["serper", "brave", "tavily", "exa", "perplexity", "google-cse", "duckduckgo-html", "z-ai", "openai", "codex", "anthropic", "xai", "kimi"] as const;

const PROVIDER_NAMES: Record<string, string> = {
	serper: "Serper",
	brave: "Brave",
	tavily: "Tavily",
	exa: "Exa",
	perplexity: "Perplexity",
	"google-cse": "Google CSE",
	"duckduckgo-html": "DuckDuckGo HTML",
	"z-ai": "Z.AI",
	openai: "OpenAI",
	codex: "Codex",
	anthropic: "Anthropic",
	xai: "xAI",
	kimi: "Kimi",
};

const ENABLE_REQUIREMENTS: Record<string, string> = {
	serper: "SERPER_API_KEY",
	brave: "BRAVE_SEARCH_API_KEY or BRAVE_API_KEY",
	tavily: "TAVILY_API_KEY",
	exa: "EXA_API_KEY",
	perplexity: "PERPLEXITY_API_KEY",
	"google-cse": "GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID or GOOGLE_SEARCH_ENGINE_ID",
	"duckduckgo-html": "No key; fallback when no env providers are enabled",
	"z-ai": "websearch.json provider with apiKey",
	openai: "websearch.json provider with apiKey",
	codex: "websearch.json provider with apiKey",
	anthropic: "websearch.json provider with apiKey",
	xai: "websearch.json provider with apiKey",
	kimi: "websearch.json provider with apiKey",
};

const ENV_CONFIGURATIONS: Record<string, string> = {
	serper: "SERPER_API_KEY",
	brave: "BRAVE_SEARCH_API_KEY or BRAVE_API_KEY",
	tavily: "TAVILY_API_KEY",
	exa: "EXA_API_KEY",
	perplexity: "PERPLEXITY_API_KEY",
	"google-cse": "GOOGLE_CSE_API_KEY and search engine id",
	"duckduckgo-html": "fallback without an API key",
};

function providerName(provider: string): string {
	return PROVIDER_NAMES[provider] ?? provider;
}

function enableRequirement(provider: string): string {
	return ENABLE_REQUIREMENTS[provider] ?? "websearch.json provider entry";
}

function enabledConfiguration(provider: string, source: string): string {
	if (source === "env") return ENV_CONFIGURATIONS[provider] ?? "environment";
	return source;
}

function providerLabel(provider: SearchProviderEntry): string {
	return provider.id ? `${provider.id}/${provider.provider}` : provider.provider;
}

function formatSearchProgressText(details: SearchProgressDetails): string {
	const route = details.providerLabels.length > 0 ? details.providerLabels.join(" -> ") : "configured providers";
	return `Searching "${details.query}" via ${route} (max ${details.maxResults})`;
}

function searchErrorDetails(query: string, error: string, reason?: SearchErrorDetails["reason"]): SearchErrorDetails {
	return { phase: "error", query, error, ...(reason ? { reason } : {}) };
}

function markdownTable(rows: ProviderStatusRow[], state: ProviderStatusRow["state"]): string[] {
	const filtered = rows.filter((row) => row.state === state);
	return filtered.length
		? ["| Provider | Configuration |", "|---|---|", ...filtered.map((row) => `| ${row.name} | ${row.configuration} |`)]
		: ["none"];
}

function formatMarkdownStatus(rows: ProviderStatusRow[]): string {
	return ["**Enabled**", "", ...markdownTable(rows, "Enabled"), "", "**Disabled**", "", ...markdownTable(rows, "Disabled")].join("\n");
}

function formatPlainStatus(rows: ProviderStatusRow[]): string {
	return rows.map((row) => `${row.state}\t${row.name}\t${row.configuration}`).join("\n");
}

function renderTextTable(rows: ProviderStatusRow[], state: ProviderStatusRow["state"], theme: any): string[] {
	const filtered = rows.filter((row) => row.state === state);
	if (filtered.length === 0) return [state === "Disabled" ? theme.fg("muted", "none") : "none"];
	const providerWidth = Math.max("Provider".length, ...filtered.map((row) => row.name.length));
	const configWidth = Math.max("Configuration".length, ...filtered.map((row) => row.configuration.length));
	const pad = (value: string, width: number) => value.padEnd(width, " ");
	const header = `${pad("Provider", providerWidth)}  ${pad("Configuration", configWidth)}`;
	const divider = `${"─".repeat(providerWidth)}  ${"─".repeat(configWidth)}`;
	const lines = [header, divider, ...filtered.map((row) => `${pad(row.name, providerWidth)}  ${pad(row.configuration, configWidth)}`)];
	return state === "Disabled" ? lines.map((line) => theme.fg("muted", line)) : lines;
}

async function showProviderStatus(status: { text: string; details: ProviderStatusDetails }, ctx: any): Promise<void> {
	const rows = status.details.rows ?? [];
	if (ctx.mode !== "tui") {
		ctx.ui.notify(formatPlainStatus(rows), status.details.error ? "error" : "info");
		return;
	}

	await ctx.ui.custom((_tui: unknown, theme: any, _kb: unknown, done: (value: undefined) => void) => {
		const container = new Container();
		const border = new DynamicBorder((text: string) => theme.fg("accent", text));

		container.addChild(border);
		container.addChild(new Text(theme.fg("success", theme.bold("Enabled")), 1, 1));
		container.addChild(new Text(renderTextTable(rows, "Enabled", theme).join("\n"), 1, 0));
		container.addChild(new Text(theme.fg("muted", theme.bold("Disabled")), 1, 1));
		container.addChild(new Text(renderTextTable(rows, "Disabled", theme).join("\n"), 1, 0));
		container.addChild(new Text(theme.fg("dim", "Press Enter or Esc to close"), 1, 1));
		container.addChild(border);

		return {
			render: (width: number) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data: string) => {
				if (matchesKey(data, "enter") || matchesKey(data, "escape")) done(undefined);
			},
		};
	});
}

async function loadProviderStatus(cwd: string): Promise<{ text: string; details: ProviderStatusDetails }> {
	const loaded = await loadWebsearchConfig({ cwd });
	if (!loaded.ok) {
		const rows: ProviderStatusRow[] = STATUS_PROVIDER_ORDER.map((provider) => ({
			provider,
			name: providerName(provider),
			state: "Disabled",
			configuration: enableRequirement(provider),
		}));
		return {
			text: formatMarkdownStatus(rows),
			details: { phase: "status", source: loaded.source, error: loaded.message, reason: loaded.reason, disabledProviders: [...SEARCH_PROVIDERS], rows },
		};
	}

	const providers = loaded.config.providers.map((provider) => ({
		label: providerLabel(provider),
		provider: provider.provider,
		...(provider.id ? { id: provider.id } : {}),
		...(provider.maxResults !== undefined ? { maxResults: provider.maxResults } : {}),
		...(provider.model ? { model: provider.model } : {}),
		hasCustomBaseUrl: Boolean(provider.baseUrl),
		hasSearchEngineId: Boolean(provider.searchEngineId),
	}));
	const enabledProviderNames = new Set(providers.map((provider) => provider.provider));
	const enabledRows: ProviderStatusRow[] = providers.map((provider) => ({
		provider: provider.provider,
		name: providerName(provider.provider),
		state: "Enabled",
		configuration: enabledConfiguration(provider.provider, loaded.source),
	}));
	const disabledProviders = STATUS_PROVIDER_ORDER.filter((provider) => !enabledProviderNames.has(provider));
	const disabledRows: ProviderStatusRow[] = disabledProviders.map((provider) => ({
		provider,
		name: providerName(provider),
		state: "Disabled",
		configuration: enableRequirement(provider),
	}));
	const rows = [...enabledRows, ...disabledRows];

	return {
		text: formatMarkdownStatus(rows),
		details: {
			phase: "status",
			source: loaded.source,
			strategy: loaded.config.strategy,
			fallback: loaded.config.fallback,
			auto: loaded.config.auto,
			providerCount: providers.length,
			providers,
			disabledProviders,
			rows,
		},
	};
}

export default function webSearchExtension(pi: ExtensionAPI): void {
	let routingState: SearchRoutingState | undefined;
	let routingKey = "";

	pi.registerTool({
		name: "web_search_status",
		label: "Show Search Providers",
		description: "Show which web_search providers are enabled and disabled without exposing API keys.",
		promptSnippet: "Show enabled and disabled web_search providers without exposing API keys.",
		promptGuidelines: ["Use web_search_status to inspect configured web_search providers; do not read secret files to check provider keys."],
		parameters: StatusParams,
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx?: ToolContext) {
			const status = await loadProviderStatus(ctx?.cwd ?? process.cwd());
			return { content: [{ type: "text", text: status.text }], details: status.details };
		},
	});

	pi.registerCommand("websearch", {
		description: "Show web search provider status",
		handler: async (rawArgs, ctx) => {
			const args = rawArgs.trim();
			if (args !== "" && args !== "status" && args !== "providers") {
				ctx.ui.notify("Usage: /websearch status", "warning");
				return;
			}
			const status = await loadProviderStatus(ctx.cwd);
			await showProviderStatus(status, ctx);
		},
	});

	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description: "Search the web for current information and return source URLs for citation.",
		promptSnippet: "Search the web for current information, documentation, news, or external facts.",
		promptGuidelines: ["After using web_search, cite relevant returned URLs in the final answer."],
		parameters: Params,
		prepareArguments(args): WebSearchParams {
			if (!args || typeof args !== "object") return args as WebSearchParams;
			const input = args as Record<string, unknown>;
			if (typeof input.q === "string" && input.query === undefined) return { ...input, query: input.q } as WebSearchParams;
			return args as WebSearchParams;
		},
		async execute(_toolCallId, params: WebSearchParams, signal, onUpdate, ctx?: ToolContext) {
			if (params.allowed_domains?.length && params.blocked_domains?.length) {
				const message = "Error: Cannot specify both allowed_domains and blocked_domains in the same request";
				const details = searchErrorDetails(params.query, message);
				return { content: [{ type: "text", text: message }], details };
			}

			const loaded = await loadWebsearchConfig({ cwd: ctx?.cwd ?? process.cwd() });
			if (!loaded.ok) {
				const details = searchErrorDetails(params.query, loaded.message, loaded.reason);
				return { content: [{ type: "text", text: loaded.message }], details };
			}

			const config = loaded.config;
			const maxResults = config.providers[0]?.maxResults ?? 10;
			const progressDetails: SearchProgressDetails = {
				phase: "searching",
				query: params.query,
				providerLabels: config.providers.map(providerLabel),
				maxResults,
				strategy: config.strategy,
				...(params.allowed_domains ? { allowedDomains: params.allowed_domains } : {}),
				...(params.blocked_domains ? { blockedDomains: params.blocked_domains } : {}),
			};
			onUpdate?.({ content: [{ type: "text", text: formatSearchProgressText(progressDetails) }], details: progressDetails });

			const nextRoutingKey = `${config.strategy}:${config.providers.map((provider) => provider.id ?? provider.provider).join("|")}`;
			if (!routingState || routingKey !== nextRoutingKey || routingState.successCounts.length !== config.providers.length) {
				routingState = createSearchRoutingState(config.providers.length);
				routingKey = nextRoutingKey;
			}

			const details = await performSearch(
				config,
				{
					query: params.query,
					maxResults,
					...(params.allowed_domains === undefined ? {} : { allowedDomains: params.allowed_domains }),
					...(params.blocked_domains === undefined ? {} : { blockedDomains: params.blocked_domains }),
				},
				signal,
				routingState,
			);

			return { content: [{ type: "text", text: formatSearchText(details) }], details: details as SearchRenderDetails };
		},
	});
}
