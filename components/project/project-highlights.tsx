type Props = {
  highlights: string[];
};

export default function ProjectHighlights({ highlights }: Props) {
  if (!highlights?.length) return null;

  return (
    <section className="mt-6">
      <h3 className="mb-2 text-sm font-semibold">Project Highlights</h3>

      <div className="flex flex-wrap gap-2">
        {highlights.map((h) => (
          <span key={h} className="rounded-md border px-2 py-1 text-xs">
            {h}
          </span>
        ))}
      </div>
    </section>
  );
}
