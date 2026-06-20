import type { SearchDetails } from "./types.ts";

export function formatSearchText(details: SearchDetails): string {
	if (details.error) return details.error;
	if (details.results.length === 0) return `No web search results found for "${details.query}".`;

	const lines = [`${details.query} ${details.provider}`, ""];
	for (const [index, item] of details.results.entries()) {
		lines.push(`${index + 1}. ${item.title}`);
		lines.push(`   ${item.url}`);
		if (item.snippet) lines.push(`   ${item.snippet}`);
	}
	return lines.join("\n");
}
