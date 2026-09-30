import "server-only";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    if (!smtpConfigured()) {
      throw new Error("SMTP не настроен (SMTP_HOST, SMTP_FROM)");
    }
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
  }
  return transporter;
}

function fromAddress(): string {
  return process.env.SMTP_FROM!.trim();
}

export function emailEnabled(): boolean {
  return smtpConfigured();
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ sent: boolean; skipped?: boolean }> {
  if (!smtpConfigured()) {
    console.warn("[email] SMTP не настроен, письмо не отправлено:", opts.subject, "→", opts.to);
    return { sent: false, skipped: true };
  }
  await getTransporter().sendMail({
    from: fromAddress(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html ?? opts.text.replace(/\n/g, "<br>"),
  });
  return { sent: true };
}

export async function sendOwnerCredentialsEmail(params: {
  to: string;
  name: string;
  seatName: string;
  password: string;
  loginUrl: string;
}): Promise<{ sent: boolean; skipped?: boolean }> {
  const { to, name, seatName, password, loginUrl } = params;
  const subject = "Смена — доступ к вашей сети отелей";
  const text = [
    `Здравствуйте, ${name}!`,
    "",
    `Для вас создана сеть «${seatName}».`,
    "",
    `Вход в CRM: ${loginUrl}`,
    `Email: ${to}`,
    `Пароль: ${password}`,
    "",
    "Рекомендуем сменить пароль после первого входа в Настройках.",
    "",
    "Сотрудников добавляйте через приглашения в разделе Настройки — свободная регистрация только по ссылке.",
    "",
    "— Смена",
  ].join("\n");

  return sendMail({ to, subject, text });
}

export async function sendEmailVerification(params: {
  to: string;
  name: string;
  verifyUrl: string;
}): Promise<{ sent: boolean; skipped?: boolean }> {
  const subject = "Смена — подтвердите email";
  const text = [
    `Здравствуйте, ${params.name}!`,
    "",
    "Подтвердите адрес email для доступа к CRM:",
    params.verifyUrl,
    "",
    "Ссылка действует 48 часов.",
    "",
    "— Смена",
  ].join("\n");

  return sendMail({ to: params.to, subject, text });
}
