/**
 * BlackRoad OS – Contributor API Converter
 *
 * All external vendor API traffic MUST route through this converter.
 * Contributors must hold a valid `brk_…` API key obtained via
 * `POST /api/converter/register`.
 *
 * The two permanently-approved contributors (@blackboxprogramming and
 * @lucidia) may pass through without a key.  Everyone else is denied
 * until they register and receive a key.
 */

/** GitHub usernames that are always granted full access. */
const APPROVED_CONTRIBUTORS = new Set(["blackboxprogramming", "lucidia"]);

export interface ConverterContext {
	apiKey: string;
	contributor: string;
	permissions: string[];
}

/** Look up a `brk_…` key from the API_KEYS KV namespace. */
export async function validateApiKey(
	apiKey: string,
	kvStore: KVNamespace,
): Promise<ConverterContext | null> {
	if (!apiKey.startsWith("brk_")) return null;
	return kvStore.get<ConverterContext>(`api_key:${apiKey}`, "json");
}

export function isApprovedContributor(username: string): boolean {
	return APPROVED_CONTRIBUTORS.has(username.toLowerCase());
}

export interface ConverterAuthResult {
	allowed: boolean;
	context?: ConverterContext;
	error?: string;
}

/**
 * Gate-check for the Converter API.
 *
 * 1. Approved contributors (@blackboxprogramming, @lucidia) always pass.
 * 2. Everyone else must supply a valid `X-BlackRoad-API-Key` header.
 */
export async function converterMiddleware(
	apiKey: string | null,
	username: string | null,
	kvStore: KVNamespace,
): Promise<ConverterAuthResult> {
	if (username && isApprovedContributor(username)) {
		return {
			allowed: true,
			context: {
				apiKey: "approved_contributor",
				contributor: username,
				permissions: ["read", "write", "admin"],
			},
		};
	}

	if (!apiKey) {
		return {
			allowed: false,
			error:
				"A BlackRoad Converter API key (X-BlackRoad-API-Key header) is " +
				"required to access this resource. " +
				"Register at POST /api/converter/register to obtain a key.",
		};
	}

	const context = await validateApiKey(apiKey, kvStore);
	if (!context) {
		return {
			allowed: false,
			error: "Invalid or expired BlackRoad Converter API key.",
		};
	}

	return { allowed: true, context };
}
