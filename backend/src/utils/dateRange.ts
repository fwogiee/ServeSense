import { ApiError } from "./errors";

export interface DateRange {
  from: Date;
  to: Date;
}

const toStartOfDay = (date: Date): Date => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const toEndOfDay = (date: Date): Date => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

export const parseDateRange = (fromRaw?: string, toRaw?: string): DateRange => {
  if (!fromRaw && !toRaw) {
    const to = toEndOfDay(new Date());
    const from = toStartOfDay(new Date());
    from.setDate(from.getDate() - 6);
    return { from, to };
  }

  const toValue = toRaw ? new Date(toRaw) : new Date();
  const fromValue = fromRaw ? new Date(fromRaw) : new Date(toValue);

  if (Number.isNaN(toValue.getTime()) || Number.isNaN(fromValue.getTime())) {
    throw new ApiError(400, "Invalid date range. Use YYYY-MM-DD format.");
  }

  const from = toStartOfDay(fromValue);
  const to = toEndOfDay(toValue);

  if (from > to) {
    throw new ApiError(400, "Invalid date range: 'from' must be <= 'to'.");
  }

  return { from, to };
};
