/**
 * 外发记录落盘（data/external-publish-records.json），与 SiteContent 解耦存储。
 */

import { mkdir, readFile, writeFile } from "fs/promises"
import { randomBytes } from "crypto"
import { dirname, join } from "path"

import type {
  ExternalPublishChannel,
  ExternalPublishRecord,
  ExternalPublishStatus,
} from "./external-publish-types"

const REL_PATH = join("data", "external-publish-records.json")

const CHANNELS = new Set<ExternalPublishChannel>(["generic"])
const STATUSES = new Set<ExternalPublishStatus>(["generated"])

function filePath(): string {
  return join(process.cwd(), REL_PATH)
}

function coerceRow(raw: unknown): ExternalPublishRecord | null {
  if (!raw || typeof raw !== "object") {
    return null
  }
  const o = raw as Record<string, unknown>
  if (
    typeof o.id !== "string" ||
    typeof o.contentId !== "string" ||
    typeof o.channel !== "string" ||
    typeof o.status !== "string" ||
    typeof o.createdAt !== "string"
  ) {
    return null
  }
  if (!CHANNELS.has(o.channel as ExternalPublishChannel)) {
    return null
  }
  if (!STATUSES.has(o.status as ExternalPublishStatus)) {
    return null
  }
  return {
    id: o.id,
    contentId: o.contentId,
    channel: o.channel as ExternalPublishChannel,
    status: o.status as ExternalPublishStatus,
    createdAt: o.createdAt,
  }
}

function safeParse(raw: string): ExternalPublishRecord[] {
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) {
      return []
    }
    return data.map(coerceRow).filter((x): x is ExternalPublishRecord => x !== null)
  } catch {
    return []
  }
}

export async function readAllExternalPublishRecords(): Promise<ExternalPublishRecord[]> {
  try {
    return safeParse(await readFile(filePath(), "utf8"))
  } catch {
    return []
  }
}

export function newExternalPublishRecordId(): string {
  return `epub-${Date.now()}-${randomBytes(4).toString("hex")}`
}

export async function appendExternalPublishRecord(input: {
  contentId: string
  channel: ExternalPublishChannel
  status: ExternalPublishStatus
}): Promise<ExternalPublishRecord> {
  const path = filePath()
  const list = await readAllExternalPublishRecords()
  const record: ExternalPublishRecord = {
    id: newExternalPublishRecordId(),
    contentId: input.contentId,
    channel: input.channel,
    status: input.status,
    createdAt: new Date().toISOString(),
  }
  list.push(record)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(list, null, 2)}\n`, "utf8")
  return record
}
