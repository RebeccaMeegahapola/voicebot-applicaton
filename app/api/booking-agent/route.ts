import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import doctors from "@/data/doctors.json";
import { AgentResponse, BookingState, ChatMessage } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// Human-readable language names help the model reply in the right language
// without us needing separate prompts/code per language.
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  si: "Sinhala",
  fr: "French",
  zh: "Mandarin Chinese",
  el: "Greek",
  it: "Italian",
};

function buildSystemPrompt(languageCode: string) {
  const languageName = LANGUAGE_NAMES[languageCode] ?? "English";
  const doctorList = (doctors as { name: string; specialty: string; hospital: string }[])
      .map((d) => `- ${d.name} (${d.specialty}) — ${d.hospital}`)
      .join("\n");

  return `You are a friendly clinic booking assistant on a voice call.

Available doctors:
${doctorList}

Rules:
- Appointments can ONLY be booked Monday–Friday. Never accept a Saturday or Sunday request — politely explain and suggest the next available weekday.
- Always reply in ${languageName}, regardless of what language earlier turns were in.
- Keep spoken replies short (1-3 sentences) since they will be read aloud by text-to-speech.
- Collect these over the conversation: the patient's name, the patient's age, which doctor, which hospital (fill this in yourself from the doctor list — do not ask the user for it separately unless a doctor works at more than one location), which date, which time, and optionally a short reason for the visit if the user mentions one (do not ask for medical details beyond what they volunteer).
- Once you have the patient's name, age, doctor, date, and time, and the date is a weekday, confirm the booking clearly, including the hospital name.

After your natural-language reply, output a JSON block on its own line, in this exact shape, with no extra commentary:
{"patientName": string|null, "patientAge": string|null, "doctor": string|null, "hospital": string|null, "date": string|null (YYYY-MM-DD), "time": string|null (HH:MM), "notes": string|null, "status": "collecting"|"confirmed"|"rejected_weekend"}`;
}

// Defensive server-side check — never trust the model's own date math.
function isWeekend(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const day = new Date(dateStr + "T00:00:00").getDay();
  return day === 0 || day === 6;
}

function extractJsonBlock(text: string): { reply: string; booking: BookingState } {
  const match = text.match(/\{[\s\S]*\}/);
  let booking: BookingState = {
    patientName: null,
    patientAge: null,
    doctor: null,
    hospital: null,
    date: null,
    time: null,
    notes: null,
    status: "collecting",
  };

  let reply = text.trim();

  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      booking = {
        patientName: parsed.patientName ?? null,
        patientAge: parsed.patientAge ?? null,
        doctor: parsed.doctor ?? null,
        hospital: parsed.hospital ?? null,
        date: parsed.date ?? null,
        time: parsed.time ?? null,
        notes: parsed.notes ?? null,
        status: parsed.status ?? "collecting",
      };
      reply = text.slice(0, match.index).trim();
    } catch {
      // If parsing fails, fall back to defaults above and show the raw reply.
    }
  }

  return { reply, booking };
}

export async function POST(req: NextRequest) {
  try {
    const { messages, language } = (await req.json()) as {
      messages: ChatMessage[];
      language: string;
    };

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
          { error: "Missing GEMINI_API_KEY. Add it to .env.local and restart the dev server." },
          { status: 500 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash-lite",
      systemInstruction: buildSystemPrompt(language),
    });

    // Gemini's chat history is everything except the latest message,
    // which gets sent separately via sendMessage().
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));
    const lastMessage = messages[messages.length - 1];

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage.text);
    const rawText = result.response.text();

    let { reply, booking } = extractJsonBlock(rawText);

    // Server-side weekday enforcement, independent of what the model decided.
    if (isWeekend(booking.date)) {
      booking = { ...booking, status: "rejected_weekend" };
      reply =
          language === "si"
              ? "සමාවෙන්න, සති අන්තයේ appointment ලබාදිය නොහැක. කරුණාකර සදුදා සිට සිකුරාදා දිනයක් තෝරන්න."
              : reply; // For other languages the model's own weekend-refusal reply is used.
    }

    const payload: AgentResponse = { reply, booking };
    return NextResponse.json(payload);
  } catch (err: any) {
    console.error(err);

    // Free-tier rate limit hit — show something the user can act on instead of a crash.
    if (err?.status === 429 || String(err).includes("429")) {
      return NextResponse.json(
          {
            error:
                "The AI service's free daily quota is temporarily used up. Wait a minute (or try again tomorrow if it persists) and send your message again.",
          },
          { status: 429 }
      );
    }

    return NextResponse.json(
        { error: "Something went wrong talking to the booking agent." },
        { status: 500 }
    );
  }
}