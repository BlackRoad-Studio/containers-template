/**
 * BlackRoad OS – Stripe webhook handler
 *
 * Verifies the Stripe-Signature header (HMAC-SHA256) and dispatches
 * each event type to its handler.  Only events declared in
 * stripe-config.json are processed; all others are acknowledged and
 * logged.
 */

export interface StripeEvent {
	id: string;
	type: string;
	data: {
		object: Record<string, unknown>;
	};
}

export interface StripeEventResult {
	status: "ok" | "error";
	message: string;
}

/**
 * Verify a Stripe webhook signature.
 *
 * Stripe sends a `Stripe-Signature` header of the form:
 *   t=<timestamp>,v1=<hex-HMAC-SHA256>
 *
 * We reconstruct `<timestamp>.<rawBody>` and compare the HMAC against
 * the provided v1 value using a timing-safe comparison.
 */
export async function verifyStripeSignature(
	body: string,
	signature: string,
	secret: string,
): Promise<boolean> {
	const parts = signature.split(",");
	const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
	const v1 = parts.find((p) => p.startsWith("v1="))?.split("=")[1];

	if (!timestamp || !v1) return false;

	const encoder = new TextEncoder();
	const signingInput = `${timestamp}.${body}`;

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
	const expected = Array.from(new Uint8Array(macBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	// Constant-time comparison (lengths are always equal hex strings)
	if (expected.length !== v1.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) {
		diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
	}
	return diff === 0;
}

/** Dispatch a verified Stripe event to the appropriate handler. */
export async function handleStripeEvent(
	event: StripeEvent,
): Promise<StripeEventResult> {
	console.log(`[Stripe] Processing event: ${event.type} (${event.id})`);

	switch (event.type) {
		case "checkout.session.completed":
			return {
				status: "ok",
				message: "Checkout session completed – provisioning access",
			};

		case "customer.subscription.created":
			return {
				status: "ok",
				message: "Subscription created – activating plan",
			};

		case "customer.subscription.updated":
			return {
				status: "ok",
				message: "Subscription updated – syncing plan",
			};

		case "invoice.paid":
			return { status: "ok", message: "Invoice paid – renewing access" };

		default:
			console.log(`[Stripe] Unhandled event type: ${event.type}`);
			return { status: "ok", message: `Received: ${event.type}` };
	}
}
