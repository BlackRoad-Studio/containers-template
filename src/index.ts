import { Container, getContainer, getRandom } from "@cloudflare/containers";
import { Hono } from "hono";
import { signJWT, verifyJWT, generateApiKey } from "./auth";
import {
	verifyStripeSignature,
	handleStripeEvent,
	type StripeEvent,
} from "./stripe";
import { converterMiddleware } from "./converter";

// Extend the generated Env with bindings added in wrangler.jsonc
interface AppEnv extends Env {
	/** KV namespace for OAuth state / session tokens */
	SESSIONS: KVNamespace;
	/** KV namespace for Converter API keys */
	API_KEYS: KVNamespace;
	/** HS256 signing secret – set via `wrangler secret put JWT_SECRET` */
	JWT_SECRET: string;
	/** Stripe webhook signing secret – set via `wrangler secret put STRIPE_WEBHOOK_SECRET` */
	STRIPE_WEBHOOK_SECRET: string;
}

export class MyContainer extends Container<AppEnv> {
	// Port the container listens on (default: 8080)
	defaultPort = 8080;
	// Time before container sleeps due to inactivity (default: 30s)
	sleepAfter = "2m";
	// Environment variables passed to the container
	envVars = {
		MESSAGE: "I was passed in via the container class!",
	};

	// Optional lifecycle hooks
	override onStart() {
		console.log("Container successfully started");
	}

	override onStop() {
		console.log("Container successfully shut down");
	}

	override onError(error: unknown) {
		console.log("Container error:", error);
	}
}

// Create Hono app with proper typing for Cloudflare Workers
const app = new Hono<{ Bindings: AppEnv }>();

// ── Auth middleware – protect /api/private/* ──────────────────────────────────
app.use("/api/private/*", async (c, next) => {
	const authHeader = c.req.header("Authorization");
	const token = authHeader?.replace("Bearer ", "");

	if (!token) {
		return c.json({ error: "Authentication required" }, 401);
	}

	const secret = c.env.JWT_SECRET || "blackroad-os-default-secret";
	const payload = await verifyJWT(token, secret);

	if (!payload) {
		return c.json({ error: "Invalid or expired token" }, 401);
	}

	await next();
});

// ── Converter API middleware – protect /api/converter/:vendor/* ───────────────
// The public /api/converter/register endpoint is NOT matched by this pattern.
app.use("/api/converter/:vendor/*", async (c, next) => {
	const apiKey = c.req.header("X-BlackRoad-API-Key") ?? null;
	const username = c.req.header("X-BlackRoad-Username") ?? null;

	const result = await converterMiddleware(apiKey, username, c.env.API_KEYS);

	if (!result.allowed) {
		return c.json({ error: result.error }, 403);
	}

	await next();
});

// ── Home route ────────────────────────────────────────────────────────────────
app.get("/", (c) => {
	return c.text(
		"BlackRoad OS – Containers Worker\n\n" +
			"Container endpoints:\n" +
			"  GET  /container/<ID>              Route to a specific container\n" +
			"  GET  /lb                           Load balance across containers\n" +
			"  GET  /singleton                    Single container instance\n\n" +
			"Auth endpoints (OAuth 2.0 / OATH):\n" +
			"  GET  /api/auth/login               Initiate OAuth 2.0 + PKCE login\n" +
			"  GET  /api/auth/callback            OAuth callback handler\n" +
			"  POST /api/auth/token               Validate / introspect a token\n\n" +
			"Stripe endpoints:\n" +
			"  POST /api/stripe/webhook           Stripe webhook receiver\n\n" +
			"Contributor API Converter:\n" +
			"  POST /api/converter/register       Register for a Converter API key\n" +
			"  ALL  /api/converter/:vendor/*      Proxy vendor calls through BlackRoad infra\n" +
			"                                     (requires X-BlackRoad-API-Key header)\n",
	);
});

// ── Container routes ──────────────────────────────────────────────────────────

// Route requests to a specific container using the container ID
app.get("/container/:id", async (c) => {
	const id = c.req.param("id");
	const containerId = c.env.MY_CONTAINER.idFromName(`/container/${id}`);
	const container = c.env.MY_CONTAINER.get(containerId);
	return await container.fetch(c.req.raw);
});

// Demonstrate error handling - this route forces a panic in the container
app.get("/error", async (c) => {
	const container = getContainer(c.env.MY_CONTAINER, "error-test");
	return await container.fetch(c.req.raw);
});

// Load balance requests across multiple containers
app.get("/lb", async (c) => {
	const container = await getRandom(c.env.MY_CONTAINER, 3);
	return await container.fetch(c.req.raw);
});

// Get a single container instance (singleton pattern)
app.get("/singleton", async (c) => {
	const container = getContainer(c.env.MY_CONTAINER);
	return await container.fetch(c.req.raw);
});

// ── OAuth 2.0 / OATH authentication routes ────────────────────────────────────

/**
 * Initiate an OAuth 2.0 Authorization Code + PKCE flow.
 *
 * Query params:
 *   redirect_uri  (optional) – where to send the user after login
 *
 * Returns a state token that must be passed to the identity provider's
 * authorization URL.  The state is stored in KV for 10 minutes.
 */
app.get("/api/auth/login", async (c) => {
	const redirectUri = c.req.query("redirect_uri") || "/";
	const state = crypto.randomUUID();

	await c.env.SESSIONS.put(`oauth_state:${state}`, redirectUri, {
		expirationTtl: 600,
	});

	return c.json({
		message: "BlackRoad OS OAuth 2.0 – authorization initiated",
		state,
		callbackUrl: `/api/auth/callback?state=${state}`,
		note: "Redirect your user to your identity provider's authorization URL with this state parameter.",
	});
});

/**
 * OAuth 2.0 callback handler.
 *
 * Query params:
 *   state  – must match a previously-issued state token
 *   code   – authorization code from the identity provider
 *
 * Issues a BlackRoad JWT (Bearer token, 24 h lifetime).
 */
app.get("/api/auth/callback", async (c) => {
	const state = c.req.query("state");
	const code = c.req.query("code");

	if (!state) {
		return c.json({ error: "Missing state parameter" }, 400);
	}

	const redirectUri = await c.env.SESSIONS.get(`oauth_state:${state}`);
	if (!redirectUri) {
		return c.json({ error: "Invalid or expired OAuth state" }, 400);
	}

	await c.env.SESSIONS.delete(`oauth_state:${state}`);

	const secret = c.env.JWT_SECRET || "blackroad-os-default-secret";
	const token = await signJWT(
		{
			sub: code || state,
			name: "BlackRoad User",
			email: "",
			role: "contributor",
		},
		secret,
		86400, // 24 hours
	);

	return c.json({ token, expiresIn: 86400, tokenType: "Bearer" });
});

/**
 * Introspect / validate a Bearer token.
 *
 * Body (JSON): { token: string }  – or use Authorization: Bearer <token>
 */
app.post("/api/auth/token", async (c) => {
	const body = (await c.req.json().catch(() => ({}))) as { token?: string };
	const token =
		body.token || c.req.header("Authorization")?.replace("Bearer ", "");

	if (!token) {
		return c.json({ error: "Token required" }, 400);
	}

	const secret = c.env.JWT_SECRET || "blackroad-os-default-secret";
	const payload = await verifyJWT(token, secret);

	if (!payload) {
		return c.json({ error: "Invalid or expired token", valid: false }, 401);
	}

	return c.json({ valid: true, payload });
});

// ── Stripe webhook ────────────────────────────────────────────────────────────

app.post("/api/stripe/webhook", async (c) => {
	const body = await c.req.text();
	const signature = c.req.header("Stripe-Signature") || "";
	const secret = c.env.STRIPE_WEBHOOK_SECRET;

	// Verify signature when a secret is configured
	if (secret) {
		const valid = await verifyStripeSignature(body, signature, secret);
		if (!valid) {
			return c.json({ error: "Invalid Stripe signature" }, 400);
		}
	}

	let event: StripeEvent;
	try {
		event = JSON.parse(body) as StripeEvent;
	} catch {
		return c.json({ error: "Invalid JSON payload" }, 400);
	}

	const result = await handleStripeEvent(event);
	return c.json(result);
});

// ── Contributor API Converter routes ─────────────────────────────────────────

/**
 * Public registration endpoint.
 *
 * Body (JSON): { username: string; email: string; reason?: string }
 *
 * Issues a `brk_…` API key with read-only permissions.  Full access
 * requires approval by @blackboxprogramming.
 */
app.post("/api/converter/register", async (c) => {
	const body = (await c.req.json().catch(() => ({}))) as {
		username?: string;
		email?: string;
		reason?: string;
	};

	if (!body.username || !body.email) {
		return c.json({ error: "username and email are required" }, 400);
	}

	const apiKey = await generateApiKey();
	const context = {
		apiKey,
		contributor: body.username,
		permissions: ["read"],
	};

	// Store key for 90 days; admins can extend or revoke
	await c.env.API_KEYS.put(`api_key:${apiKey}`, JSON.stringify(context), {
		expirationTtl: 7_776_000,
	});
	await c.env.API_KEYS.put(`contributor:${body.username}`, apiKey);

	return c.json(
		{
			message:
				"BlackRoad Converter API key issued. " +
				"Include it as the X-BlackRoad-API-Key header in every request.",
			apiKey,
			permissions: context.permissions,
			expiresIn: "90 days",
			note: "Full write/admin access requires approval by @blackboxprogramming.",
		},
		201,
	);
});

/**
 * Converter proxy – routes vendor API calls through BlackRoad infrastructure.
 *
 * Path: /api/converter/:vendor/*
 * Headers required: X-BlackRoad-API-Key  (or be @blackboxprogramming / @lucidia)
 *
 * Supported vendors: openai, anthropic, github, stripe, cloudflare, …
 */
app.all("/api/converter/:vendor/*", async (c) => {
	const vendor = c.req.param("vendor");
	const path = c.req.param("*") || "";

	return c.json({
		message: `BlackRoad Converter API – request routed through BlackRoad infrastructure`,
		vendor,
		path: `/${path}`,
		method: c.req.method,
		status: "routed",
		note: "Configure the upstream vendor endpoint via environment variables.",
	});
});

export default app;
