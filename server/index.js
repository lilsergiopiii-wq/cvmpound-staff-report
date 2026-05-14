import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { WebClient } from '@slack/web-api';
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

let slackWebClient = null;
function getSlackWebClient() {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) return null;
  if (!slackWebClient) slackWebClient = new WebClient(token);
  return slackWebClient;
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
    const slackToken = process.env.SLACK_BOT_TOKEN?.trim();
    const slackChannelId = process.env.SLACK_CHANNEL_ID?.trim();
    const shot = pickReportScreenshotBuffer(req.files);

    if (slackToken && slackChannelId) {
      if (shot?.length) {
        slack.attempted = true;
        const client = getSlackWebClient();
        try {
          await client.files.uploadV2({
            channel_id: slackChannelId,
            file: shot,
            filename: `staff-report-${completedReport.date}.png`,
            title: `Staff report ${completedReport.date}`,
            alt_text: 'CVMPOUND staff report screenshot',
            initial_comment: `Staff report submitted for ${completedReport.date}.`
          });
          slack.ok = true;
          slack.message = '';
        } catch (err) {
          slack.ok = false;
          slack.message = err?.data?.error || err?.message || 'Slack upload failed.';
        }
      }
    } else if (slackToken || slackChannelId) {
      slack.attempted = true;
      slack.ok = false;
      slack.message = 'Slack: set both SLACK_BOT_TOKEN and SLACK_CHANNEL_ID.';
    } else {
      slack.message = 'Slack not configured.';
    }

    res.json({ ok: true, report: completedReport, slack });
  } catch (error) {
    res.status(500).json({ error: 'Unable to submit report.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CVMPOUND Staff Report server listening on 0.0.0.0:${PORT}`);
});
