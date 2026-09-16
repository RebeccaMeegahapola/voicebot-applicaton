"use client";

import { useEffect, useRef, useState } from "react";
import doctors from "@/data/doctors.json";
import { LANGUAGES } from "@/data/languages";
import {
  AgentResponse,
  BookingState,
  ChatMessage,
  SupportedLanguage,
} from "@/types";

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition():
    | (new () => SpeechRecognitionInstance)
    | null {
  if (typeof window === "undefined") return null;

  const w = window as any;

  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const emptyBooking: BookingState = {
  patientName: null,
  patientAge: null,
  doctor: null,
  hospital: null,
  date: null,
  time: null,
  notes: null,
  status: "collecting",
};

const STATUS_STYLES: Record<
    BookingState["status"],
    { label: string; className: string }
> = {
  collecting: {
    label: "In progress",
    className: "bg-brand-goldLight text-brand-teal",
  },

  confirmed: {
    label: "Confirmed",
    className: "bg-brand-sageLight text-brand-emerald",
  },

  rejected_weekend: {
    label: "Choose another day",
    className: "bg-brand-coral/10 text-brand-coral",
  },
};

export default function VoiceBooking() {
  const [language, setLanguage] =
      useState<SupportedLanguage>("en");

  const [messages, setMessages] =
      useState<ChatMessage[]>([]);

  const [booking, setBooking] =
      useState<BookingState>(emptyBooking);

  const [listening, setListening] =
      useState(false);

  const [loading, setLoading] =
      useState(false);

  const [voiceSupported, setVoiceSupported] =
      useState(true);

  const [typedInput, setTypedInput] =
      useState("");

  const recognitionRef =
      useRef<SpeechRecognitionInstance | null>(null);

  const scrollRef =
      useRef<HTMLDivElement>(null);

  const currentLangConfig =
      LANGUAGES.find((l) => l.code === language)!;

  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function sendToAgent(nextMessages: ChatMessage[]) {
    setLoading(true);

    try {
      const res = await fetch("/api/booking-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
          language,
        }),
      });

      const data: AgentResponse & { error?: string } =
          await res.json();

      if (data.error) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: `⚠️ ${data.error}`,
          },
        ]);

        return;
      }

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data.reply,
        },
      ]);

      setBooking(data.booking);

      speak(data.reply);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text:
              "Sorry, something went wrong reaching the booking agent.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function speak(text: string) {
    if (
        typeof window === "undefined" ||
        !window.speechSynthesis
    ) {
      return;
    }

    const voices =
        window.speechSynthesis.getVoices();

    const hasVoiceForLang = voices.some((v) =>
        v.lang
            .toLowerCase()
            .startsWith(
                currentLangConfig.bcp47.split("-")[0]
            )
    );

    if (!hasVoiceForLang) return;

    const utterance =
        new SpeechSynthesisUtterance(text);

    utterance.lang =
        currentLangConfig.bcp47;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function submitUserText(text: string) {
    if (!text.trim()) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      {
        role: "user",
        text,
      },
    ];

    setMessages(nextMessages);
    setTypedInput("");

    sendToAgent(nextMessages);
  }

  function startListening() {
    const SpeechRecognitionCtor =
        getSpeechRecognition();

    if (!SpeechRecognitionCtor) return;

    const recognition =
        new SpeechRecognitionCtor();

    recognition.lang =
        currentLangConfig.bcp47;

    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript =
          event.results[0][0].transcript;

      submitUserText(transcript);
    };

    recognition.onerror = () =>
        setListening(false);

    recognition.onend = () =>
        setListening(false);

    recognitionRef.current =
        recognition;

    setListening(true);

    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function resetConversation() {
    setMessages([]);
    setBooking(emptyBooking);

    window.speechSynthesis?.cancel();
  }

  const statusStyle =
      STATUS_STYLES[booking.status];

  return (
      <div className="min-h-screen bg-brand-bg text-brand-text">

        {/* ==================================================
          HEADER
          ================================================== */}

        <header className="relative overflow-hidden bg-brand-teal">
          {/* Decorative circles */}
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10" />

          <div className="pointer-events-none absolute -right-8 -top-12 h-48 w-48 rounded-full border border-white/10" />

          <div className="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full bg-brand-sage/10 blur-3xl" />

          <div className="relative mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12">
            <div className="flex items-start justify-between gap-6">

              {/* Brand + Hero */}
              <div className="max-w-2xl">

                {/* Brand */}
                <div className="mb-5 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-sage text-brand-teal">
                  <span className="text-lg">
                    ✦
                  </span>
                  </div>

                  <span className="text-sm font-semibold tracking-wide text-white">
                  MedVoice
                </span>
                </div>

                <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-5xl">
                  Book your doctor
                  <br />
                  <span className="text-brand-sage">
                  with your voice.
                </span>
                </h1>

                <p className="mt-4 max-w-lg text-sm leading-6 text-white/70 sm:text-base">
                  Tell us who you want to see, where you
                  want to go, and when. MedVoice will help
                  arrange your appointment.
                </p>
              </div>

              {/* AI indicator */}
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 sm:flex">
                <span className="h-2 w-2 rounded-full bg-brand-sage" />
                AI Assistant
              </div>
            </div>

            {/* Language selector */}
            <div className="mt-7 flex flex-wrap gap-2">
              {LANGUAGES.map((l) => {
                const active =
                    l.code === language;

                return (
                    <button
                        key={l.code}
                        onClick={() =>
                            setLanguage(l.code)
                        }
                        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                            active
                                ? "border-brand-sage bg-brand-sage text-brand-teal"
                                : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                    >
                  <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: active
                            ? "#174A4A"
                            : l.color,
                      }}
                  />

                      {l.label}
                    </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* ==================================================
          MAIN
          ================================================== */}

        <main className="mx-auto max-w-6xl px-5 py-6 sm:px-6 sm:py-10">

          {/* ==================================================
            AVAILABLE DOCTORS
            ================================================== */}

          <section className="mb-6 rounded-3xl border border-brand-border bg-white p-5 shadow-sm sm:p-6">

            {/* Section heading */}
            <div className="flex items-start justify-between gap-4">

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">
                  Our medical team
                </p>

                <h2 className="mt-1 font-display text-2xl font-semibold text-brand-teal sm:text-3xl">
                  Available doctors
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
                  View our doctors and their available
                  appointment times, then tell MedVoice
                  who you would like to see.
                </p>
              </div>

              {/* Medical icon */}
              <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-sageLight sm:flex">
              <span className="text-xl">
                🩺
              </span>
              </div>
            </div>

            {/* Doctor cards */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">

              {doctors.map((doctor) => (
                  <div
                      key={doctor.name}
                      className="group rounded-2xl border border-brand-border bg-brand-bg/50 p-4 transition hover:border-brand-sageDark/40 hover:bg-brand-sageLight/20"
                  >
                    <div className="flex items-start gap-3">

                      {/* Doctor icon */}
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-sageLight">
                    <span className="text-lg">
                      👨‍⚕️
                    </span>
                      </div>

                      {/* Doctor information */}
                      <div className="min-w-0 flex-1">

                        <p className="font-semibold text-brand-teal">
                          {doctor.name}
                        </p>

                        <p className="mt-0.5 text-xs font-medium text-brand-sageDark">
                          {doctor.specialty}
                        </p>

                        <p className="mt-2 text-xs text-brand-muted">
                          📍 {doctor.hospital}
                        </p>

                        {/* Available times */}
                        <div className="mt-3">

                          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-brand-muted">
                            Available times
                          </p>

                          <div className="flex flex-wrap gap-1.5">
                            {doctor.availableTimes.map(
                                (time) => (
                                    <span
                                        key={time}
                                        className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-brand-teal ring-1 ring-brand-border"
                                    >
                              {time}
                            </span>
                                )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
              ))}
            </div>

            {/* Voice instruction */}
            <div className="mt-5 flex items-start gap-2 rounded-xl bg-brand-sageLight/50 px-3 py-2.5">
            <span className="mt-0.5 text-sm">
              💬
            </span>

              <p className="text-xs leading-5 text-brand-muted">
              <span className="font-semibold text-brand-teal">
                No manual selection required.
              </span>{" "}
                Simply tell the VoiceBot which doctor,
                date, and time you prefer.
              </p>
            </div>
          </section>

          {/* ==================================================
            VOICEBOT + BOOKING DETAILS
            ================================================== */}

          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">

            {/* ==================================================
              CONVERSATION CARD
              ================================================== */}

            <section className="overflow-hidden rounded-3xl border border-brand-border bg-white shadow-sm">

              {/* Card header */}
              <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-sageLight text-lg">
                    🤖
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-brand-teal">
                      MedVoice Assistant
                    </p>

                    <p className="text-xs text-brand-muted">
                      {listening
                          ? "Listening..."
                          : loading
                              ? "Thinking..."
                              : "Ready to help"}
                    </p>
                  </div>
                </div>

                <span className="flex items-center gap-1.5 text-xs text-brand-muted">
                <span className="h-2 w-2 rounded-full bg-brand-emerald" />
                Online
              </span>
              </div>

              {/* ==================================================
                MESSAGES
                ================================================== */}

              <div
                  ref={scrollRef}
                  className="space-y-4 overflow-y-auto p-5 sm:p-6"
                  style={{
                    minHeight: "25rem",
                    maxHeight: "30rem",
                  }}
              >

                {/* Empty state */}
                {messages.length === 0 && (
                    <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">

                      {/* Voice icon */}
                      <div className="relative mb-6">

                        {listening && (
                            <>
                              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-sage" />

                              <span className="absolute -inset-4 animate-pulse-ring rounded-full bg-brand-sage/30" />
                            </>
                        )}

                        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-brand-sageLight text-4xl shadow-sm">
                          🎙️
                        </div>
                      </div>

                      <h2 className="font-display text-xl font-semibold text-brand-teal">
                        How can I help you?
                      </h2>

                      <p className="mt-2 max-w-sm text-sm leading-6 text-brand-muted">
                        Tap the microphone and tell me
                        what kind of doctor you need.
                      </p>

                      <div className="mt-5 rounded-2xl bg-brand-bg px-4 py-3 text-left text-xs text-brand-muted">
                    <span className="font-semibold text-brand-teal">
                      Try saying:
                    </span>{" "}
                        &ldquo;I&apos;m Amal, 32. I&apos;d like
                        to see a dentist next Tuesday at 2pm.&rdquo;
                      </div>
                    </div>
                )}

                {/* Chat messages */}
                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={`flex ${
                            m.role === "user"
                                ? "justify-end"
                                : "justify-start"
                        }`}
                    >
                      <div
                          className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                              m.role === "user"
                                  ? "rounded-br-md bg-brand-teal text-white"
                                  : "rounded-bl-md bg-brand-sageLight text-brand-text"
                          }`}
                      >
                        {m.text}
                      </div>
                    </div>
                ))}

                {/* Loading */}
                {loading && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-brand-sageLight px-4 py-3">

                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-teal/40 [animation-delay:-0.2s]" />

                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-teal/40" />

                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-teal/40 [animation-delay:0.2s]" />
                      </div>
                    </div>
                )}
              </div>

              {/* ==================================================
                INPUT AREA
                ================================================== */}

              <div className="border-t border-brand-border bg-brand-bg/50 p-4">

                <div className="flex items-center gap-3">

                  {/* Voice button */}
                  {voiceSupported ? (
                      <button
                          onClick={
                            listening
                                ? stopListening
                                : startListening
                          }
                          aria-label={
                            listening
                                ? "Stop listening"
                                : "Start speaking"
                          }
                          className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl shadow-sm transition-all ${
                              listening
                                  ? "bg-brand-coral text-white"
                                  : "bg-brand-teal text-white hover:scale-105 hover:bg-brand-tealDark"
                          }`}
                      >
                        {listening && (
                            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-coral" />
                        )}

                        <span className="relative">
                      {listening ? "■" : "🎙️"}
                    </span>
                      </button>
                  ) : (
                      <div className="rounded-xl bg-brand-coral/10 px-3 py-2 text-xs text-brand-coral">
                        Voice input unavailable
                      </div>
                  )}

                  {/* Text input */}
                  <div className="flex flex-1 items-center rounded-full border border-brand-border bg-white px-4 py-1 shadow-sm">

                    <input
                        value={typedInput}
                        onChange={(e) =>
                            setTypedInput(e.target.value)
                        }
                        onKeyDown={(e) =>
                            e.key === "Enter" &&
                            submitUserText(typedInput)
                        }
                        placeholder="Type your message..."
                        className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-brand-text outline-none placeholder:text-brand-muted/60"
                    />

                    {typedInput && (
                        <button
                            onClick={() =>
                                submitUserText(typedInput)
                            }
                            className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-teal text-white transition hover:bg-brand-tealDark"
                            aria-label="Send message"
                        >
                          ↑
                        </button>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-center text-[11px] text-brand-muted">
                  Tap the microphone to speak or type your request
                </p>
              </div>
            </section>

            {/* ==================================================
              BOOKING DETAILS
              ================================================== */}

            <section className="flex flex-col gap-5">

              {/* Section heading */}
              <div className="flex items-center justify-between px-1">

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">
                    Your appointment
                  </p>

                  <h2 className="mt-1 font-display text-2xl font-semibold text-brand-teal">
                    Booking details
                  </h2>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-goldLight text-brand-gold">
                  ✓
                </div>
              </div>

              {/* ==================================================
                APPOINTMENT TICKET
                ================================================== */}

              <div
                  className="ticket-notch relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-brand-border"
                  style={{
                    ["--ticket-notch-bg" as any]:
                        "#F8F7F2",
                  }}
              >

                {/* Ticket top */}
                <div className="relative overflow-hidden bg-brand-teal px-6 py-6">

                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full border border-white/10" />

                  <div className="relative">

                    <div className="flex items-center justify-between">

                      <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/50">
                        Appointment
                      </p>

                      <span className="text-lg text-brand-gold">
                      ✦
                    </span>
                    </div>

                    <p className="mt-3 font-display text-2xl font-semibold text-white">
                      {booking.doctor ??
                          "Doctor not chosen yet"}
                    </p>
                  </div>
                </div>

                {/* Ticket details */}
                <div className="border-t border-dashed border-brand-border">

                  <div className="grid grid-cols-2 gap-5 px-6 py-6">

                    {/* Patient */}
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                        Patient
                      </p>

                      <p className="mt-1 text-sm font-medium text-brand-text">
                        {booking.patientName ?? "—"}
                      </p>
                    </div>

                    {/* Age */}
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                        Age
                      </p>

                      <p className="mt-1 text-sm font-medium text-brand-text">
                        {booking.patientAge ?? "—"}
                      </p>
                    </div>

                    {/* Hospital */}
                    <div className="col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                        Hospital
                      </p>

                      <p className="mt-1 text-sm font-medium text-brand-text">
                        {booking.hospital ??
                            "Not selected"}
                      </p>
                    </div>

                    {/* Date */}
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                        Date
                      </p>

                      <p className="mt-1 text-sm font-medium text-brand-text">
                        {booking.date
                            ? new Date(
                                booking.date +
                                "T00:00:00"
                            ).toLocaleDateString(
                                "en-US",
                                {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                }
                            )
                            : "—"}
                      </p>
                    </div>

                    {/* Time */}
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                        Time
                      </p>

                      <p className="mt-1 text-sm font-medium text-brand-text">
                        {booking.time ?? "—"}
                      </p>
                    </div>

                    {/* Notes */}
                    {booking.notes && (
                        <div className="col-span-2">

                          <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                            Reason for visit
                          </p>

                          <p className="mt-1 text-sm font-medium text-brand-text">
                            {booking.notes}
                          </p>
                        </div>
                    )}
                  </div>
                </div>

                {/* Ticket footer */}
                <div className="flex items-center justify-between border-t border-brand-border px-6 py-4">

                <span
                    key={booking.status}
                    className={`animate-pop-in rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyle.className}`}
                >
                  {statusStyle.label}
                </span>

                  <button
                      onClick={resetConversation}
                      className="text-xs font-medium text-brand-muted transition hover:text-brand-teal hover:underline"
                  >
                    Start over
                  </button>
                </div>
              </div>

              {/* ==================================================
                VOICE BOOKING INFO
                ================================================== */}

              <div className="rounded-2xl border border-brand-border bg-white p-5">

                <div className="flex gap-3">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-sageLight">
                    💡
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-brand-teal">
                      Voice booking
                    </p>

                    <p className="mt-1 text-xs leading-5 text-brand-muted">
                      Tell the assistant your preferred
                      doctor, date, and time. Your
                      appointment details will appear here
                      as they are collected.
                    </p>
                  </div>
                </div>
              </div>

              {/* ==================================================
                APPOINTMENT AVAILABILITY
                ================================================== */}

              <div className="rounded-2xl bg-brand-sageLight/60 p-5">

                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
                    🗓️
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-brand-teal">
                      Appointment availability
                    </p>

                    <p className="mt-1 text-xs text-brand-muted">
                      Monday – Friday
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
  );
}