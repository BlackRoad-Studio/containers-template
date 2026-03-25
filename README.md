<!-- BlackRoad SEO Enhanced -->

# containers template

> Part of **[BlackRoad OS](https://blackroad.io)** — Sovereign Computing for Everyone

[![BlackRoad OS](https://img.shields.io/badge/BlackRoad-OS-ff1d6c?style=for-the-badge)](https://blackroad.io)
[![BlackRoad Studio](https://img.shields.io/badge/Org-BlackRoad-Studio-2979ff?style=for-the-badge)](https://github.com/BlackRoad-Studio)
[![License](https://img.shields.io/badge/License-Proprietary-f5a623?style=for-the-badge)](LICENSE)

**containers template** is part of the **BlackRoad OS** ecosystem — a sovereign, distributed operating system built on edge computing, local AI, and mesh networking by **BlackRoad OS, Inc.**

## About BlackRoad OS

BlackRoad OS is a sovereign computing platform that runs AI locally on your own hardware. No cloud dependencies. No API keys. No surveillance. Built by [BlackRoad OS, Inc.](https://github.com/BlackRoad-OS-Inc), a Delaware C-Corp founded in 2025.

### Key Features
- **Local AI** — Run LLMs on Raspberry Pi, Hailo-8, and commodity hardware
- **Mesh Networking** — WireGuard VPN, NATS pub/sub, peer-to-peer communication
- **Edge Computing** — 52 TOPS of AI acceleration across a Pi fleet
- **Self-Hosted Everything** — Git, DNS, storage, CI/CD, chat — all sovereign
- **Zero Cloud Dependencies** — Your data stays on your hardware

### The BlackRoad Ecosystem
| Organization | Focus |
|---|---|
| [BlackRoad OS](https://github.com/BlackRoad-OS) | Core platform and applications |
| [BlackRoad OS, Inc.](https://github.com/BlackRoad-OS-Inc) | Corporate and enterprise |
| [BlackRoad AI](https://github.com/BlackRoad-AI) | Artificial intelligence and ML |
| [BlackRoad Hardware](https://github.com/BlackRoad-Hardware) | Edge hardware and IoT |
| [BlackRoad Security](https://github.com/BlackRoad-Security) | Cybersecurity and auditing |
| [BlackRoad Quantum](https://github.com/BlackRoad-Quantum) | Quantum computing research |
| [BlackRoad Agents](https://github.com/BlackRoad-Agents) | Autonomous AI agents |
| [BlackRoad Network](https://github.com/BlackRoad-Network) | Mesh and distributed networking |
| [BlackRoad Education](https://github.com/BlackRoad-Education) | Learning and tutoring platforms |
| [BlackRoad Labs](https://github.com/BlackRoad-Labs) | Research and experiments |
| [BlackRoad Cloud](https://github.com/BlackRoad-Cloud) | Self-hosted cloud infrastructure |
| [BlackRoad Forge](https://github.com/BlackRoad-Forge) | Developer tools and utilities |

### Links
- **Website**: [blackroad.io](https://blackroad.io)
- **Documentation**: [docs.blackroad.io](https://docs.blackroad.io)
- **Chat**: [chat.blackroad.io](https://chat.blackroad.io)
- **Search**: [search.blackroad.io](https://search.blackroad.io)

---


## Status: 🟢 GREEN LIGHT – Production Ready

**Last Updated:** 2026-03-03 | **Maintained By:** BlackRoad OS, Inc.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/BlackRoad-OS/containers-template)

---

## Overview

A production-grade Cloudflare Workers + Containers application owned and operated by **BlackRoad OS, Inc.**

This Worker provides:

| Feature | Description |
|---|---|
| **Container routing** | Start, load-balance, and singleton-route Docker containers |
| **OAuth 2.0 / OATH** | Authorization Code + PKCE flow with HS256 JWT tokens |
| **Stripe integration** | Verified webhook handler for subscriptions and payments |
| **Contributor API Converter** | Gated vendor-API proxy – all traffic routes through BlackRoad infra |

---

## Products & Pricing

| Plan | Price | Features |
|---|---|---|
| **Basic** | $9 / month | Container routing, 1 instance, community support |
| **Pro** | $29 / month | Load balancing, 5 instances, priority support |
| **Enterprise** | $99 / month | Unlimited instances, SLA, dedicated support |

> **Access to the codebase requires a BlackRoad Converter API key.**  
> See [Contributor Access](#contributor-access--converter-api) below.

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Cloudflare account with Workers and Containers enabled
- Wrangler CLI (`npm install -g wrangler`)

### Installation

```bash
npm install
```

### Create KV Namespaces

```bash
wrangler kv namespace create SESSIONS
wrangler kv namespace create API_KEYS
```

Copy the returned IDs into `wrangler.jsonc` (replace the placeholder values).

### Set Secrets

```bash
wrangler secret put JWT_SECRET            # random 32+ char string
wrangler secret put STRIPE_WEBHOOK_SECRET # from Stripe dashboard
```

### Local Development

```bash
npm run dev
```

Open [http://localhost:8787](http://localhost:8787).

### Deploy to Production

```bash
npm run deploy
```

---

## API Reference

### Container endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/container/:id` | Route to a specific container by ID |
| `GET` | `/lb` | Load-balance across 3 container instances |
| `GET` | `/singleton` | Single shared container instance |
| `GET` | `/error` | Trigger container error (demo) |

### Auth endpoints (OAuth 2.0 / OATH)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/auth/login` | Initiate OAuth 2.0 + PKCE login |
| `GET` | `/api/auth/callback` | OAuth callback – issues a Bearer JWT |
| `POST` | `/api/auth/token` | Validate / introspect a token |

**Login flow:**

```
GET /api/auth/login?redirect_uri=/dashboard
→ { state, callbackUrl }

GET /api/auth/callback?state=<state>&code=<code>
→ { token, expiresIn: 86400, tokenType: "Bearer" }
```

**Token validation:**

```
POST /api/auth/token
Authorization: Bearer <token>
→ { valid: true, payload: { sub, name, email, role, iat, exp } }
```

### Stripe endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/stripe/webhook` | Receive and verify Stripe events |

Handled events: `checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `invoice.paid`.

Configure in the [Stripe Dashboard](https://dashboard.stripe.com/webhooks):  
Endpoint URL → `https://<your-worker>.workers.dev/api/stripe/webhook`

### Contributor API Converter

| Method | Path | Auth required |
|---|---|---|
| `POST` | `/api/converter/register` | Public |
| `ALL` | `/api/converter/:vendor/*` | `X-BlackRoad-API-Key` |

See [Contributor Access](#contributor-access--converter-api) for details.

---

## Contributor Access & Converter API

> **All vendor API traffic must route through the BlackRoad Converter.**  
> Direct calls to OpenAI, Anthropic, GitHub, or any other vendor are
> **not permitted** for contributors.

### How to get access

1. Register for a Converter API key:

```bash
curl -X POST https://<your-worker>.workers.dev/api/converter/register \
  -H "Content-Type: application/json" \
  -d '{"username":"your-github-username","email":"you@example.com","reason":"Contributing to X"}'
```

2. You will receive a `brk_…` key.

3. Include it in every request to the Converter:

```bash
curl https://<your-worker>.workers.dev/api/converter/openai/v1/chat/completions \
  -H "X-BlackRoad-API-Key: brk_<your-key>" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

### Approved contributors

`@blackboxprogramming` and `@lucidia` have permanent full access and do not
need a Converter API key.

---

## Architecture

```
Client
  │
  ▼
Cloudflare Workers (src/index.ts)
  ├── OAuth 2.0 + PKCE  →  KV: SESSIONS
  ├── Stripe Webhook    →  signature verified, events dispatched
  ├── Converter API     →  KV: API_KEYS  →  BlackRoad infra
  └── Container Routes  →  Durable Objects (MyContainer)
                               │
                               ▼
                         Docker container (Go, port 8080)
```

---

## License & Copyright

**Copyright © 2026 BlackRoad OS, Inc. All Rights Reserved.**

**PROPRIETARY AND CONFIDENTIAL**

This software is the exclusive property of BlackRoad OS, Inc. and may not be
copied, distributed, modified, or used for any purpose without the express
written consent of BlackRoad OS, Inc.

- **Not** for commercial resale
- **Not** for use by AI training pipelines
- Contributor access requires a valid BlackRoad Converter API key

**CEO:** Alexa Amundson  
**Contact:** blackroad.systems@gmail.com  
**Security:** security@blackroad.io

See [LICENSE](LICENSE) for complete terms.
