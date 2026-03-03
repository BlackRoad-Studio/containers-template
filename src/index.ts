import { Container, getContainer, getRandom } from '@cloudflare/containers';
import { Hono } from 'hono';
import Stripe from 'stripe';

// Extend Env to include Stripe secrets (set via `wrangler secret put`)
interface AppEnv extends Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
}

export class MyContainer extends Container<Env> {
  // Port the container listens on (default: 8080)
  defaultPort = 8080;
  // Time before container sleeps due to inactivity (default: 30s)
  sleepAfter = '2m';
  // Environment variables passed to the container
  envVars = {
    MESSAGE: 'I was passed in via the container class!',
  };

  // Optional lifecycle hooks
  override onStart() {
    console.log('Container successfully started');
  }

  override onStop() {
    console.log('Container successfully shut down');
  }

  override onError(error: unknown) {
    console.log('Container error:', error);
  }
}

// Create Hono app with proper typing for Cloudflare Workers
const app = new Hono<{
  Bindings: AppEnv;
}>();

// Pricing plans (mirrors stripe-config.json)
const PLANS = [
  { name: 'Basic', price: 900, interval: 'month', priceLabel: '$9/mo' },
  { name: 'Pro', price: 2900, interval: 'month', priceLabel: '$29/mo' },
  { name: 'Enterprise', price: 9900, interval: 'month', priceLabel: '$99/mo' },
];

// HTML homepage with pricing page
app.get('/', (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>containers-template | BlackRoad OS</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #f5f5f5; min-height: 100vh; }
    header { padding: 2rem; text-align: center; border-bottom: 1px solid #222; }
    header h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.5px; }
    header p { color: #888; margin-top: 0.5rem; }
    .plans { display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: center; padding: 3rem 2rem; max-width: 1100px; margin: 0 auto; }
    .card { background: #111; border: 1px solid #2a2a2a; border-radius: 12px; padding: 2rem; width: 300px; display: flex; flex-direction: column; gap: 1rem; }
    .card.featured { border-color: #6366f1; }
    .card h2 { font-size: 1.4rem; font-weight: 600; }
    .card .price { font-size: 2.5rem; font-weight: 700; color: #6366f1; }
    .card .price span { font-size: 1rem; color: #888; }
    .card ul { list-style: none; color: #aaa; font-size: 0.95rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .card ul li::before { content: "✓ "; color: #6366f1; }
    .card button { margin-top: auto; padding: 0.75rem 1.5rem; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .card button:hover { background: #4f46e5; }
    footer { text-align: center; padding: 2rem; color: #555; font-size: 0.85rem; border-top: 1px solid #1a1a1a; }
    .endpoints { max-width: 700px; margin: 0 auto 2rem; padding: 0 2rem; }
    .endpoints h3 { font-size: 1rem; color: #888; margin-bottom: 0.75rem; }
    .endpoints code { display: block; background: #111; border: 1px solid #2a2a2a; border-radius: 6px; padding: 0.75rem 1rem; font-size: 0.875rem; color: #a5b4fc; margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <header>
    <h1>🚀 containers-template</h1>
    <p>Cloudflare Containers · BlackRoad OS, Inc.</p>
  </header>

  <div class="plans">
    ${PLANS.map(
      (plan, i) => `
    <div class="card${i === 1 ? ' featured' : ''}">
      <h2>${plan.name}</h2>
      <div class="price">${plan.priceLabel.split('/')[0]}<span>/${plan.priceLabel.split('/')[1]}</span></div>
      <ul>
        <li>Cloudflare Container hosting</li>
        <li>Auto-scaling workers</li>
        ${i >= 1 ? '<li>Priority support</li>' : ''}
        ${i >= 2 ? '<li>Dedicated infrastructure</li>' : ''}
      </ul>
      <button onclick="checkout('${plan.name}')">Get Started</button>
    </div>`
    ).join('')}
  </div>

  <div class="endpoints">
    <h3>Container Endpoints</h3>
    <code>GET /container/&lt;id&gt; — Start a named container</code>
    <code>GET /lb — Load balance across 3 containers</code>
    <code>GET /singleton — Get a single container instance</code>
    <code>GET /error — Trigger container error demo</code>
  </div>

  <footer>© 2026 BlackRoad OS, Inc. · CEO: Alexa Amundson</footer>

  <script>
    async function checkout(plan) {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Checkout error: ' + (err.error || res.statusText));
        return;
      }
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  </script>
</body>
</html>`;
  return c.html(html);
});

// Create a Stripe Checkout session for the selected plan
app.post('/api/stripe/checkout', async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe not configured' }, 503);
  }

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const body = await c.req.json<{ plan?: string }>();
  const plan = PLANS.find(
    (p) => p.name.toLowerCase() === (body.plan ?? '').toLowerCase()
  );
  if (!plan) {
    return c.json({ error: 'Invalid plan' }, 400);
  }

  const origin =
    c.req.header('origin') ?? `https://${c.req.header('host') ?? 'localhost'}`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: `containers-template - ${plan.name}` },
          unit_amount: plan.price,
          recurring: { interval: plan.interval as 'month' },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/?checkout=success`,
    cancel_url: `${origin}/?checkout=cancelled`,
  });

  return c.json({ url: session.url });
});

// Handle Stripe webhook events
app.post('/api/stripe/webhook', async (c) => {
  if (!c.env.STRIPE_SECRET_KEY || !c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: 'Stripe not configured' }, 503);
  }

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  const rawBody = await c.req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature validation failed:', err);
    return c.json({ error: 'Invalid webhook signature' }, 400);
  }

  // Handle relevant webhook events (mirrors stripe-config.json webhooks)
  switch (event.type) {
    case 'checkout.session.completed':
      console.log('Checkout session completed:', event.data.object.id);
      break;
    case 'customer.subscription.created':
      console.log('Subscription created:', event.data.object.id);
      break;
    case 'customer.subscription.updated':
      console.log('Subscription updated:', event.data.object.id);
      break;
    case 'invoice.paid':
      console.log('Invoice paid:', event.data.object.id);
      break;
    default:
      console.log('Unhandled event type:', event.type);
  }

  return c.json({ received: true });
});

// Route requests to a specific container using the container ID
app.get('/container/:id', async (c) => {
  const id = c.req.param('id');
  const containerId = c.env.MY_CONTAINER.idFromName(`/container/${id}`);
  const container = c.env.MY_CONTAINER.get(containerId);
  return await container.fetch(c.req.raw);
});

// Demonstrate error handling - this route forces a panic in the container
app.get('/error', async (c) => {
  const container = getContainer(c.env.MY_CONTAINER, 'error-test');
  return await container.fetch(c.req.raw);
});

// Load balance requests across multiple containers
app.get('/lb', async (c) => {
  const container = await getRandom(c.env.MY_CONTAINER, 3);
  return await container.fetch(c.req.raw);
});

// Get a single container instance (singleton pattern)
app.get('/singleton', async (c) => {
  const container = getContainer(c.env.MY_CONTAINER);
  return await container.fetch(c.req.raw);
});

export default app;
