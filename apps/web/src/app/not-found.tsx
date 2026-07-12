/**
 * Custom not-found page for the app.
 * Provides the NotFound boundary so that notFound() calls
 * are caught at the correct level without triggering
 * the parallel route warning.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-6xl font-bold text-foreground">404</h1>
      <p className="mt-4 text-lg text-muted-foreground">This page could not be found.</p>
    </div>
  );
}
