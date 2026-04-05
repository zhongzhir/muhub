/**
 * Content Agent V1.2：统一入口与各类草稿生成。
 * 当前为模板 + 规则拼装；后续可在本层接入 LLM，输出仍收敛为 ContentDraft。
 *
 * 分层角色：Content Layer（内容生产）。整体说明见 docs/agent-system-layering-v1.md。
 */

import { randomBytes } from "crypto"

import {
  buildProjectRoundupBody,
  buildProjectSpotlightBody,
  buildSocialPostBody,
  buildTrendObservationBody,
  defaultChannelForType,
} from "./content-templates"
import type {
  ColdStartRoundupThemeId,
  ContentChannel,
  ContentDraft,
  ContentDraftType,
  ContentProjectInput,
  SocialPostVariant,
} from "./content-types"

export function newContentDraftId(): string {
  return `${Date.now()}-${randomBytes(4).toString("hex")}`
}

function asDraft(
  partial: Omit<ContentDraft, "id" | "generatedAt" | "generatedBy" | "status"> & { type: ContentDraftType },
  projects: ContentProjectInput[],
): ContentDraft {
  return {
    id: newContentDraftId(),
    type: partial.type,
    channel: partial.channel,
    title: partial.title,
    summary: partial.summary,
    body: partial.body,
    sourceProjectSlugs: projects.map((p) => p.slug).filter(Boolean) as string[],
    sourceProjectNames: projects.map((p) => p.name),
    generatedAt: new Date().toISOString(),
    generatedBy: "content-agent",
    status: "draft",
  }
}

export function generateProjectRoundupDraft(
  projects: ContentProjectInput[],
  opts?: { channel?: ContentChannel; theme?: ColdStartRoundupThemeId },
): ContentDraft {
  const theme = opts?.theme ?? "weekly-cn-ai-opensource"
  const channel = opts?.channel ?? defaultChannelForType("project-roundup")
  const { title, summary, body } = buildProjectRoundupBody(projects, theme)
  return asDraft({ type: "project-roundup", channel, title, summary, body }, projects)
}

export function generateTrendObservationDraft(
  projects: ContentProjectInput[],
  opts?: { channel?: ContentChannel; extraTags?: string[] },
): ContentDraft {
  const channel = opts?.channel ?? defaultChannelForType("trend-observation")
  const { title, summary, body } = buildTrendObservationBody(projects, opts?.extraTags)
  return asDraft({ type: "trend-observation", channel, title, summary, body }, projects)
}

export function generateProjectSpotlightDraft(
  project: ContentProjectInput,
  opts?: { channel?: ContentChannel },
): ContentDraft {
  const channel = opts?.channel ?? defaultChannelForType("project-spotlight")
  const { title, summary, body } = buildProjectSpotlightBody(project)
  return asDraft({ type: "project-spotlight", channel, title, summary, body }, [project])
}

export function generateSocialPostDraft(
  projects: ContentProjectInput[],
  opts?: { channel?: ContentChannel; variant?: SocialPostVariant },
): ContentDraft {
  const variant = opts?.variant ?? "recommend"
  const channel = opts?.channel ?? defaultChannelForType("social-post")
  const { title, summary, body } = buildSocialPostBody(projects, variant)
  return asDraft({ type: "social-post", channel, title, summary, body }, projects)
}

export type GenerateContentDraftInput =
  | {
      kind: "project-roundup"
      projects: ContentProjectInput[]
      channel?: ContentChannel
      theme?: ColdStartRoundupThemeId
    }
  | {
      kind: "trend-observation"
      projects: ContentProjectInput[]
      channel?: ContentChannel
      extraTags?: string[]
    }
  | { kind: "project-spotlight"; project: ContentProjectInput; channel?: ContentChannel }
  | {
      kind: "social-post"
      projects: ContentProjectInput[]
      channel?: ContentChannel
      variant?: SocialPostVariant
    }

export function generateContentDraft(input: GenerateContentDraftInput): ContentDraft {
  switch (input.kind) {
    case "project-roundup":
      return generateProjectRoundupDraft(input.projects, {
        channel: input.channel,
        theme: input.theme,
      })
    case "trend-observation":
      return generateTrendObservationDraft(input.projects, {
        channel: input.channel,
        extraTags: input.extraTags,
      })
    case "project-spotlight":
      return generateProjectSpotlightDraft(input.project, { channel: input.channel })
    case "social-post":
      return generateSocialPostDraft(input.projects, {
        channel: input.channel,
        variant: input.variant,
      })
  }
}
