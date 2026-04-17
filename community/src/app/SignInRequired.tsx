export default function SignInRequired() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_APP_URL || "http://localhost:3000";
  return (
    <main className="min-h-screen bg-doom-bg text-doom-text flex flex-col items-center justify-center px-6 pt-16">
      <h1 className="text-2xl font-bold text-doom-primary mb-3">Sign in required</h1>
      <p className="text-doom-muted text-center max-w-md mb-8">
        Community uses the same account as the main WellBeing app. Log in there first, then return here
        — your browser will send the same auth cookie.
      </p>
      <a
        href={baseUrl}
        className="px-6 py-3 rounded-lg bg-doom-primary text-doom-bg font-semibold hover:opacity-90 transition-opacity"
      >
        Open main app ({baseUrl})
      </a>
      <p className="mt-8 text-sm text-doom-muted max-w-md text-center">
        Tip: start the base app on port 3000 if you see a connection error after clicking.
      </p>
      <p className="mt-4 text-xs text-doom-muted max-w-lg text-center">
        For local dev without base: set{" "}
        <code className="text-doom-accent">COMMUNITY_DEV_DEMO=true</code> in{" "}
        <code className="text-doom-accent">.env.local</code> (see <code className="text-doom-accent">.env.local.example</code>
        ).
      </p>
    </main>
  );
}
