/**
 * Content Agent V1.2：统一入口与各类草稿生成。
 * 当前为模板 + 规则拼装；后续可在本层接入 LLM，输出仍收敛为 ContentDraft。
 *
 * 分层角色：Content Layer（内容生产）。整体说明见 docs/agent-system-layering-v1.md。
 */

import { randomBytes } from "crypto"

import {
  buildManualTopicBody,
  buildProjectRoundupBody,
  buildProjectSpotlightBody,
  buildProjectUpdateRoundupBody,
  buildSocialPostBody,
  buildTrendObservationBody,
  buildWeeklyDigestBody,
  defaultChannelForType,
  defaultMuHubCta,
} from "./content-templates"
import type {
  ColdStartRoundupThemeId,
  ContentChannel,
  ContentDraft,
  ContentDraftStatus,
  ContentDraftType,
  ContentEvidenceItem,
  ContentOpportunity,
  ContentProjectInput,
  SocialPostVariant,
} from "./content-types"

export function newContentDraftId(): string {
  return `${Date.now()}-${randomBytes(4).toString("hex")}`
}

function appendEvidenceSection(body: string, evidence: ContentEvidenceItem[]): string {
  if (!evidence.length) {
    return body
  }
  const lines = evidence.map((e, i) => {
    const parts: string[] = [`${i + 1}.`]
    if (e.note?.trim()) {
      parts.push(e.note.trim())
    }
    if (e.url?.trim()) {
      parts.push(e.url.trim())
    }
    if (e.sourceKey?.trim()) {
      parts.push(`(source: ${e.sourceKey.trim()})`)
    }
    return parts.join(" ")
  })
  return [body, "", "【参考与证据占位】", ...lines].join("\n")
}

function asDraft(
  partial: {
    type: ContentDraftType
    channel: ContentChannel
    title: string
    summary?: string
    body: string
    opportunityId?: string
    cta?: string
    status?: ContentDraftStatus
  },
  projects: ContentProjectInput[],
): ContentDraft {
  const now = new Date().toISOString()
  return {
    id: newContentDraftId(),
    opportunityId: partial.opportunityId,
    type: partial.type,
    contentType: partial.type,
    channel: partial.channel,
    title: partial.title,
    summary: partial.summary,
    body: partial.body,
    cta: partial.cta ?? defaultMuHubCta(),
    sourceProjectSlugs: projects.map((p) => p.slug).filter(Boolean) as string[],
    sourceProjectNames: projects.map((p) => p.name),
    generatedAt: now,
    createdAt: now,
    generatedBy: "content-agent",
    status: partial.status ?? "created",
    reviewFlags: [],
    qualityScore: undefined,
  }
}

/** 从已校验的 ContentOpportunity 生成草稿（模板拼装 + 证据附录） */
export function generateDraftFromOpportunity(op: ContentOpportunity): ContentDraft {
  const projects = op.projectRefs.map((r) => ({ ...r }))
  let built: { title: string; summary: string; body: string; type: ContentDraftType; channel: ContentChannel }

  switch (op.type) {
    case "project_spotlight": {
      const p = projects[0]!
      const b = buildProjectSpotlightBody(p)
      built = {
        ...b,
        type: "project-spotlight",
        channel: defaultChannelForType("project-spotlight"),
      }
      break
    }
    case "project_update_roundup": {
      const b = buildProjectUpdateRoundupBody(projects)
      built = {
        ...b,
        type: "project-roundup",
        channel: defaultChannelForType("project-roundup"),
      }
      break
    }
    case "weekly_digest": {
      const b = buildWeeklyDigestBody(projects, { digestTitle: op.title })
      built = {
        ...b,
        type: "project-roundup",
        channel: defaultChannelForType("project-roundup"),
      }
      break
    }
    case "manual_topic": {
      const b = buildManualTopicBody({
        title: op.title,
        summary: op.summary,
        narrativeHint: op.topicRefs.filter(Boolean).join("；") || undefined,
        projects: projects.length ? projects : undefined,
      })
      built = {
        ...b,
        type: "trend-observation",
        channel: defaultChannelForType("trend-observation"),
      }
      break
    }
  }

  const bodyWithEvidence = appendEvidenceSection(built.body, op.evidence)
  return asDraft(
    {
      ...built,
      body: bodyWithEvidence,
      summary: built.summary,
      opportunityId: op.id,
    },
    projects,
  )
}

export function generateProjectRoundupDraft(
  projects: ContentProjectInput[],
  opts?: { channel?: ContentChannel; theme?: ColdStartRoundupThemeId; opportunityId?: string },
): ContentDraft {
  const theme = opts?.theme ?? "weekly-cn-ai-opensource"
  const channel = opts?.channel ?? defaultChannelForType("project-roundup")
  const { title, summary, body } = buildProjectRoundupBody(projects, theme)
  return asDraft(
    { type: "project-roundup", channel, title, summary, body, opportunityId: opts?.opportunityId },
    projects,
  )
}

export function generateTrendObservationDraft(
  projects: ContentProjectInput[],
  opts?: { channel?: ContentChannel; extraTags?: string[]; opportunityId?: string },
): ContentDraft {
  const channel = opts?.channel ?? defaultChannelForType("trend-observation")
  const { title, summary, body } = buildTrendObservationBody(projects, opts?.extraTags)
  return asDraft(
    { type: "trend-observation", channel, title, summary, body, opportunityId: opts?.opportunityId },
    projects,
  )
}

export function generateProjectSpotlightDraft(
  project: ContentProjectInput,
  opts?: { channel?: ContentChannel; opportunityId?: string },
): ContentDraft {
  const channel = opts?.channel ?? defaultChannelForType("project-spotlight")
  const { title, summary, body } = buildProjectSpotlightBody(project)
  return asDraft(
    { type: "project-spotlight", channel, title, summary, body, opportunityId: opts?.opportunityId },
    [project],
  )
}

export function generateSocialPostDraft(
  projects: ContentProjectInput[],
  opts?: { channel?: ContentChannel; variant?: SocialPostVariant; opportunityId?: string },
): ContentDraft {
  const variant = opts?.variant ?? "recommend"
  const channel = opts?.channel ?? defaultChannelForType("social-post")
  const { title, summary, body } = buildSocialPostBody(projects, variant)
  return asDraft(
    { type: "social-post", channel, title, summary, body, opportunityId: opts?.opportunityId },
    projects,
  )
}

export type GenerateContentDraftInput =
  | {
      kind: "project-roundup"
      projects: ContentProjectInput[]
      channel?: ContentChannel
      theme?: ColdStartRoundupThemeId
      opportunityId?: string
    }
  | {
      kind: "trend-observation"
      projects: ContentProjectInput[]
      channel?: ContentChannel
      extraTags?: string[]
      opportunityId?: string
    }
  | { kind: "project-spotlight"; project: ContentProjectInput; channel?: ContentChannel; opportunityId?: string }
  | {
      kind: "social-post"
      projects: ContentProjectInput[]
      channel?: ContentChannel
      variant?: SocialPostVariant
      opportunityId?: string
    }

export function generateContentDraft(input: GenerateContentDraftInput): ContentDraft {
  switch (input.kind) {
    case "project-roundup":
      return generateProjectRoundupDraft(input.projects, {
        channel: input.channel,
        theme: input.theme,
        opportunityId: input.opportunityId,
      })
    case "trend-observation":
      return generateTrendObservationDraft(input.projects, {
        channel: input.channel,
        extraTags: input.extraTags,
        opportunityId: input.opportunityId,
      })
    case "project-spotlight":
      return generateProjectSpotlightDraft(input.project, {
        channel: input.channel,
        opportunityId: input.opportunityId,
      })
    case "social-post":
      return generateSocialPostDraft(input.projects, {
        channel: input.channel,
        variant: input.variant,
        opportunityId: input.opportunityId,
      })
    default: {
      const _: never = input
      return _ as never
    }
  }
}
