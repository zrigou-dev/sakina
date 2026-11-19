import { CONTACT_EMAIL } from '@/content/contact';

export type FeedbackKind = 'report' | 'suggest';

export interface DeviceInfo {
  readonly appVersion: string;
  readonly platform: string;
  readonly osVersion: string;
  readonly language: string;
}

export interface DraftLabels {
  readonly subject: string;
  /** Prompts shown in the body, in the user's language. */
  readonly prompts: readonly string[];
  readonly tech: string;
}

/** RFC 6068 `mailto:` URL. Subject/body are percent-encoded (spaces as %20, newlines as %0D%0A). */
export function buildMailto(to: string, subject: string, body: string): string {
  // Header values never contain line breaks; the body uses CRLF as RFC 6068 prescribes.
  const subjectPart = encodeURIComponent(subject.replace(/[\r\n]+/g, ' '));
  const bodyPart = encodeURIComponent(body.replace(/\r?\n/g, '\r\n'));
  return `mailto:${to}?subject=${subjectPart}&body=${bodyPart}`;
}

/**
 * The draft the user can edit before sending. It contains the prompts and a small technical footer
 * (app version, platform, language) — no identifiers, no location, nothing hidden.
 */
export function feedbackBody(labels: DraftLabels, info: DeviceInfo): string {
  const footer = `${labels.tech}\nSAKINA ${info.appVersion} · ${info.platform} ${info.osVersion} · ${info.language}`;
  return `${labels.prompts.join('\n\n\n')}\n\n\n—\n${footer}`;
}

export function feedbackMailto(labels: DraftLabels, info: DeviceInfo): string {
  return buildMailto(CONTACT_EMAIL, labels.subject, feedbackBody(labels, info));
}

/** For the crash screen, which has no translations: a plain English draft carrying the error text. */
export function crashMailto(error: string, info: DeviceInfo): string {
  const body = `What were you doing when this happened?\n\n\n—\nError: ${error.slice(0, 300)}\nSAKINA ${info.appVersion} · ${info.platform} ${info.osVersion}`;
  return buildMailto(CONTACT_EMAIL, 'SAKINA — startup problem', body);
}
