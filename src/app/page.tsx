export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <p className="font-mono text-sm text-muted-foreground">Phase A · Bootstrap</p>
      <h1 className="text-2xl font-semibold tracking-tight">Updater</h1>
      <p className="leading-7">
        Updater helps developers keep an evidence-backed portfolio and role-specific resumes up to
        date from verifiable sources such as repositories, pull requests, and published articles.
      </p>
      <p className="leading-7 text-muted-foreground">
        This build only contains the project scaffold. No sources are connected and no data is
        collected. The application shell, demo data, review queue, portfolio editor, and resume
        builder are tracked in <code className="font-mono text-sm">tracker.md</code>.
      </p>
    </main>
  );
}
