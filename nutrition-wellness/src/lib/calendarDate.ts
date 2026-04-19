const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseCalendarDate(value?: string | null): Date | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(DATE_ONLY_PATTERN);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function formatCalendarDate(
  value?: string | null,
  locale = "en-US"
): string | null {
  const date = parseCalendarDate(value);
  if (!date) return null;

  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function calculateAgeFromCalendarDate(
  value?: string | null,
  today = new Date()
): number | null {
  const birth = parseCalendarDate(value);
  if (!birth) return null;

  let age = today.getFullYear() - birth.getFullYear();
  const notYetHadBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());

  if (notYetHadBirthday) {
    age -= 1;
  }

  return age;
}
