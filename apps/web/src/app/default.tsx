/**
 * Default fallback for the implicit children parallel-route slot.
 * Prevents the "No default component was found for a parallel route"
 * warning when Next.js renders a not-found boundary.
 */
export default function Default() {
  return null;
}
