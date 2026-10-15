"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { EASE_OUT } from "@/components/motion-primitives";
import { withBase } from "@/lib/base-path";

type Status = "idle" | "submitting" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const labelClass =
  "font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint transition-colors duration-200 group-focus-within:text-accent-text";
const fieldClass =
  "w-full rounded-[var(--radius-sm)] border border-line-strong bg-white/[0.03] px-3.5 py-3 text-[15px] text-ink transition-[border-color,background-color,box-shadow] duration-200 ease-out-strong placeholder:text-ink-faint focus:border-accent focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(255,91,61,0.14)] focus:outline-none";

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
      const res = await fetch(withBase("/api/contact"), {
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

  return (
    <AnimatePresence mode="wait" initial={false}>
      {status === "success" ? (
        <motion.div
          key="done"
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="flex h-full min-h-[320px] flex-col items-start justify-center rounded-[var(--radius-md)] border border-line-strong bg-white/[0.03] p-8"
        >
          <svg viewBox="0 0 52 52" className="h-14 w-14" aria-hidden="true">
            <motion.circle
              cx="26"
              cy="26"
              r="24"
              fill="none"
              stroke="var(--accent-3)"
              strokeWidth="2.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            />
            <motion.path
              d="M15 27 L23 35 L38 18"
              fill="none"
              stroke="var(--accent-3)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, delay: 0.5, ease: EASE_OUT }}
            />
          </svg>
          <span className="eyebrow mt-6">{t("formTitle")}</span>
          <p className="mt-3 text-[1.05rem] leading-relaxed text-ink" role="status">
            {t("formSuccess")}
          </p>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={handleSubmit}
          noValidate
          exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="rounded-[var(--radius-md)] border border-line bg-white/[0.02] p-5 sm:p-7"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="group flex flex-col gap-2">
              <label htmlFor="name" className={labelClass}>
                {t("formName")}
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div className="group flex flex-col gap-2">
              <label htmlFor="email" className={labelClass}>
                {t("formEmail")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="group mt-4 flex flex-col gap-2">
            <label htmlFor="company" className={labelClass}>
              {t("formCompany")} <span className="normal-case">{t("formCompanyOptional")}</span>
            </label>
            <input
              id="company"
              name="company"
              type="text"
              autoComplete="organization"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div className="group mt-4 flex flex-col gap-2">
            <label htmlFor="message" className={labelClass}>
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

          <AnimatePresence initial={false}>
            {status === "error" && (
              <motion.p
                key="err"
                initial={{ opacity: 0, height: 0, y: -6 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="overflow-hidden pt-4 text-sm text-accent-text"
                role="alert"
              >
                {errorMessage}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="submit"
              disabled={status === "submitting"}
              className="press relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-accent px-7 py-3.5 text-[14.5px] font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className={status === "submitting" ? "opacity-70 blur-[1px]" : ""}>
                {status === "submitting" ? t("formSubmitting") : t("formSubmit")}
              </span>
              {status === "submitting" ? (
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-ink/30 border-t-accent-ink"
                />
              ) : (
                <span aria-hidden="true">→</span>
              )}
            </button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
