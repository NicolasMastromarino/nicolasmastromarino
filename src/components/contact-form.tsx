"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

type Status = "idle" | "submitting" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactForm() {
  const t = useTranslations("contact");
  const locale = useLocale();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, left empty by real users
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMessage(t("formErrorRequired"));
      setStatus("error");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setErrorMessage(t("formErrorEmail"));
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, message, locale, website }),
      });

      if (res.status === 503) {
        setErrorMessage(t("formErrorConfig"));
        setStatus("error");
        return;
      }
      if (!res.ok) {
        setErrorMessage(t("formErrorServer"));
        setStatus("error");
        return;
      }

      setStatus("success");
      setName("");
      setEmail("");
      setCompany("");
      setMessage("");
    } catch {
      setErrorMessage(t("formErrorServer"));
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-[var(--radius-md)] border border-bg/16 bg-bg/6 p-7">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent-3-on-ink">
          {t("formTitle")}
        </span>
        <p className="mt-2.5 text-[15px] leading-relaxed text-bg">{t("formSuccess")}</p>
      </div>
    );
  }

  const fieldClass =
    "w-full rounded-[var(--radius-sm)] border border-bg/22 bg-bg/8 px-3 py-2.5 text-[14.5px] text-bg placeholder:text-bg/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-[var(--radius-md)] border border-bg/16 bg-bg/6 p-6 sm:p-7"
    >
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}
      >
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="font-mono text-[11px] uppercase tracking-[0.06em] text-bg/60">
            {t("formName")}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="font-mono text-[11px] uppercase tracking-[0.06em] text-bg/60">
            {t("formEmail")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="mt-3.5 flex flex-col gap-1.5">
        <label htmlFor="company" className="font-mono text-[11px] uppercase tracking-[0.06em] text-bg/60">
          {t("formCompany")} <span className="normal-case">{t("formCompanyOptional")}</span>
        </label>
        <input
          id="company"
          name="company"
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="mt-3.5 flex flex-col gap-1.5">
        <label htmlFor="message" className="font-mono text-[11px] uppercase tracking-[0.06em] text-bg/60">
          {t("formMessage")}
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${fieldClass} resize-y`}
        />
      </div>

      {status === "error" && (
        <p className="mt-3.5 text-sm text-[var(--accent)]" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="mt-4.5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-[14.5px] font-semibold text-accent-ink transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "submitting" ? t("formSubmitting") : t("formSubmit")}
        </button>
      </div>
    </form>
  );
}
