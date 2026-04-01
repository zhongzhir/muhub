import { productHuntGraphql } from "@/lib/discovery/producthunt/http";
import type { ProductHuntPostNode, ProductHuntPostsConnection } from "@/lib/discovery/producthunt/types";

const QUERY = `
  query PhFeaturedPosts($first: Int!, $order: PostsOrder!, $featured: Boolean) {
    posts(first: $first, order: $order, featured: $featured) {
      edges {
        cursor
        node {
          id
          name
          tagline
          description
          url
          website
          votesCount
          createdAt
          thumbnail {
            url
          }
          topics(first: 12) {
            edges {
              node {
                name
              }
            }
          }
          makers {
            edges {
              node {
                name
                username
              }
            }
          }
        }
      }
    }
  }
`;

export type FetchFeaturedParams = {
  first: number;
  /** Product Hunt `PostsOrder`：FEATURED_AT | NEWEST | RANKING | VOTES */
  order: "RANKING" | "VOTES" | "NEWEST" | "FEATURED_AT";
  /** 对应 GraphQL `posts(featured: true)`；未传则不带该参数（由 API 默认） */
  featuredOnly?: boolean;
};

export async function fetchProductHuntFeatured(
  params: FetchFeaturedParams,
): Promise<
  | { ok: true; posts: ProductHuntPostNode[] }
  | { ok: false; error: string }
> {
  const first = Math.min(50, Math.max(1, params.first));
  const variables: Record<string, unknown> = { first, order: params.order };
  if (typeof params.featuredOnly === "boolean") {
    variables.featured = params.featuredOnly;
  }
  const res = await productHuntGraphql<ProductHuntPostsConnection>({
    query: QUERY,
    variables,
  });

  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  const edges = res.data.posts?.edges ?? [];
  const posts: ProductHuntPostNode[] = [];
  for (const e of edges) {
    const n = e?.node;
    if (n?.id && n.name?.trim() && n.url?.trim()) {
      posts.push(n as ProductHuntPostNode);
    }
  }

  return { ok: true, posts };
}
