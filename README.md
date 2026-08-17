# GroomBook v0.7 AI

This is the first server-backed GroomBook prototype.

## What works
- Take/select a client-card photo on a phone
- Send the image securely from the browser to the GroomBook server
- AI reads the actual image
- Review/edit extracted client and pet fields
- Human approval before saving
- Original client-card image stays attached to the saved browser record
- Take/select a weekly schedule photo
- AI extracts draft appointments
- Review/edit every field
- Approve all into the local GroomBook schedule
- The OpenAI API key stays on the SERVER, never in the browser HTML

## Important prototype limits
- Saved records still live in that browser's localStorage. This is not yet a shared multi-user cloud database.
- Card images stored in localStorage will eventually hit browser storage limits. It is fine for early testing, but the next architecture step is object storage + a database.
- AI can misread handwriting. Human approval is intentionally mandatory.

## Run locally
1. Install Node.js 18+.
2. Open a terminal in this folder.
3. Run: `npm install`
4. Set environment variable `OPENAI_API_KEY`.
   - macOS/Linux: `export OPENAI_API_KEY="..."`
   - PowerShell: `$env:OPENAI_API_KEY="..."`
5. Optional: set `OPENAI_MODEL` (defaults to `gpt-5-mini`).
6. Run: `npm start`
7. Open http://localhost:3000

## Hosting
This project can be deployed to a Node-compatible host. Configure OPENAI_API_KEY as a private server environment variable, not in code or the browser.

## Privacy
The server sends the selected image to the OpenAI API for extraction. The request is configured with `store: false`. Do not use this prototype as the shop's sole source of truth yet.
