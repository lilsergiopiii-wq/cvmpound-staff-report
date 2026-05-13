import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;
const REPORT_FILE = path.join(__dirname, '..', 'data', 'reports.json');

const allowedOrigins = new Set([
  'http://localhost:5173',
  'https://cvmpound-staff-report.vercel.app'
]);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  if (/^https:\/\/.+\.vercel\.app$/i.test(origin)) return true;
  return false;
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) callback(null, true);
    else callback(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '2mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

/** Short-lived PNG buffers for Slack image_url (Slack fetches this URL after the webhook is posted). */
const reportScreenshotCache = new Map();

function purgeExpiredScreenshots() {
  const now = Date.now();
  const ttlMs = 20 * 60 * 1000;
  for (const [id, entry] of reportScreenshotCache) {
    if (now - entry.created > ttlMs) reportScreenshotCache.delete(id);
  }
}

async function ensureReportFile() {
  try {
    await fs.access(REPORT_FILE);
  } catch {
    await fs.mkdir(path.dirname(REPORT_FILE), { recursive: true });
    await fs.writeFile(REPORT_FILE, JSON.stringify([], null, 2));
  }
}

async function readReports() {
  await ensureReportFile();
  const raw = await fs.readFile(REPORT_FILE, 'utf-8');
  return JSON.parse(raw || '[]');
}

async function writeReports(reports) {
  await fs.writeFile(REPORT_FILE, JSON.stringify(reports, null, 2));
}

function formatUncheckedHourly(report) {
  const missing = [];
  for (const task of report.hourlyTasks || []) {
    const uncheckedTimes = [];
    for (const time of report.hourlyTimes || []) {
      if (!report.hourlyChecks?.[task]?.[time]) uncheckedTimes.push(time);
    }
    if (uncheckedTimes.length) missing.push(`• ${task}: ${uncheckedTimes.join(', ')}`);
  }
  return missing.length ? missing.join('\n') : 'All hourly checks completed.';
}

function sectionComplete(report, sectionName, tasks) {
  return tasks.every((task) => Boolean(report[sectionName]?.[task]));
}

function formatReminderStatuses(report) {
  return (report.reminderTasks || [])
    .map((task) => `• ${task}: ${report.reminders?.[task] ? 'Checked' : 'Unchecked'}`)
    .join('\n');
}

function buildSlackMessage(report, imageBlock) {
  const openingComplete = sectionComplete(report, 'opening', report.openingTasks || []);
  const closingComplete = sectionComplete(report, 'closing', report.closingTasks || []);
  const submitter = report.signoffs?.mid || report.signoffs?.am || report.signoffs?.pm || 'Staff';
  const submittedTime = new Date(report.submittedAt).toLocaleString();

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'CVMPOUND Staff Report Submitted' }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `Report submitted by ${submitter} at ${submittedTime}` }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Unchecked Hourly Tasks*\n${formatUncheckedHourly(report)}`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Opening Checks:* ${openingComplete ? 'Complete' : 'Incomplete'}\n*Closing Checks:* ${closingComplete ? 'Complete' : 'Incomplete'}`
      }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Reminders*\n${formatReminderStatuses(report)}` }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Items Ordered*\n${report.itemsOrdered?.trim() || 'None'}` },
        { type: 'mrkdwn', text: `*Notes*\n${report.notes?.trim() || 'None'}` }
      ]
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Shift Sign-Offs*\n• AM: ${report.signoffs?.am || 'Not signed'}\n• Mid: ${report.signoffs?.mid || 'Not signed'}\n• PM: ${report.signoffs?.pm || 'Not signed'}`
      }
    }
  ];
  if (imageBlock) blocks.push(imageBlock);

  return {
    text: `CVMPOUND Staff Report Submitted`,
    blocks
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/reports', async (req, res) => {
  try {
    const reports = await readReports();
    const summaries = reports
      .map((report) => ({ date: report.date, submittedAt: report.submittedAt, locked: report.locked }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    res.json(summaries);
  } catch (error) {
    res.status(500).json({ error: 'Unable to load reports.' });
  }
});

app.get('/api/report-screenshots/:id', (req, res) => {
  purgeExpiredScreenshots();
  const entry = reportScreenshotCache.get(req.params.id);
  if (!entry) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-store');
  res.send(entry.buffer);
});

app.get('/api/reports/:date', async (req, res) => {
  try {
    const reports = await readReports();
    const report = reports.find((item) => item.date === req.params.date);
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Unable to load report.' });
  }
});

app.post('/api/reports', (req, res, next) => {
  if (req.is('multipart/form-data')) {
    upload.single('screenshot')(req, res, next);
  } else {
    next();
  }
}, async (req, res) => {
  try {
    let report = req.body;
    if (typeof req.body?.report === 'string') {
      try {
        report = JSON.parse(req.body.report);
      } catch {
        return res.status(400).json({ error: 'Invalid report JSON.' });
      }
    }
    if (!report?.date) return res.status(400).json({ error: 'Report date is required.' });

    const completedReport = {
      ...report,
      locked: true,
      submittedAt: report.submittedAt || new Date().toISOString()
    };

    const reports = await readReports();
    const existingIndex = reports.findIndex((item) => item.date === completedReport.date);

    if (existingIndex >= 0) reports[existingIndex] = completedReport;
    else reports.push(completedReport);

    await writeReports(reports);

    let slack = { attempted: false, ok: true, message: 'Slack webhook not configured.' };
    if (process.env.SLACK_WEBHOOK_URL) {
      slack.attempted = true;

      let imageBlock = null;
      const shot = req.file?.buffer;
      if (shot?.length) {
        purgeExpiredScreenshots();
        const id = crypto.randomBytes(16).toString('hex');
        reportScreenshotCache.set(id, { buffer: shot, created: Date.now() });
        const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
        const proto = forwardedProto || req.protocol;
        const host = req.get('host');
        const base = (process.env.PUBLIC_BASE_URL || `${proto}://${host}`).replace(/\/$/, '');
        imageBlock = {
          type: 'image',
          title: { type: 'plain_text', text: `Report ${completedReport.date}` },
          image_url: `${base}/api/report-screenshots/${id}`,
          alt_text: 'Staff report screenshot'
        };
      }

      const slackResponse = await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSlackMessage(completedReport, imageBlock))
      });

      slack.ok = slackResponse.ok;
      slack.message = slackResponse.ok ? 'Posted to Slack.' : `Slack returned ${slackResponse.status}.`;
    }

    res.json({ ok: true, report: completedReport, slack });
  } catch (error) {
    res.status(500).json({ error: 'Unable to submit report.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CVMPOUND Staff Report server listening on 0.0.0.0:${PORT}`);
});
