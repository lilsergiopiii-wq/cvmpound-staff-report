# CVMPOUND Daily Staff Report

A full-stack React + Node/Express app that replaces CVMPOUND's paper staff report binder.

## Features

- Paper-form style daily staff report
- Auto-filled date with manual override
- Hourly check grid using only the exact paper form times: 5AM, 6AM, 7AM, 8AM, 9AM, 10AM, 11AM, 12PM, 2PM, 4PM, 6PM, 8PM, 10PM
- 6-hour checks at 11AM, 5PM, and 11PM
- Opening checks, closing checks, reminders, items ordered, notes, and shift sign-offs
- Check All and Uncheck All per section
- Global Check All Sheet and Uncheck All Sheet
- Auto-save to localStorage every 30 seconds and on change
- Restore today's draft automatically
- Warns before leaving with unsaved changes
- Submit and lock report to prevent accidental edits
- Saves submitted reports to backend JSON storage
- Report history lookup by date
- Optional Slack webhook integration
- Print/PDF friendly layout
- Mobile responsive with horizontal scrolling grids

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Then open:

```text
http://localhost:5173
```

The backend runs on:

```text
http://localhost:3001
```

## Slack Webhook Setup

1. Create a Slack Incoming Webhook in your Slack workspace.
2. Copy the webhook URL.
3. Paste it into `.env`:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

If the webhook is blank or invalid, the report will still save locally to the backend, but Slack posting will be skipped or return an error.

## Printing or Saving as PDF

Use the `Print / PDF` button after filling out the report. In the print window, choose `Save as PDF` if you want a PDF copy.

## Report History

Submitted reports are saved in:

```text
data/reports.json
```

Managers can use the report history date field inside the app to pull up a submitted report.

## Notes

No authentication is included yet. This is intentionally simple for the first version.
