export type SupportedLanguage =
    | "en"
    | "si"
    | "fr"
    | "zh"
    | "el"
    | "it";

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  bcp47: string; // used for SpeechRecognition.lang / utterance.lang
  color: string; // hex — this language's identity dot color on the picker
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface BookingState {
  patientName: string | null;
  patientAge: string | null;
  doctor: string | null;
  hospital: string | null;
  date: string | null; // ISO date string, e.g. 2026-09-15
  time: string | null; // e.g. "14:00"
  notes: string | null; // reason for visit, in the patient's own words
  status: "collecting" | "confirmed" | "rejected_weekend";
}

export interface AgentResponse {
  reply: string;
  booking: BookingState;
}

export interface Doctor {
  name: string;
  specialty: string;
  hospital: string;
  // Available time slots, Monday–Friday only
  availableTimes: string[];
}