# Brief Messages

En AI-drevet familieassistent som samler meldinger fra Spond, Showbie, WhatsApp, Skoleplattform og iCloud Kalender – og lar deg spørre om hva som skjer i familien.

Appen er bygget som en PWA (Progressive Web App) med en Python-backend. Den ble utviklet uten kodebakgrunn ved hjelp av Claude AI.

---

## Arkitektur

```
familieapp/          → Frontend (PWA) – deployes på Vercel
familieapp-backend/  → Backend (FastAPI/Python) – deployes på Railway
whatsapp-service/    → WhatsApp-tjeneste (Node.js/Baileys) – deployes på Railway
```

**Datakilder:**
- **Spond** – arrangementer, gruppe-innlegg og klubbmeldinger (via Spond API)
- **Showbie** – ukeplaner, oppgaver og kommentarer (via reverse-engineered API + Claude Vision)
- **Skoleplattform** – skolemeldinger (via IMAP e-post + PDF-ekstraksjon)
- **WhatsApp** – gruppemelding (via Baileys/WhatsApp Web)
- **iCloud Kalender** – familieavtaler (via CalDAV)

---

## Krav

- **Vercel**-konto (gratis) for frontend
- **Railway**-konto for backend og database
- **PostgreSQL**-database (via Railway)
- **Claude API-nøkkel** fra [console.anthropic.com](https://console.anthropic.com) – én per bruker
- **Resend**-konto (gratis) for e-postsending (glemt passord)
- **VAPID-nøkler** for push-varsler (generer med `pywebpush`)

---

## Oppsett

### 1. Database (Railway PostgreSQL)

Opprett en PostgreSQL-database på Railway. `DATABASE_URL` settes automatisk som miljøvariabel.

Tabellene opprettes automatisk ved første oppstart av backend.

### 2. Backend (Railway)

Klon `familieapp-backend/` og deploy til Railway.

**Miljøvariabler som må settes:**

| Variabel | Beskrivelse |
|---|---|
| `DATABASE_URL` | PostgreSQL-tilkobling (settes automatisk av Railway) |
| `JWT_SECRET` | Tilfeldig streng for token-signering |
| `ENCRYPTION_KEY` | Tilfeldig streng for kryptering av passord (base64, 32 bytes) |
| `VAPID_PUBLIC_KEY` | VAPID public key for push-varsler |
| `VAPID_PRIVATE_KEY` | VAPID private key for push-varsler |
| `VAPID_EMAIL` | E-postadresse for VAPID |
| `RESEND_API_KEY` | API-nøkkel fra resend.com for e-postsending |
| `ANTHROPIC_API_KEY` | Fallback Claude API-nøkkel (valgfri – brukere kan legge inn sin egen) |

**Generer VAPID-nøkler:**
```bash
pip install pywebpush
python3 -c "from pywebpush import Vapid; v = Vapid(); v.generate_keys(); print('Public:', v.public_key); print('Private:', v.private_key)"
```

**Generer ENCRYPTION_KEY:**
```bash
python3 -c "import secrets, base64; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
```

### 3. Frontend (Vercel)

Klon `familieapp/` og deploy til Vercel. Ingen miljøvariabler kreves – backend-URL settes i appen under innlogging.

### 4. WhatsApp-tjeneste (Railway)

Klon `whatsapp-service/` (Node.js) og deploy til Railway som en separat tjeneste.

Scan QR-koden som vises i loggene med WhatsApp-appen din.

URL-en til tjenesten legges inn per bruker under **Innstillinger → WhatsApp**.

---

## Integrasjoner

### Spond
Krever Spond-brukernavn og passord. Legges inn under **Innstillinger → Spond**.

### Showbie
Krever token og fingerprint fra Showbie-nettlesersesjonen.

**Hent token** (kjør i Chrome DevTools Console på showbie.com):
```javascript
const s=JSON.parse(localStorage.getItem('ember_simple_auth-session'));
const a=s.authenticated;
const fp=document.cookie.match(/sbe-device-uuid=([^;]+)/)?.[1]||'';
const exp=JSON.parse(atob(a.requestToken.split('.')[1])).exp;
console.log(a.token+'|'+a.user+'|'+fp+'|'+exp)
```

**Hent barn-IDer** (naviger til hvert barns mappe i Showbie, kjør):
```javascript
const ids=performance.getEntriesByType('resource')
  .filter(r=>r.name.includes('eu.showbie.com/core/v5/users/')&&r.name.includes('/assignments'))
  .map(r=>r.name.match(/users\/([a-f0-9]{40})/)?.[1])
  .filter((v,i,a)=>v&&a.indexOf(v)===i);
console.log('Barn-IDer:',ids.join(','))
```

Legges inn under **Innstillinger → Showbie**.

### Skoleplattform (e-post)
Skoleplattform sender meldinger via e-post fra `noreply@info.skoleplattform.no`. Sett opp IMAP-tilkobling under **Innstillinger → Skolemelding** med filter på denne avsenderadressen. PDF-vedlegg leses automatisk.

### iCloud Kalender
Krever CalDAV-URL, Apple ID og app-spesifikt passord (generer på appleid.apple.com).

CalDAV-URL: `https://caldav.icloud.com`

Legges inn under **Innstillinger → Kalender**.

### Claude API-nøkkel
Hver bruker legger inn sin egen API-nøkkel under **Innstillinger → AI-innstillinger → Claude API-nøkkel**. Nøkkelen lagres kryptert i databasen.

---

## Registrering av ny bruker

1. Gå til appen og velg "Registrer deg"
2. Fyll inn navn, e-post og passord
3. Logg inn og konfigurer integrasjoner under Innstillinger
4. Legg inn Claude API-nøkkel under AI-innstillinger
5. Trykk "Lagre innstillinger" og deretter synk-knappen

---

## Funksjoner

- **Feed** – samler meldinger fra alle kilder, sortert etter relevans
- **AI-assistent** – still spørsmål om hva som skjer (f.eks. "Hva er leksene denne uken?")
- **Kveldsvarsel** – push-notifikasjon kl. 20:00 med morgendagens oversikt
- **AI-scoring** – automatisk prioritering av meldinger
- **PDF-tolkning** – Claude Vision leser PDF-er fra Showbie og e-post
- **Statistikk** – oversikt over meldingsvolum og API-forbruk

---

## Tips til utviklere

- Railway-loggene er din beste venn ved feilsøking – kopier feilmeldingen rett til Claude
- Deploy tidlig og ofte – test i produksjon underveis
- Chrome DevTools Network-fane avslører API-kall og tokens i nettleseren (brukt for Showbie)
- Showbie-token er gyldig i ~6 måneder og må fornyes manuelt

---

## Teknisk stack

| Komponent | Teknologi |
|---|---|
| Frontend | HTML, CSS, JavaScript (PWA) |
| Backend | Python, FastAPI, asyncpg |
| Database | PostgreSQL |
| AI | Anthropic Claude (Sonnet) |
| Push | Web Push / VAPID |
| Hosting | Vercel (frontend), Railway (backend + DB) |
| WhatsApp | Node.js, Baileys |
| Kalender | CalDAV (iCloud) |
| E-post | IMAP (aiosmtplib) |
| PDF | pypdf |

---

## Lisens

Personlig prosjekt – bruk gjerne til inspirasjon.
