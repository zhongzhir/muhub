import { productHuntGraphql } from "@/lib/discovery/producthunt/http";
import type { ProductHuntPostNode, ProductHuntPostsConnection } from "@/lib/discovery/producthunt/types";

/** 使用根 `posts(topic: …)`，按话题 slug 筛选（与 `Topic` 类型无 `posts` 字段的官方 schema 一致） */
const QUERY = `
  query PhPostsByTopic($topic: String!, $first: Int!, $order: PostsOrder!) {
    posts(first: $first, topic: $topic, order: $order) {
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

export type FetchTopicPostsParams = {
  topicSlug: string;
  first: number;
  /** 与 featured 源一致，默认 RANKING */
  order?: "RANKING" | "VOTES" | "NEWEST" | "FEATURED_AT";
};

/** 默认用于 `producthunt-ai`：按 topic slug（如 artificial-intelligence）拉取帖子 */
export async function fetchProductHuntTopicPosts(
  params: FetchTopicPostsParams,
): Promise<{ ok: true; posts: ProductHuntPostNode[] } | { ok: false; error: string }> {
  const slug = params.topicSlug.trim().toLowerCase();
  if (!slug) {
    return { ok: false, error: "topicSlug 为空" };
  }
  const first = Math.min(50, Math.max(1, params.first));
  const order = params.order ?? "RANKING";

  const res = await productHuntGraphql<ProductHuntPostsConnection>({
    query: QUERY,
    variables: { topic: slug, first, order },
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
