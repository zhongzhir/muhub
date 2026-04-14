type Props = {
  summary?: string;
};

export default function ProjectSummary({ summary }: Props) {
  if (!summary) return null;

  return (
    <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-2 text-sm font-semibold">Project Information</h2>

      <p className="text-sm leading-relaxed text-gray-700 dark:text-zinc-300">{summary}</p>
    </section>
  );
}
