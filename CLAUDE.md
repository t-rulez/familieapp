# CLAUDE.md – familieapp (frontend)

Instruksjoner og kontekst for Claude Code i dette repoet. Les også `CLAUDE.md` i
søsterrepoet `familieapp-backend` når en oppgave berører API-et.

## Om prosjektet

**Brief** er en privat, AI-drevet familieassistent for én familie. Den samler meldinger fra
Spond, Showbie, Skoleplattform (e-post), WhatsApp og iCloud-kalender, og lar brukeren spørre
Claude om hva som skjer. Eieren har ikke kodebakgrunn. Appen ble opprinnelig laget i vanlig
Claude-chat, der filer ble lastet opp til GitHub for hånd. Nå brukes Claude Code.

Familien: **Gustav**, **Rasmus** (barn), **Kristin** og **Truls** (foreldre). Navnene er
hardkodet i ukeplanen (`PEOPLE` og `AVATARS` i `uke.js`, og fargene `--p-<navn>` i `uke.html`).

## Arkitektur

Ren statisk PWA uten byggesteg og uten rammeverk: vanilla HTML/CSS/JS.

| Fil | Hva |
|---|---|
| `index.html` + `app.js` | Hovedappen «Brief»: meldingsfeed med sveip (lest/hopp over), filtre, søk, AI-chat, statistikk, innstillinger (kilder, WhatsApp-QR, push, kveldsoppsummering) |
| `uke.html` + `uke.js` | **Ukeplanen** («Ukeoversikt»): tabell mandag–søndag × familiemedlem, varmepanel (home-control) og vær. Laget først for iPad, nå også for mobil |
| `sw.js` | Service worker, **kun** for push-varsler. Cacher ikke sider, så nye deploys vises ved omlasting |
| `manifest.json` | PWA-manifest for hovedappen (start `/`) |
| `vercel.json` | Rewrites: `/uke` → `uke.html`, alt annet → `index.html` |

- **Hosting:** Vercel, deployes fra `main`.
  - Hovedappen: https://briefmessages.vercel.app
  - Ukeplanen: https://briefmessages.vercel.app/uke
- **Backend:** `https://familieapp-backend.up.railway.app` (FastAPI på Railway). Kan overstyres med
  `localStorage.api_url`.
- **Auth:** JWT i `localStorage.auth_token` (+ `auth_user`), sendt som `Authorization: Bearer`.
- **localStorage-nøkler i ukeplanen:** `uke_theme` (fargetema) og `uke_font_scale` (A−/A+).

## Ukeplanen (`uke.html` / `uke.js`)

Mest aktive del av appen. Viktige mekanismer:

- **Data:** `GET /ai/week-overview?week_offset=0|1[&refresh=true]` gir `{week_start, week_end,
  week_number, days:[{day, date, people:{Navn:{skole:[...], annet:[...]}}}]}`. Elementene er
  strenger, ofte med emoji og klokkeslett først («🏑 17:50 Trening is GB»).
  `GET /weather/week` gir `{days:[{date, emoji, temp_max}]}`.
- **Tidsjustering:** «annet»-elementer med omtrent samme klokkeslett (halvtimes-bøtter) legges i
  samme underrad på tvers av personer. En dag kan derfor bestå av flere `<tr>`-underrader, som
  vises som én avrundet blokk (`day-start`/`day-end`).
- **Én skjerm, ingen scrolling:** `layoutTable()` = `distributeExtraHeight()` (strekker radene
  når det er ledig plass) + `fitTableToScreen()` (krymper med `transform: scale` og kompenserer
  bredden). Skalaen finnes med **binærsøk**, fordi tabellen blir lavere når den gjøres bredere og
  teksten brytes mindre. På mobil krympes den aldri under `MOBILE_MIN_SCALE` (0,6). Trengs mer
  plass, scroller tabellen.
- **Tekststørrelse:** All tekst bruker `calc(Npx * var(--fs))`. `--fs` settes av A−/A+
  (0,8–1,6). Kall `layoutTable()` etter endringer som påvirker høyden.
- **Visninger (CSS):** standard (iPad stående/PC), `@media (orientation:landscape) and
  (min-width:700px)` (liggende iPad), og `@media (max-width:620px)` (stående telefon: samme tabell,
  bare strammere, med varmepanelet som vannrett stripe under).
- **Fargetemaer:** `body.theme-<navn>`, som bare overstyrer CSS-variabler. Velgeren står i headeren.
- **Font:** Ukeplanen bruker **Plus Jakarta Sans** (`--font`). Hovedappen (`index.html`) bruker
  bevisst fortsatt DM Sans. Ikke endre den uten at eieren ber om det.
- **Typografi:** Klokkeslettet først i en aktivitet markeres med `displayItemText()` som
  `<span class="t">`, i fet skrift med like brede siffer. Skole-linjene skal **ikke** ha kursiv.
- **iOS-hjemskjerm-app:** Siden har egne Apple-meta-tagger
  (`black-translucent` + `viewport-fit=cover`) og tegnes derfor under statuslinjen. Dette krever:
  - `env(safe-area-inset-top)` som luft på toppen (mobil-CSS).
  - `setAppHeight()`: iOS regner `100dvh` som skjermen *minus* statuslinjen i standalone-modus.
    Derfor settes `--app-h` til `screen.height` når `navigator.standalone` er satt.
- **Ingen værkreditering.** Krediteringen (MET Norway) ble fjernet 20.11.2026. Eieren vil ikke
  ha den og har akseptert risikoen ved avviket fra CC BY 4.0-vilkårene. Ikke legg den tilbake og
  ikke foreslå det.
- **Auto-oppdatering er bevisst bare på klientsiden** (`AUTO_REFRESH_HOURS_*`): kl. 07, 16, 18,
  20 og 22, og i tillegg kl. 12 i helgene. Eieren har uttrykkelig takket nei til en cron-jobb på
  serveren. Det er kjent og akseptert at oppdateringen bare skjer mens siden er åpen, at timerne
  pauses når iPaden sover, og at de retter seg selv når den våkner. Hver oppdatering koster tokens
  (`refresh=true`). Vanlig bytte mellom uker er gratis (cache i backend).
- **Varmepanelet:**
  - Den vertikale slideren **må** bruke `transform: rotate(-90deg)`, med eksplisitt bredde før
    rotasjonen som matcher containerens faste høyde. `writing-mode: vertical-lr` ser riktig ut i
    Chromium, men kollapset til en sirkel på ekte iPad.
  - Adax tåler bare én skriving per 30 sekunder. Derfor sendes `PUT` bare på sliderens `change`
    (når den slippes), aldri på `input` (mens den dras). Statusteksten sier «Sendt», ikke
    «Ferdig», fordi Adax kan bruke 1–10 minutter på å faktisk endre seg.
  - Frakoblet-ikonet er en egen inline-SVG, ikke emoji. Det finnes ingen emoji for «wifi med strek
    over», og kombinerende tegn er upålitelige på iPad.
  - Varmestyringen er **HomeControl**, eierens egen separate løsning (repo `t-rulez/home-control`,
    ikke del av Brief). Ukeplanen styrer den bare via backend-proxyen `/heating/*`. Varme-tokenet går
    aldri gjennom frontend. Endringer i selve ovnslogikken hører hjemme i HomeControl. Repoet kan
    legges til i økten ved behov.

## Enheter som brukes

- **iPad** (stående og liggende), som veggskjerm for ukeplanen.
- **iPhone 16 Pro**, med ukeplanen lagt til på hjemskjermen («Legg til på Hjem-skjerm»).
  Skjerm 402×874 pt, statuslinje ca. 62 pt, hjemlinje ca. 34 pt.

## Testing

Det finnes ingen testsuite. Verifiser UI-endringer med Playwright (forhåndsinstallert) mot
`file:///…/uke.html`, med mocket API:

- `page.route(/railway\.app/, …)` for å svare med falske data for `week-overview`, `weather`
  og `heating/*`.
- `addInitScript` for å sette `localStorage.auth_token` (og eventuelt `navigator.standalone`).
- Bruk realistiske, tunge data. Den ekte uken har mange skole-linjer med emoji som brytes over
  flere linjer.
- Test minst iPhone 16 Pro (hjemskjerm, 402×874), en mindre iPhone i Safari-høyde og iPad.
- Sjekk syntaks med `node --check uke.js`.

Ekte telefon og Vercel-domenet kan ikke nås fra Claude Code-miljøet. Be eieren sjekke på
enheten, og eieren sender gjerne skjermbilder.

## Arbeidsflyt og preferanser

- **Språk:** norsk i svar, commit-meldinger, PR-er og kodekommentarer (kodebasen er kommentert
  på norsk).
- **Bekreft logikken før du koder** alt som ikke er trivielt. Eieren vil se resonnementet og
  planen først, ikke bare en ferdig endring.
- **Eieren er ikke utvikler.** Forklar kort og konkret hva som er endret, og hva eieren bør sjekke
  på telefonen eller iPaden. Si alltid tydelig om en endring gjelder frontend (Vercel) eller
  backend (Railway).
- **Verifiser før levering.** Les tilbake det du har endret og test logikken isolert. Før Claude
  Code var hver feilgjetning en treg, manuell runde. Med Claude Code er runden: commit →
  PR/merge → automatisk deploy → «Oppdater» på iPaden.
- **Flyt:** utvikle på oppgitt branch → commit → push → spør om PR og merge. Når eieren sier
  «ja»: lag PR mot `main` og **squash-merge**. Vercel deployer deretter automatisk.
- Etter en squash-merge startes branchen på nytt fra `origin/main`. Force-push er ikke tillatt.
  Merge derfor inn den gamle remote-branchen og behold egen versjon (`git checkout --ours`) før
  push.
- **Hemmeligheter** (tokens, API-nøkler) skal aldri gjennom frontend eller chat. Blir et token
  delt i chat, skal det byttes.
- Spør før du endrer på ting eieren ikke har bedt om.

## Økter og CLAUDE.md (gjelder alle økter)

- **Hold `CLAUDE.md` oppdatert.** Når en oppgave er ferdig, og før du foreslår PR, skal du
  vurdere om noe fra økten bør inn i `CLAUDE.md`. Det gjelder nye beslutninger, ting som er prøvd
  og forkastet, fallgruver, preferanser og endret oppførsel. Foreslå konkret hva som bør legges
  til eller endres, og ta det med i samme PR hvis eieren sier ja. Si også fra hvis ingenting bør
  endres. `CLAUDE.md` oppdateres ikke av seg selv, og det som bare står i chatten, forsvinner når
  økten er ferdig.
- **Én økt per oppgave eller tema.** Tittelen skal ha formatet `Brief – <tema>`, og økten skal
  ha etiketten `brief`. Velg begge repoene (`familieapp` og `familieapp-backend`) når økten
  starter.
- **Parallelle økter:** hver økt har sin egen branch. Unngå at to økter endrer samme fil samtidig,
  for eksempel `uke.html`, fordi det gir merge-konflikter.
