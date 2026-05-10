import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;
const REPORT_FILE = path.join(__dirname, '..', 'data', 'reports.json');

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://cvmpound-staff-report.vercel.app'
  ],
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

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

function buildSlackMessage(report) {
  const openingComplete = sectionComplete(report, 'opening', report.openingTasks || []);
  const closingComplete = sectionComplete(report, 'closing', report.closingTasks || []);
  const submitter = report.signoffs?.mid || report.signoffs?.am || report.signoffs?.pm || 'Staff';
  const submittedTime = new Date(report.submittedAt).toLocaleString();

  return {
    text: `CVMPOUND Staff Report Submitted`,
    blocks: [
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
    ]
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

app.post('/api/reports', async (req, res) => {
  try {
    const report = req.body;
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
      const slackResponse = await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSlackMessage(completedReport))
      });

      slack.ok = slackResponse.ok;
      slack.message = slackResponse.ok ? 'Posted to Slack.' : `Slack returned ${slackResponse.status}.`;
    }

    res.json({ ok: true, report: completedReport, slack });
  } catch (error) {
    res.status(500).json({ error: 'Unable to submit report.' });
  }
});

app.listen(PORT, () => {
  console.log(`CVMPOUND Staff Report server running on http://localhost:${PORT}`);
});
