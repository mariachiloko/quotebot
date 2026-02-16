# Quotebot (Public, Reusable)

This repository is a public-safe chatbot starter.

## Purpose

Quotebot is for bilingual businesses that want to add a chatbot to answer questions about their own services using controlled question-and-answer content, which helps reduce hallucinations and keep replies consistent and reliable.

## File locations

- Frontend chatbot logic: `chatbot.js`
- Frontend styles: `chatbot.css`
- Config template: `chatbot.config.example.js`
- Backend Lambda example: `backend/lambda_function.py`

## Included

- Reusable chatbot widget + standalone mode
- Config-driven FAQ/responses (no business-specific hardcoding)
- Quote/translate API integration (`/quote`, `/translate`)
- Sanitized AWS Lambda backend example

## Not included on purpose

- Your private FAQ/business policies
- Your HQ address/location data
- Your live API endpoint
- Any AWS account IDs, ARNs, keys, or secrets

## Quick start

1. Copy config template:

```bash
cp chatbot.config.example.js chatbot.config.js
```

2. Edit `chatbot.config.js` with your own FAQ, links, and text.

3. Load files in your site:

```html
<link rel="stylesheet" href="./chatbot.css" />
<script src="./chatbot.config.js"></script>
<script src="./chatbot.js" data-api-base="https://YOUR_API_BASE"></script>
```

If you do not want live quotes/translations yet, leave `data-api-base` empty.

## Backend (optional)

See `backend/README.md` and `backend/lambda_function.py`.

The backend expects:
- `POST /quote`
- `POST /translate`

## Sync updates back to your private website repo

Yes. Keep this repo generic, then copy or cherry-pick code into your private site repo.

1. Make reusable changes in this repo.
2. Copy updated files into your private repo.
3. Add private business data only in private config files.
