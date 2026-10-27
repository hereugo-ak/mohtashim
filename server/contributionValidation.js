import { FACULTIES, ISSUE_TOPICS } from '../src/data/faculties.js';

export const MAX_REQUEST_BYTES = 12 * 1024;
export const MAX_DETAILS_LENGTH = 700;
export const MAX_NAME_LENGTH = 100;
export const MAX_CLASS_LENGTH = 100;

const FACULTY_KEYS = new Set(Object.keys(FACULTIES));
const TOPICS = new Set(ISSUE_TOPICS);
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function normaliseText(value) {
  return value
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARACTERS, '')
    .trim();
}

function characterCount(value) {
  return [...value].length;
}

function invalid(field, message, code = 'invalid_input') {
  return { ok: false, error: { field, message, code } };
}

/**
 * Validate untrusted browser payloads and return a minimal, canonical DB payload.
 * For anonymous submissions, the name and class are discarded server-side even
 * if a modified browser sends them.
 */
export function validateContribution(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return invalid('form', 'Please review the form and try again.');
  }

  if (typeof input.faculty !== 'string' || !FACULTY_KEYS.has(input.faculty)) {
    return invalid('faculty', 'Choose one of the listed faculties.');
  }

  if (typeof input.topic !== 'string' || !TOPICS.has(input.topic)) {
    return invalid('topic', 'Choose the closest topic from the list.');
  }

  if (typeof input.anonymous !== 'boolean') {
    return invalid('anonymous', 'Please review the identity preference and try again.');
  }

  if (input.details !== undefined && input.details !== null && typeof input.details !== 'string') {
    return invalid('details', 'The contribution must be plain text.');
  }

  const details = normaliseText(input.details ?? '');
  if (characterCount(details) > MAX_DETAILS_LENGTH) {
    return invalid('details', `Keep the description to ${MAX_DETAILS_LENGTH} characters or fewer.`);
  }

  let studentName = null;
  let className = null;

  if (!input.anonymous) {
    if (typeof input.studentName !== 'string') {
      return invalid('studentName', 'Enter your name, or choose to keep your identity private.');
    }
    if (typeof input.className !== 'string') {
      return invalid('className', 'Enter your class or course, or choose to keep your identity private.');
    }

    studentName = normaliseText(input.studentName);
    className = normaliseText(input.className);

    if (characterCount(studentName) < 2 || characterCount(studentName) > MAX_NAME_LENGTH) {
      return invalid('studentName', `Your name must be between 2 and ${MAX_NAME_LENGTH} characters.`);
    }
    if (characterCount(className) < 2 || characterCount(className) > MAX_CLASS_LENGTH) {
      return invalid('className', `Your class or course must be between 2 and ${MAX_CLASS_LENGTH} characters.`);
    }
  }

  return {
    ok: true,
    value: {
      faculty: input.faculty,
      topic: input.topic,
      details: details || null,
      studentName,
      className,
      anonymous: input.anonymous,
    },
  };
}

export function isHoneypotFilled(input) {
  if (!input || typeof input !== 'object') return false;
  const value = input.website;
  return typeof value === 'string' && value.trim().length > 0;
}
