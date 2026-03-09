/**
 * BlackRoad OS – OAuth 2.0 / PKCE + JWT utilities
 *
 * Provides PKCE helpers, HS256 JWT signing/verification, and API key
 * generation.  All cryptographic operations use the Web Crypto API so
 * this module works natively inside Cloudflare Workers.
 */

export interface TokenPayload {
	sub: string;
	name: string;
	email: string;
	role: "admin" | "contributor" | "viewer";
	iat: number;
	exp: number;
}

/** Generate a cryptographically-random PKCE code verifier (RFC 7636). */
export async function generateCodeVerifier(): Promise<string> {
	const buffer = new Uint8Array(32);
	crypto.getRandomValues(buffer);
	return btoa(Array.from(buffer, (b) => String.fromCharCode(b)).join(""))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}

/** Derive the S256 code challenge from a verifier (RFC 7636). */
export async function generateCodeChallenge(verifier: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(verifier);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return btoa(
		Array.from(new Uint8Array(digest), (b) => String.fromCharCode(b)).join(""),
	)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}

/** Issue a `brk_…` prefixed API key (256 random bits). */
export async function generateApiKey(): Promise<string> {
	const buffer = new Uint8Array(32);
	crypto.getRandomValues(buffer);
	const hex = Array.from(buffer)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `brk_${hex}`;
}

/**
 * Sign a JWT with HMAC-SHA256.
 *
 * @param payload   Claims (without iat / exp – these are added automatically).
 * @param secret    Signing secret (use JWT_SECRET env var in production).
 * @param expiresIn Token lifetime in seconds (default: 3 600 = 1 h).
 */
export async function signJWT(
	payload: Omit<TokenPayload, "iat" | "exp">,
	secret: string,
	expiresIn = 3600,
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const fullPayload: TokenPayload = {
		...payload,
		iat: now,
		exp: now + expiresIn,
	};

	const encoder = new TextEncoder();
	const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(
		/=/g,
		"",
	);
	const body = btoa(JSON.stringify(fullPayload)).replace(/=/g, "");
	const signingInput = `${header}.${body}`;

	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const macBuffer = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(signingInput),
	);
	const sig = btoa(
		Array.from(new Uint8Array(macBuffer), (b) =>
			String.fromCharCode(b),
		).join(""),
	)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");

	return `${signingInput}.${sig}`;
}

/**
 * Verify an HS256 JWT.
 *
 * Returns the decoded payload on success, or `null` if the signature is
 * invalid, the token is malformed, or the token has expired.
 */
export async function verifyJWT(
	token: string,
	secret: string,
): Promise<TokenPayload | null> {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;

		const [header, body, sig] = parts;
		const encoder = new TextEncoder();
		const signingInput = `${header}.${body}`;

		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["verify"],
		);

		const sigBytes = Uint8Array.from(
			atob(sig.replace(/-/g, "+").replace(/_/g, "/")),
			(c) => c.charCodeAt(0),
		);
		const valid = await crypto.subtle.verify(
			"HMAC",
			key,
			sigBytes,
			encoder.encode(signingInput),
		);
		if (!valid) return null;

		const payload = JSON.parse(
			atob(body.replace(/-/g, "+").replace(/_/g, "/")),
		) as TokenPayload;

		if (payload.exp < Math.floor(Date.now() / 1000)) return null;

		return payload;
	} catch {
		return null;
	}
}
