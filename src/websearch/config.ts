import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { isAllowedProviderBaseUrl } from "./provider-endpoints.ts";
import type {
	CodexSearchMode,
	ConfigLoadResult,
	JsonObject,
	JsonValue,
	ProviderValidationResult,
	RoutingStrategy,
	SearchContextSize,
	SearchProvider,
	SearchProviderConfig,
	SearchProviderEntry,
	SearchUserLocation,
	WebsearchConfig,
} from "./types.ts";

export const SEARCH_PROVIDERS: readonly SearchProvider[] = [
	"exa",
	"tavily",
	"brave",
	"duckduckgo-html",
	"serper",
	"parallel",
	"google-cse",
	"z-ai",
	"openai",
	"codex",
	"anthropic",
	"perplexity",
	"xai",
	"kimi",
];
const CONTEXT_SIZES: readonly SearchContextSize[] = ["low", "medium", "high"];
const CODEX_MODES: readonly CodexSearchMode[] = ["cached", "live"];
const STRATEGIES: readonly RoutingStrategy[] = ["priority", "round-robin", "fill-first"];
const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_FREE_CONFIG: WebsearchConfig = {
	strategy: "priority",
	fallback: true,
	auto: false,
	providers: [{ id: "default", provider: "duckduckgo-html", maxResults: DEFAULT_MAX_RESULTS }],
};

type Environment = Record<string, string | undefined>;

export interface ConfigLoadOptions {
	cwd: string;
	homeDir?: string;
	env?: Environment;
}

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<TValue extends string>(values: readonly TValue[], value: unknown): value is TValue {
	return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isStringArray(value: JsonValue | undefined): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function optionalString(value: JsonValue | undefined): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalNumber(value: JsonValue | undefined): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalBoolean(value: JsonValue | undefined): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}

function optionalProvider(value: JsonValue | undefined): SearchProvider | undefined {
	return oneOf(SEARCH_PROVIDERS, value) ? value : undefined;
}

function optionalContextSize(value: JsonValue | undefined): SearchContextSize | undefined {
	return oneOf(CONTEXT_SIZES, value) ? value : undefined;
}

function optionalCodexMode(value: JsonValue | undefined): CodexSearchMode | undefined {
	return oneOf(CODEX_MODES, value) ? value : undefined;
}

function optionalStrategy(value: JsonValue | undefined): RoutingStrategy | undefined {
	return oneOf(STRATEGIES, value) ? value : undefined;
}

function optionalLocation(value: JsonValue | undefined): SearchUserLocation | undefined {
	if (!isJsonObject(value)) return undefined;
	const location: SearchUserLocation = {};
	const country = optionalString(value.country);
	const region = optionalString(value.region);
	const city = optionalString(value.city);
	const timezone = optionalString(value.timezone);
	if (country) location.country = country;
	if (region) location.region = region;
	if (city) location.city = city;
	if (timezone) location.timezone = timezone;
	return Object.keys(location).length > 0 ? location : undefined;
}

function normalizedProviderOrder(values: readonly string[]): string[] | undefined {
	const order: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		const trimmed = value.trim();
		const normalized = trimmed.toLowerCase();
		if (!trimmed || seen.has(normalized)) continue;
		seen.add(normalized);
		order.push(trimmed);
	}
	return order.length > 0 ? order : undefined;
}

function optionalProviderOrder(value: JsonValue | undefined): string[] | undefined {
	return isStringArray(value) ? normalizedProviderOrder(value) : undefined;
}

function parseProviderOrder(value: string | undefined): string[] | undefined {
	if (!value) return undefined;
	return normalizedProviderOrder(value.split(","));
}

function matchesProviderOrder(provider: SearchProviderEntry, selector: string): boolean {
	const normalized = selector.trim().toLowerCase();
	return provider.provider.toLowerCase() === normalized || provider.id?.toLowerCase() === normalized;
}

function applyProviderOrder(providers: SearchProviderEntry[], providerOrder?: readonly string[]): SearchProviderEntry[] {
	if (!providerOrder?.length) return providers;
	const remaining = [...providers];
	const ordered: SearchProviderEntry[] = [];
	for (const selector of providerOrder) {
		const index = remaining.findIndex((provider) => matchesProviderOrder(provider, selector));
		if (index >= 0) ordered.push(...remaining.splice(index, 1));
	}
	return [...ordered, ...remaining];
}

function parseJsonObject(content: string): JsonObject | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		return null;
	}
	return isJsonObject(parsed) ? parsed : null;
}

function providerEntryFromObject(raw: JsonObject): SearchProviderEntry | null {
	const provider = optionalProvider(raw.provider) ?? optionalProvider(raw.backend);
	if (!provider) return null;

	const config: SearchProviderEntry = { provider };
	const id = optionalString(raw.id);
	const apiKey = optionalString(raw.apiKey);
	const baseUrl = optionalString(raw.baseUrl);
	const searchEngineId = optionalString(raw.searchEngineId);
	const maxResults = optionalNumber(raw.maxResults);
	const model = optionalString(raw.model);
	const codexMode = optionalCodexMode(raw.codexMode);
	const searchContextSize = optionalContextSize(raw.searchContextSize);
	const rawAllowedDomains = raw.allowedDomains;
	const rawBlockedDomains = raw.blockedDomains;
	const allowedDomains = isStringArray(rawAllowedDomains) ? rawAllowedDomains : undefined;
	const blockedDomains = isStringArray(rawBlockedDomains) ? rawBlockedDomains : undefined;
	const userLocation = optionalLocation(raw.userLocation);
	const priority = optionalNumber(raw.priority);
	const weight = optionalNumber(raw.weight);

	if (id) config.id = id;
	if (apiKey) config.apiKey = apiKey;
	if (baseUrl) config.baseUrl = baseUrl;
	if (searchEngineId) config.searchEngineId = searchEngineId;
	if (maxResults) config.maxResults = maxResults;
	if (model) config.model = model;
	if (codexMode) config.codexMode = codexMode;
	if (searchContextSize) config.searchContextSize = searchContextSize;
	if (allowedDomains) config.allowedDomains = allowedDomains;
	if (blockedDomains) config.blockedDomains = blockedDomains;
	if (userLocation) config.userLocation = userLocation;
	if (priority !== undefined) config.priority = priority;
	if (weight !== undefined) config.weight = weight;

	return config;
}

function configFromObject(raw: JsonObject): WebsearchConfig | null {
	const auto = optionalBoolean(raw.auto) ?? true;
	const strategy = optionalStrategy(raw.strategy) ?? "priority";
	const fallback = optionalBoolean(raw.fallback) ?? true;
	const providerOrder = optionalProviderOrder(raw.providerOrder);
	const providersValue = raw.providers;
	const rawProviders = Array.isArray(providersValue) ? providersValue : undefined;
	if (rawProviders) {
		if (optionalProvider(raw.provider)) return null;
		const providers = rawProviders
			.map((value) => (isJsonObject(value) ? providerEntryFromObject(value) : null))
			.filter((entry): entry is SearchProviderEntry => entry !== null);
		const orderedProviders = applyProviderOrder(providers, providerOrder);
		return { strategy, fallback, auto, providers: orderedProviders, ...(providerOrder ? { providerOrder } : {}) };
	}

	const provider = providerEntryFromObject(raw);
	if (provider) return { strategy, fallback, auto, providers: [provider], ...(providerOrder ? { providerOrder } : {}) };
	if (providerOrder || raw.strategy !== undefined || raw.fallback !== undefined || raw.auto !== undefined) {
		return { strategy, fallback, auto, providers: [], ...(providerOrder ? { providerOrder } : {}) };
	}
	return null;
}

function hasApiKey(config: SearchProviderConfig): boolean {
	return typeof config.apiKey === "string" && config.apiKey.length > 0;
}

function envValue(env: Environment, names: readonly string[]): string | undefined {
	for (const name of names) {
		const value = env[name]?.trim();
		if (value) return value;
	}
	return undefined;
}

function envProvider(id: string, provider: SearchProvider, apiKey: string): SearchProviderEntry {
	return { id, provider, apiKey, maxResults: DEFAULT_MAX_RESULTS };
}

interface EnvironmentConfigParts {
	providers: SearchProviderEntry[];
	providerOrder?: string[];
}

function environmentConfigParts(env: Environment): EnvironmentConfigParts {
	const providers: SearchProviderEntry[] = [];
	const providerOrder = parseProviderOrder(envValue(env, ["WEB_SEARCH_PROVIDER_ORDER"]));
	const serperKey = envValue(env, ["WEB_SEARCH_SERPER_API_KEY"]);
	const braveKey = envValue(env, ["WEB_SEARCH_BRAVE_SEARCH_API_KEY"]);
	const tavilyKey = envValue(env, ["WEB_SEARCH_TAVILY_API_KEY"]);
	const parallelKey = envValue(env, ["WEB_SEARCH_PARALLEL_API_KEY"]);
	const exaKey = envValue(env, ["WEB_SEARCH_EXA_API_KEY"]);
	const perplexityKey = envValue(env, ["WEB_SEARCH_PERPLEXITY_API_KEY"]);
	const googleCseKey = envValue(env, ["WEB_SEARCH_GOOGLE_CSE_API_KEY"]);
	const googleCseId = envValue(env, ["WEB_SEARCH_GOOGLE_CSE_ID", "WEB_SEARCH_GOOGLE_SEARCH_ENGINE_ID"]);

	if (serperKey) providers.push(envProvider("serper-env", "serper", serperKey));
	if (braveKey) providers.push(envProvider("brave-env", "brave", braveKey));
	if (parallelKey) providers.push(envProvider("parallel-env", "parallel", parallelKey));
	if (tavilyKey) providers.push(envProvider("tavily-env", "tavily", tavilyKey));
	if (exaKey) providers.push(envProvider("exa-env", "exa", exaKey));
	if (perplexityKey) providers.push(envProvider("perplexity-env", "perplexity", perplexityKey));
	if (googleCseKey && googleCseId) {
		providers.push({ id: "google-cse-env", provider: "google-cse", apiKey: googleCseKey, searchEngineId: googleCseId, maxResults: DEFAULT_MAX_RESULTS });
	}

	return { providers, ...(providerOrder ? { providerOrder } : {}) };
}

function configFromEnvironmentParts(parts: EnvironmentConfigParts): { config: WebsearchConfig; source: string } {
	if (parts.providers.length === 0) return { config: DEFAULT_FREE_CONFIG, source: "default:duckduckgo-html" };
	const orderedProviders = applyProviderOrder(parts.providers, parts.providerOrder);
	return { config: { strategy: "priority", fallback: true, auto: false, providers: orderedProviders, ...(parts.providerOrder ? { providerOrder: parts.providerOrder } : {}) }, source: "env" };
}

function mergeEnvProvider(envProvider: SearchProviderEntry, jsonProviders: SearchProviderEntry[]): SearchProviderEntry {
	const settings = jsonProviders.find((provider) => provider.provider === envProvider.provider);
	if (!settings) return envProvider;
	const merged = { ...settings, ...envProvider };
	if (settings.id) merged.id = settings.id;
	if (settings.maxResults !== undefined) merged.maxResults = settings.maxResults;
	return merged;
}

function providerHasInlineCredential(provider: SearchProviderEntry): boolean {
	return provider.provider === "duckduckgo-html" || hasApiKey(provider);
}

function mergeConfigWithEnvironment(config: WebsearchConfig, envParts: EnvironmentConfigParts): WebsearchConfig {
	const envProviderNames = new Set(envParts.providers.map((provider) => provider.provider));
	const envProviders = envParts.providers.map((provider) => mergeEnvProvider(provider, config.providers));
	const jsonProviders = config.providers.filter((provider) => !envProviderNames.has(provider.provider) && providerHasInlineCredential(provider));
	const providerOrder = envParts.providerOrder ?? config.providerOrder;
	const providers = applyProviderOrder([...envProviders, ...jsonProviders], providerOrder);
	if (providers.length === 0) {
		const fallbackProviders = applyProviderOrder(DEFAULT_FREE_CONFIG.providers, providerOrder);
		return { ...config, providers: fallbackProviders, ...(providerOrder ? { providerOrder } : {}) };
	}
	return { ...config, providers, ...(providerOrder ? { providerOrder } : {}) };
}

export function validateProviderConfig(config: SearchProviderEntry): ProviderValidationResult {
	if (!SEARCH_PROVIDERS.includes(config.provider)) {
		return { ok: false, reason: "invalid_config", message: `Unsupported provider: ${config.provider}` };
	}

	if (config.allowedDomains && config.blockedDomains) {
		return {
			ok: false,
			reason: "invalid_config",
			message: "Provider config cannot specify both allowedDomains and blockedDomains.",
		};
	}

	if (config.weight !== undefined && config.weight <= 0) {
		return { ok: false, reason: "invalid_config", message: "Provider weight must be greater than 0." };
	}

	if (config.baseUrl && !isAllowedProviderBaseUrl(config.baseUrl)) {
		return {
			ok: false,
			reason: "invalid_config",
			message: `Provider ${config.provider} baseUrl must be a public HTTPS URL without credentials.`,
		};
	}

	if (config.provider === "google-cse" && !config.searchEngineId) {
		return { ok: false, reason: "missing_api_key", message: "Provider google-cse requires searchEngineId." };
	}

	if ((config.provider === "codex" || config.provider === "openai") && !hasApiKey(config)) {
		return {
			ok: false,
			reason: "missing_api_key",
			message: `Provider ${config.provider} requires apiKey for hosted Responses API search.`,
		};
	}

	if (
		config.provider !== "codex" &&
		config.provider !== "openai" &&
		config.provider !== "duckduckgo-html" &&
		!hasApiKey(config)
	) {
		return { ok: false, reason: "missing_api_key", message: `Provider ${config.provider} requires apiKey.` };
	}

	return { ok: true, config };
}

export function validateWebsearchConfig(
	config: WebsearchConfig,
): ProviderValidationResult | { ok: true; config: WebsearchConfig } {
	if (!STRATEGIES.includes(config.strategy)) {
		return { ok: false, reason: "invalid_config", message: `Unsupported routing strategy: ${config.strategy}` };
	}
	if (typeof config.auto !== "boolean") {
		return { ok: false, reason: "invalid_config", message: "Websearch config auto must be a boolean." };
	}
	if (config.providers.length === 0) {
		return { ok: false, reason: "invalid_config", message: "Websearch config requires at least one provider." };
	}

	for (const provider of config.providers) {
		const validation = validateProviderConfig(provider);
		if (!validation.ok) return validation;
	}

	return { ok: true, config };
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export async function loadWebsearchConfig(options: ConfigLoadOptions): Promise<ConfigLoadResult> {
	const home = options.homeDir ?? homedir();
	const envParts = environmentConfigParts(options.env ?? process.env);
	const paths = [
		join(options.cwd, ".pi", "websearch.json"),
		join(home, "websearch.json"),
		join(home, ".pi", "websearch.json"),
	];

	for (const path of paths) {
		if (!(await fileExists(path))) continue;
		const raw = parseJsonObject(await readFile(path, "utf8"));
		if (!raw) {
			return { ok: false, reason: "invalid_config", message: `Invalid JSON object in ${path}`, source: path };
		}
		const parsedConfig = configFromObject(raw);
		if (!parsedConfig) {
			return { ok: false, reason: "invalid_config", message: `Invalid provider config in ${path}`, source: path };
		}
		const config = mergeConfigWithEnvironment(parsedConfig, envParts);
		const validation = validateWebsearchConfig(config);
		if (!validation.ok) return { ...validation, source: path };
		const source = envParts.providers.length > 0 ? `env+${path}` : path;
		return { ok: true, config, source };
	}

	const envConfig = configFromEnvironmentParts(envParts);
	const validation = validateWebsearchConfig(envConfig.config);
	if (!validation.ok) return { ...validation, source: envConfig.source };
	return { ok: true, config: envConfig.config, source: envConfig.source };
}
