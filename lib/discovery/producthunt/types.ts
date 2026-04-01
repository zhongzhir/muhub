/** Product Hunt GraphQL `Post` 节点（抓取层使用的最小字段集） */
export type ProductHuntPostNode = {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  url: string;
  website: string | null;
  votesCount: number | null;
  createdAt: string | null;
  thumbnail: { url: string | null } | null;
  topics?: { edges: Array<{ node: { name: string | null } | null } | null> } | null;
  makers?: {
    edges: Array<{
      node: { name: string | null; username: string | null } | null;
    } | null>;
  } | null;
};

export type ProductHuntPostsConnection = {
  posts: {
    edges: Array<{ cursor: string | null; node: ProductHuntPostNode | null } | null> | null;
    pageInfo?: { hasNextPage: boolean; endCursor: string | null } | null;
  } | null;
};
