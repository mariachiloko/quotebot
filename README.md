# Public Chatbot Starter (Safe to Share)

This folder is a clean, reusable chatbot package that avoids private business data and cloud secrets.

## What is included

- `chatbot.js`: reusable chatbot widget + standalone mode
- `chatbot.css`: chatbot UI styles
- `chatbot.config.example.js`: sample config with placeholder FAQ entries
- `demo.html`: local demo page
- `.gitignore`: prevents private config and env files from being committed

## What is intentionally NOT included

- Your private FAQ data
- Your HQ/address details
- Your live AWS/API endpoint values
- Terraform, Lambda, and deployment files

## Quick start

1. Copy the example config:

```bash
cp chatbot.config.example.js chatbot.config.js
```

2. Edit `chatbot.config.js` with your own business content.

3. Load files in your page:

```html
<link rel="stylesheet" href="./chatbot.css" />
<script src="./chatbot.config.js"></script>
<script src="./chatbot.js" data-api-base="https://YOUR_API_BASE"></script>
```

If you do not need live quote calls, leave `data-api-base` empty.

## Create a separate GitHub repository

Run these commands from this `public-chatbot` folder:

```bash
git init
git add .
git commit -m "Initial public chatbot starter"
gh repo create your-chatbot-starter --public --source=. --remote=origin --push
```

If you do not use GitHub CLI, create an empty repo in GitHub UI and then:

```bash
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

## Sync changes back to your private website repo

Yes, you can use this public repo to improve your live chatbot.

Use one of these simple workflows:

1. Manual copy: copy updated `chatbot.js` and `chatbot.css` from public repo into your private repo.
2. Patch flow: create commits in public repo, then cherry-pick matching commits into private repo.
3. Subtree flow: add public repo as a subtree in private repo, then pull updates.

For most teams, option 1 is the easiest and safest.

