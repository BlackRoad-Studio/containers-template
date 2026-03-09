# Contributing to BlackRoad OS

## 🔒 Proprietary Notice

This is a **PROPRIETARY** repository owned by BlackRoad OS, Inc.

All contributions become the property of BlackRoad OS, Inc.

## 🎨 BlackRoad Brand System

**CRITICAL:** All UI/design work MUST follow the official brand system!

### Required Colors:
- **Hot Pink:** #FF1D6C (primary accent)
- **Amber:** #F5A623
- **Electric Blue:** #2979FF
- **Violet:** #9C27B0
- **Background:** #000000 (black)
- **Text:** #FFFFFF (white)

### Forbidden Colors (DO NOT USE):
❌ #FF9D00, #FF6B00, #FF0066, #FF006B, #D600AA, #7700FF, #0066FF

### Golden Ratio Spacing:
φ (phi) = 1.618

**Spacing scale:** 8px → 13px → 21px → 34px → 55px → 89px → 144px

### Gradients:
```css
background: linear-gradient(135deg, #FF1D6C 38.2%, #F5A623 61.8%);
```

### Typography:
- **Font:** SF Pro Display, -apple-system, sans-serif
- **Line height:** 1.618

## 🔑 Contributor Access – Converter API Required

> **You cannot contribute without a BlackRoad Converter API key.**

All vendor API traffic (OpenAI, Anthropic, GitHub, etc.) **must** route
through the BlackRoad Converter API.  Direct calls to external vendors
are forbidden for contributors.

### How to obtain a key

```bash
curl -X POST https://<worker>.workers.dev/api/converter/register \
  -H "Content-Type: application/json" \
  -d '{"username":"<your-github-username>","email":"<you@example.com>","reason":"<why you want to contribute>"}'
```

Include the returned `brk_…` key as `X-BlackRoad-API-Key` in every
request to `/api/converter/*`.

`@blackboxprogramming` and `@lucidia` have permanent full access and do
not need to register.

## 📝 How to Contribute

1. Fork the repository (for testing purposes only)
2. Register for a Converter API key (see above)
3. Create a feature branch
4. Follow BlackRoad brand guidelines
5. Submit PR with detailed description
6. All code becomes BlackRoad OS, Inc. property

## ⚖️ Legal

By contributing, you agree:
- All code becomes property of BlackRoad OS, Inc.
- You have rights to contribute the code
- Contributions are NOT for commercial resale
- Testing and educational purposes only

## 📧 Contact

**Email:** blackroad.systems@gmail.com
**CEO:** Alexa Amundson
**Organization:** BlackRoad OS, Inc.
