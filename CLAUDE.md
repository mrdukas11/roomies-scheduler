# Roomies Scheduler

Shared availability grid for the Roomies Book Club (6 members: Lodi, Morgan,
Mark D, Ben, John, Rock). Replaces the emailed spreadsheet: each roomie opens
the page, taps their name, marks candidate dates good / not good / maybe, and
presses "I'm done." Everyone sees the live grid; names toggle from "awaiting"
(gray, dashed) to "replied" (green stamp) once done. A front-runners strip
surfaces dates with no objections; full consensus gets a "works for all" stamp.

## Architecture
- `public/index.html` - the whole app (vanilla JS, no build step). Library
  circulation-card design: manila card on desk green, Domine + Courier Prime,
  rubber-stamp status marks.
- `netlify/functions/data.mjs` - single serverless function at `/api/data`.
  GET returns state; POST accepts `{type:"response", name, statuses, comment,
  done}` (updates one roomie only, so saves never clobber each other) or
  `{type:"setup", month, clearResponses}` (organizer publishes a new month).
- Storage: Netlify Blobs, store `roomies-scheduler`, key `state`. No database,
  no third-party account.

## State shape
```json
{
  "month": { "book", "author", "note", "dates": ["YYYY-MM-DD"], "roster": [] },
  "responses": { "Ben": { "statuses": {"2026-08-03": "good"}, "comment": "Not Fridays", "done": true, "updated": "..." } }
}
```

## Monthly workflow (Mark)
1. Open the site, expand "Organizer tools."
2. Enter book + author, pick any day in the first candidate week, choose
   number of weeks (weekdays auto-generate; tap chips to knock out holidays).
3. Leave "Clear everyone's replies" checked, press "Publish month."
4. Email/text the roomies the same URL as always.

## Local dev
`netlify dev` from this folder (Blobs works locally through the CLI).

## Known limits / possible upgrades
- No auth: honor system, same as the FWG site. Could add a simple PIN on
  Organizer tools if needed.
- Identity remembered per-device via localStorage key `roomie-name`.
- Page polls every 45s for fresh replies (paused while actively editing).
