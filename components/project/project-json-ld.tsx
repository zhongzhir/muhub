import type { ProjectPageView } from "@/lib/demo-project";
import { buildProjectSoftwareApplicationLd } from "@/lib/seo/project-json-ld";

type Props = {
  data: ProjectPageView;
  slug: string;
};

/** 项目详情 GEO：动态 JSON-LD */
export function ProjectJsonLd({ data, slug }: Props) {
  const json = buildProjectSoftwareApplicationLd(data, slug);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
