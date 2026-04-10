const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Fjern Chromium-låsefiler fra forrige kjøring
const authPath = '/app/.wwebjs_auth';
try {
  const lockFiles = [
    path.join(authPath, 'SingletonLock'),
    path.join(authPath, 'SingletonCookie'),
    path.join(authPath, 'SingletonSocket'),
  ];
  // Søk rekursivt etter låsefiler
  function removeLocks(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        removeLocks(fullPath);
      } else if (['SingletonLock','SingletonCookie','SingletonSocket','lockfile'].includes(entry.name)) {
        fs.unlinkSync(fullPath);
        console.log('Fjernet låsefil:', fullPath);
      }
    });
  }
  removeLocks(authPath);
} catch (e) {
  console.log('Låsefil-rydding:', e.message);
}

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-token');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── Konfig fra miljøvariabler ────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL;       // Python-backenden din
const API_TOKEN = process.env.API_TOKEN;           // Samme token som i backenden
const CATEGORY = process.env.WA_CATEGORY || 'whatsapp';
const SOURCE_LABEL = process.env.WA_SOURCE_LABEL || 'WhatsApp';

// Filtrering – kommaseparerte gruppenavn (tom = alle grupper)
// Eks: "Fotball 8år,Foreldregruppe 3B"
const GROUP_FILTER = process.env.WA_GROUP_FILTER
  ? process.env.WA_GROUP_FILTER.split(',').map(g => g.trim().toLowerCase())
  : [];

// ─── State ────────────────────────────────────────────────────────────────────

let qrCodeData = null;       // QR-kode som base64 PNG
let clientReady = false;
let lastMessage = null;

// ─── WhatsApp-klient ──────────────────────────────────────────────────────────

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '/app/.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process'
    ]
  }
});

client.on('qr', async (qr) => {
  console.log('QR-kode generert – åpne /qr i appen for å scanne');
  qrCodeData = await qrcode.toDataURL(qr);
  clientReady = false;
});

client.on('ready', () => {
  console.log('WhatsApp tilkoblet og klar!');
  clientReady = true;
  qrCodeData = null;
});

client.on('disconnected', (reason) => {
  console.log('WhatsApp koblet fra:', reason);
  clientReady = false;
});

client.on('message', async (msg) => {
  try {
    // Bare gruppemeldinger
    if (!msg.from.endsWith('@g.us')) return;

    const chat = await msg.getChat();
    const groupName = chat.name || '';

    // Filtrer på gruppenavn hvis konfigurert
    if (GROUP_FILTER.length > 0) {
      const match = GROUP_FILTER.some(f => groupName.toLowerCase().includes(f));
      if (!match) return;
    }

    const contact = await msg.getContact();
    const senderName = contact.pushname || contact.name || msg.from.split('@')[0];
    const body = msg.body?.trim();

    if (!body) return;

    console.log(`Melding fra ${groupName} (${senderName}): ${body.substring(0, 60)}...`);

    lastMessage = { group: groupName, sender: senderName, body, time: new Date().toISOString() };

    // Send til Python-backenden
    if (BACKEND_URL) {
      await forwardToBackend(msg, chat, senderName, groupName, body);
    }

  } catch (err) {
    console.error('Feil ved behandling av melding:', err.message);
  }
});

// ─── Videresend til Python-backend ────────────────────────────────────────────

async function forwardToBackend(msg, chat, senderName, groupName, body) {
  const msgId = `wa-${msg.id._serialized}`;
  const tldr = body.length > 120 ? body.substring(0, 117) + '...' : body;

  const payload = {
    messages: [{
      id: msgId,
      source: 'whatsapp',
      sourceLabel: SOURCE_LABEL,
      category: CATEGORY,
      title: `${groupName}: ${senderName}`,
      tldr,
      body,
      time: 'nå nettopp',
      timestamp: new Date().toISOString(),
      priority: 'medium',
      status: 'unread',
      meta: {
        group: groupName,
        sender: senderName,
        phone: msg.from
      }
    }]
  };

  const res = await fetch(`${BACKEND_URL}/messages/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-token': API_TOKEN || ''
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    console.error(`Backend svarte ${res.status}:`, await res.text());
  } else {
    console.log(`Melding sendt til backend: ${msgId}`);
  }
}

// ─── HTTP-endepunkter ─────────────────────────────────────────────────────────

// Helsestatus
app.get('/', (req, res) => {
  res.json({
    status: clientReady ? 'connected' : qrCodeData ? 'awaiting_scan' : 'initializing',
    ready: clientReady,
    hasQr: !!qrCodeData,
    lastMessage: lastMessage ? {
      group: lastMessage.group,
      time: lastMessage.time
    } : null
  });
});

// QR-kode som JSON (for appen)
app.get('/qr-data', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (clientReady) {
    return res.json({ ready: true, image: null });
  }
  if (!qrCodeData) {
    return res.json({ ready: false, image: null, message: 'Genererer QR-kode...' });
  }
  res.json({ ready: false, image: qrCodeData });
});

// QR-kode – åpnes i nettleseren for å scanne
app.get('/qr', (req, res) => {
  if (clientReady) {
    return res.send('<h2 style="font-family:sans-serif;color:green">✓ WhatsApp er tilkoblet!</h2>');
  }
  if (!qrCodeData) {
    return res.send('<h2 style="font-family:sans-serif">Genererer QR-kode... Last inn siden på nytt om noen sekunder.</h2><script>setTimeout(()=>location.reload(),3000)</script>');
  }
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Scan WhatsApp QR</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 20px; background: #f5f5f5; }
        img { max-width: 300px; border: 8px solid white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
        h2 { color: #333; }
        p { color: #666; }
      </style>
      <script>setTimeout(() => location.reload(), 20000)</script>
    </head>
    <body>
      <h2>Scan med WhatsApp</h2>
      <p>Åpne WhatsApp → Innstillinger → Tilkoblede enheter → Koble til enhet</p>
      <img src="${qrCodeData}" alt="QR-kode" />
      <p><small>Siden oppdateres automatisk</small></p>
    </body>
    </html>
  `);
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`WhatsApp-tjeneste startet på port ${PORT}`);
  console.log(`BACKEND_URL: ${BACKEND_URL || '(ikke satt)'}`);
  console.log(`Gruppefilter: ${GROUP_FILTER.length > 0 ? GROUP_FILTER.join(', ') : '(alle grupper)'}`);
});

client.initialize();
