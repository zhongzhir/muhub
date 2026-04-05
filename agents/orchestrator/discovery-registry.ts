/**
 * 来源 id → Discovery 函数映射。
 * 未注册的 id 由 growth-orchestrator 跳过并打日志，避免新增来源时忘记实现导致崩溃。
 *
 * Orchestrator 与 Discovery 职责边界见 docs/agent-system-layering-v1.md。
 */

import { discoverGitee } from "../discovery/gitee"
import { discoverGithubCN } from "../discovery/github-cn"
import { discoverManual } from "../discovery/manual"
import { discoverV2EX } from "../discovery/v2ex"
import type { DiscoveredProject } from "../types"

export type DiscoveryHandler = () => Promise<DiscoveredProject[]>

export const DISCOVERY_HANDLERS: Partial<Record<string, DiscoveryHandler>> = {
  "github-cn": discoverGithubCN,
  gitee: discoverGitee,
  v2ex: discoverV2EX,
  manual: discoverManual,
  // incubator-manual、event-manual 等预留来源暂无自动发现
}
