import {
  type ProjectDisplayBadge,
  projectBadgeClass,
} from "@/lib/project-badges";

type Props = {
  source: ProjectDisplayBadge[];
  lifecycle: ProjectDisplayBadge[];
  theme?: "light" | "dark";
  className?: string;
};

/**
 * 来源与生命周期分两行展示，便于一眼区分；全站统一 data-testid。
 */
export function ProjectBadgeStrip({ source, lifecycle, theme = "light", className = "" }: Props) {
  const renderRow = (badges: ProjectDisplayBadge[], rowTestId: string) => {
    if (badges.length === 0) {
      return null;
    }
    return (
      <div data-testid={rowTestId} className="flex flex-wrap gap-2">
        {badges.map((b) => (
          <span key={b.key} data-testid={b.testId} className={projectBadgeClass(b.variant, theme)}>
            {b.label}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div data-testid="project-badges" className={`space-y-2 ${className}`}>
      {renderRow(source, "project-badges-source")}
      {renderRow(lifecycle, "project-badges-lifecycle")}
    </div>
  );
}
