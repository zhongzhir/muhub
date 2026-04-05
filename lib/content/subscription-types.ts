/**
 * 用户主动订阅项目内容（持久层为 ProjectFollow；本类型为面向 slug 的领域形状）。
 */
export type ContentSubscription = {
  id: string
  userId: string
  projectSlug: string
  createdAt: Date
}

/** 列表展示用：附加项目公开字段，不作推荐或加权排序依据 */
export type ContentSubscriptionWithProject = ContentSubscription & {
  projectName: string
  tagline: string | null
}
