# Familie-appen

Samler meldinger fra Spond, Skolemelding, Showbie og WhatsApp i én oversiktlig feed med AI-oppsummering.

## Prosjektstruktur

```
familieapp/
├── index.html       # Hele appen (én HTML-fil)
├── app.js           # Logikk: feed, swipe, filtrering, state
├── manifest.json    # PWA-konfig (legg til på hjemskjerm)
├── vercel.json      # Vercel-konfig
└── README.md
```

## Fase 1 – Deploy til Vercel (det du gjør nå)

### Steg 1: Lag GitHub-repo

1. Gå til github.com → "New repository"
2. Navn: `familieapp`
3. Gjør den **privat** (inneholder personlig data)
4. Ikke legg til README (du har allerede denne)
5. Klikk "Create repository"

### Steg 2: Push koden

```bash
cd familieapp
git init
git add .
git commit -m "første versjon – fase 1"
git branch -M main
git remote add origin https://github.com/DITT-BRUKERNAVN/familieapp.git
git push -u origin main
```

### Steg 3: Deploy på Vercel

1. Gå til vercel.com → logg inn med GitHub
2. Klikk "Add New Project"
3. Velg `familieapp`-repoet ditt
4. **Framework Preset**: velg "Other" (ikke Next.js)
5. **Root Directory**: la stå tom (`.`)
6. Klikk "Deploy"

Vercel gir deg en URL som `familieapp-abc123.vercel.app` – åpne den på telefonen.

### Steg 4: Legg til på hjemskjermen (iPhone)

1. Åpne appen i Safari (må være Safari, ikke Chrome)
2. Trykk på del-ikonet (firkant med pil opp)
3. Scroll ned og trykk "Legg til på Hjem-skjerm"
4. Gi den navnet "Familie" → trykk "Legg til"

Appen vises nå som et ikon på hjemskjermen og åpnes uten adresselinje – akkurat som en native app.

---

## Fase 2 – Backend med Spond (kommer)

En Python-backend som:
- Logger inn på Spond og henter meldinger automatisk
- Kjører på Railway.app
- Webappen henter data fra backend-API istedenfor hardkodet data

## Fase 3 – Skolemelding og Showbie (kommer)

Web scraping for skoleplattformene.

## Fase 4 – AI-filtrering med Claude (kommer)

- Automatisk TL;DR-generering
- Lærer av hva du markerer som relevant
