const DASHBOARD_TIME_ZONE = "Etc/GMT+7";
const DASHBOARD_FIXED_OFFSET = "-07:00";

export type TrendGranularity = "day" | "month" | "year";

const mstDayPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: DASHBOARD_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const mstTimestampFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: DASHBOARD_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const mstShortDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: DASHBOARD_TIME_ZONE,
  month: "short",
  day: "numeric",
});

const mstLongMonthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: DASHBOARD_TIME_ZONE,
  month: "long",
  year: "numeric",
});

const mstShortMonthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: DASHBOARD_TIME_ZONE,
  month: "short",
  year: "numeric",
});

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime());
}

function isDateOnlyString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseMstDateKey(value: string) {
  const date = new Date(`${value}T00:00:00${DASHBOARD_FIXED_OFFSET}`);
  return isValidDate(date) ? date : null;
}

function parseMstMonthKey(value: string) {
  const date = new Date(`${value}-01T00:00:00${DASHBOARD_FIXED_OFFSET}`);
  return isValidDate(date) ? date : null;
}

function normalizeInputDate(value: Date | string) {
  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }

  if (isDateOnlyString(value)) {
    return parseMstDateKey(value);
  }

  const date = new Date(value);
  return isValidDate(date) ? date : null;
}

export function toMstDayKey(value: Date | string) {
  const date = normalizeInputDate(value);
  if (!date) {
    return "Unknown";
  }

  const parts = mstDayPartsFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return "Unknown";
  }

  return `${year}-${month}-${day}`;
}

export function formatMstTimestamp(value: Date | string) {
  const date = normalizeInputDate(value);
  return date ? mstTimestampFormatter.format(date) : "Unknown";
}

export function formatMstDayKey(value: string) {
  const date = parseMstDateKey(value);
  return date ? mstShortDayFormatter.format(date) : value;
}

export function formatMstMonthKey(value: string) {
  const date = parseMstMonthKey(value);
  return date ? mstLongMonthFormatter.format(date) : value;
}

export function formatMstTrendPeriod(value: string, granularity: TrendGranularity) {
  if (granularity === "year") {
    return value;
  }

  if (granularity === "month") {
    const date = parseMstMonthKey(value);
    return date ? mstShortMonthFormatter.format(date) : value;
  }

  return formatMstDayKey(value);
}
