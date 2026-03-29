/**
 * V1.1：未勾选「立即创建」时的本地待导入队列（JSON 文件）。
 * 未来可迁移到数据库表 pending_imports；保留 append / 类型即可切换实现。
 */

import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"
import type { ImportCandidate } from "./import-types"

export type PendingExternalImportRecord = ImportCandidate & {
  savedAt: string
}

const REL_PATH = join("data", "pending-external-imports.json")

function filePath(): string {
  return join(process.cwd(), REL_PATH)
}

export async function appendPendingImport(candidate: ImportCandidate): Promise<void> {
  const path = filePath()
  let list: PendingExternalImportRecord[] = []
  try {
    const raw = await readFile(path, "utf8")
    const parsed: unknown = JSON.parse(raw)
    list = Array.isArray(parsed) ? (parsed as PendingExternalImportRecord[]) : []
  } catch {
    list = []
  }
  list.push({
    ...candidate,
    savedAt: new Date().toISOString(),
  })
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(list, null, 2)}\n`, "utf8")
}
