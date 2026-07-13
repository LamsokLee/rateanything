/**
 * Formats a date as "Mon D, YYYY" (e.g. "Jul 12, 2026") in UTC.
 * UTC is intentional to ensure consistent output between server and client (SSR hydration safety).
 */
export function formatDate(dateInput: Date | string | number): string {
  const date =
    typeof dateInput === "string" || typeof dateInput === "number"
      ? new Date(dateInput)
      : dateInput;
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
