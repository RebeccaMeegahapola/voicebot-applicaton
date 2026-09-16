# Doctor Booking Voicebot

A multilingual voice assistant for booking a doctor's appointment, built as a
technical assignment. Speak or type naturally, in any of six languages, and
the assistant collects the doctor, hospital, date, and time — enforcing that
appointments can only be booked Monday–Friday.

**Live demo:** https://voicebot-applicaton.vercel.app/booking

## Features

- **Voice in, voice out** — uses the browser's built-in Web Speech API for
  speech recognition and text-to-speech, so no external voice service is
  required.
- **Six languages** — English, Sinhala, French, Chinese, Greek, and
  Italian. One language picker controls both what the assistant listens for
  and what language it replies in.
- **Weekdays only** — the assistant is instructed never to accept a weekend
  date, and this is independently re-checked in server-side code, so a
  Saturday/Sunday booking can never slip through even if the model errs.
- **Structured booking state** — alongside its natural-language reply, the
  assistant returns a small JSON object (doctor, hospital, date, time,
  status) which drives a live "appointment ticket" summary in the UI.
- **Graceful language fallback** — if the browser has no voice installed for
  a selected language (common for Sinhala), the assistant's reply is shown
  as text instead of spoken aloud, and the user can always type instead of
  using the microphone.

## How it works

| Piece | What it does |
|---|---|
| `src/components/VoiceBooking.tsx` | The client UI — language picker, mic button, conversation view, appointment ticket. |
| `src/app/api/booking-agent/route.ts` | The one server route that talks to the Gemini API. Builds a system prompt (clinic role, doctor list, weekday rule, target language), sends the conversation, and parses a JSON block out of the model's reply. |
| `src/data/doctors.json` | Mock clinic data — 4 doctors, their specialty, hospital, and available weekday time slots. |
| `src/data/languages.ts` | The six supported languages, their BCP-47 codes (for speech recognition/synthesis), and their identity colors in the UI. |

**Why an LLM instead of per-language logic:** rather than writing separate
intent-parsing code for six languages, a single prompt tells the model to
always reply in whichever language the user is speaking. This collapses the
"multilingual" requirement into one system prompt instead of six parallel
pipelines.

**Why the weekday check happens twice:** the prompt instructs the model to
refuse weekend requests, but the code never trusts that alone — every date
the model returns is re-validated server-side (`getDay() === 0 || 6`) before
being treated as a real booking.

## Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- Google Gemini API (`gemini-3.5-flash-lite`) — free tier, no billing required
- Web Speech API (browser-native, no external STT/TTS service)
- Deployed on Vercel

## Known limitation

Browser support for Sinhala speech recognition and text-to-speech is
inconsistent across browsers and devices. The app detects this automatically
— if no matching voice is available, the assistant's reply is shown as text
rather than silently failing, and typing is always available as a fallback
input method. This is a browser platform limitation, not a gap in the
booking logic itself.

## Running it locally

```bash
npm install
cp .env.local.example .env.local   # add a free Gemini API key from https://aistudio.google.com/apikey
npm run dev
```

Then open `http://localhost:3000` (redirects to `/booking`).

## Trying it out

Pick a language, tap the mic (or type), and say something like:

> "I'd like to see a dentist next Tuesday at 2pm."

The assistant will confirm the doctor, hospital, date, and time as it
collects them, and will refuse/redirect if you ask for a Saturday or Sunday.
