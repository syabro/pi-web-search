import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { loadWebsearchConfig } from "./websearch/config.ts";
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

type WebSearchParams = {
	query: string;
	allowed_domains?: string[];
	blocked_domains?: string[];
};

type ToolContext = { cwd?: string };

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

export default function webSearchExtension(pi: ExtensionAPI): void {
	let routingState: SearchRoutingState | undefined;
	let routingKey = "";

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
