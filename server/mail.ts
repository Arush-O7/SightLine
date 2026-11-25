// Email templates. Every email is saved to the outbox table (the Demo Inbox reads it)
// and is also sent over SMTP when SMTP_HOST etc. are set.

export interface MailContent {
  subject: string;
  heading: string;
  lines: string[];
  facts?: [string, string][];
  action?: { label: string; url: string };
  footnote?: string;
  /** absolute address of the app icon, shown beside the wordmark */
  logoUrl?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function renderMail(m: MailContent): { html: string; text: string } {
  const facts = m.facts?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border-top:1px solid #e6e4df">${m.facts
        .map(
          ([k, v]) =>
            `<tr><td style="padding:10px 0;border-bottom:1px solid #e6e4df;color:#6b6964;font-size:13px">${esc(k)}</td><td style="padding:10px 0;border-bottom:1px solid #e6e4df;text-align:right;font-size:15px;font-weight:600">${esc(v)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const action = m.action
    ? `<p style="margin:26px 0"><a href="${esc(m.action.url)}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#0b0b0c;color:#ecebe7;text-decoration:none;font-weight:600;font-size:15px">${esc(m.action.label)}</a></p><p style="font-size:13px;color:#6b6964;word-break:break-all">Or open this link: ${esc(m.action.url)}</p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f4f2ed;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#151516">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-size:20px;letter-spacing:-.02em;font-weight:700;margin:0 0 24px;line-height:28px">${m.logoUrl ? `<img src="${esc(m.logoUrl)}" width="28" height="28" alt="" style="vertical-align:top;margin-right:10px">` : ''}SightLine</p>
<div style="background:#fff;border:1px solid #e6e4df;border-radius:14px;padding:28px">
<h1 style="font-size:24px;line-height:1.2;margin:0 0 14px;letter-spacing:-.02em">${esc(m.heading)}</h1>
${m.lines.map((l) => `<p style="font-size:15px;line-height:1.55;margin:0 0 12px;color:#3a3936">${esc(l)}</p>`).join('')}
${facts}${action}
</div>
<p style="font-size:13px;color:#6b6964;line-height:1.5;margin:18px 4px 0">${esc(m.footnote ?? 'This is a demonstration product. No payment was taken and no real seat is reserved.')}</p>
</div></body></html>`;
  const text = [
    m.heading,
    '',
    ...m.lines,
    '',
    ...(m.facts ?? []).map(([k, v]) => `${k}: ${v}`),
    ...(m.action ? ['', `${m.action.label}: ${m.action.url}`] : []),
  ].join('\n');
  return { html, text };
}

export const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.MAIL_FROM);

/** Sends through SMTP when configured. Never throws: a mail failure must not fail a booking. */
export async function deliver(to: string, subject: string, html: string, text: string): Promise<void> {
  if (!smtpConfigured()) return;
  try {
    const { createTransport } = await import('nodemailer');
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transport = createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      // a slow mail server should delay a booking by seconds at most, never hold it open
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
    });
    await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, html, text });
  } catch (err) {
    console.error('[mail] delivery failed:', (err as Error).message);
  }
}

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends a batch two at a time, starting no new send after `budgetMs`, so a large batch can't hold a
 * request past the host's time limit. Anything left is logged; every email is already in the outbox.
 */
export async function deliverAll(mails: Mail[], budgetMs = 9000): Promise<void> {
  if (!smtpConfigured() || !mails.length) return;
  const stopAt = Date.now() + budgetMs;
  const queue = [...mails];
  const worker = async () => {
    for (let m = queue.shift(); m; m = queue.shift()) {
      if (Date.now() > stopAt) {
        queue.unshift(m);
        return;
      }
      await deliver(m.to, m.subject, m.html, m.text);
    }
  };
  await Promise.all([worker(), worker()]);
  if (queue.length) console.error(`[mail] ran out of time: ${queue.length} of ${mails.length} emails were not sent`);
}
