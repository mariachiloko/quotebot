# Backend Example (Sanitized)

This folder contains a **generic AWS Lambda example** for the chatbot API.

Files:
- `lambda_function.py`: handles `/quote` and `/translate`
- `sample-env.json`: environment variable template

## What this backend does

- `POST /quote`
  - Input: `location`, `hours`, `start_time`, `service_type`
  - Output: either `routeTo: "quote"` with estimate details, or `routeTo: "contact"`

- `POST /translate`
  - Input: `text`, `target_lang`, `source_lang`
  - Output: translated text (falls back to original text on errors)

## Required AWS services

- Amazon Location Service
  - Place Index
  - Route Calculator
- AWS Translate

## Notes

- `QUOTE_ORIGIN_ADDRESS` must be your own business/base address.
- Pricing tiers are examples only. Replace them with your own logic.
- No private account IDs, emails, domain names, or secrets are included here.
