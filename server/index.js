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
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 4
  }
});

/** Field names allowed for the PNG upload (canonical first; others for older clients). */
const REPORT_IMAGE_FIELD_NAMES = ['reportScreenshot', 'screenshot', 'screenshot_hourly', 'screenshot_below'];

const uploadReportMultipart = upload.fields(
  REPORT_IMAGE_FIELD_NAMES.map((name) => ({ name, maxCount: 1 }))
);

function pickReportScreenshotBuffer(files) {
  if (!files) return null;
  for (const name of REPORT_IMAGE_FIELD_NAMES) {
    const file = files[name]?.[0];
    if (file?.buffer?.length) return file.buffer;
  }
  return null;
}

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
    uploadReportMultipart(req, res, next);
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

    let slack = { attempted: false, ok: true, message: '' };
    if (process.env.SLACK_WEBHOOK_URL) {
      let imageBlock = null;
      const shot = pickReportScreenshotBuffer(req.files);
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
          image_url: `${base}/api/report-screenshots/${id}`,
          alt_text: 'Staff report'
        };
      }

      if (imageBlock) {
        slack.attempted = true;
        const slackResponse = await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: '\u200b',
            blocks: [imageBlock]
          })
        });

        slack.ok = slackResponse.ok;
        slack.message = slackResponse.ok ? '' : `Slack returned ${slackResponse.status}.`;
      }
    }

    res.json({ ok: true, report: completedReport, slack });
  } catch (error) {
    res.status(500).json({ error: 'Unable to submit report.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CVMPOUND Staff Report server listening on 0.0.0.0:${PORT}`);
});
