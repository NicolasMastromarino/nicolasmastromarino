import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseServerClient } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOTIFY_TO = "nicolas.mastromarino@gmail.com";
// Sent via the Resend account's verified bookkeeply.me domain (the only
// domain verified on the key currently available). Swap this once
// nicolasmastromarino.com is added and verified in that Resend account.
const NOTIFY_FROM = "Website contact form <contact@bookkeeply.me>";

const MAX_NAME = 200;
const MAX_COMPANY = 200;
const MAX_MESSAGE = 5000;

// Strip control/line-break characters so untrusted input can't inject
// extra lines into the email subject or corrupt the stored row.
function clean(value: string, max: number) {
  return value.replace(/[\r\n\t\u0000-\u001f]/g, " ").trim().slice(0, max);
}

async function sendNotificationEmail(data: {
  name: string;
  email: string;
  company: string;
  message: string;
  locale: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: NOTIFY_FROM,
      to: NOTIFY_TO,
      replyTo: data.email,
      subject: `New message from ${data.name} via nicolasmastromarino.com`,
      text: [
        `Name: ${data.name}`,
        `Email: ${data.email}`,
        `Company: ${data.company || "(not provided)"}`,
        `Locale: ${data.locale}`,
        "",
        "Message:",
        data.message,
      ].join("\n"),
    });
  } catch (err) {
    // Best-effort: the Supabase row is the source of truth, so a failed
    // email notification should never fail the whole request.
    console.error("contact notification email failed", err);
  }
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "not_configured" },
      { status: 503 }
    );
  }

  let body: {
    name?: string;
    email?: string;
    company?: string;
    message?: string;
    locale?: string;
    website?: string; // honeypot: real users never fill this
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Honeypot: bots fill every field they find, humans never see this one.
  // Pretend success without touching Supabase or Resend.
  if (body.website?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = clean(body.name?.trim() ?? "", MAX_NAME);
  const email = (body.email?.trim() ?? "").slice(0, 254);
  const company = clean(body.company?.trim() ?? "", MAX_COMPANY);
  const message = clean(body.message?.trim() ?? "", MAX_MESSAGE);
  const locale = body.locale === "es" ? "es" : "en";

  if (!name || !email || !message) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const { error } = await supabase.from("contact_submissions").insert({
    name,
    email,
    company: company || null,
    message,
    locale,
  });

  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  await sendNotificationEmail({ name, email, company, message, locale });

  return NextResponse.json({ ok: true });
}
