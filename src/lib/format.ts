/**
 * Display formatters.
 *
 * Indian-locale currency formatting for INR amounts.
 */

/**
 * Formats a numeric INR amount as "₹X,XX,XXX" using en-IN grouping.
 * Caller is responsible for passing a finite number.
 */
export function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}
