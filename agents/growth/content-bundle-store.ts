/**
 * V1.3：内容资产包本地存储（可迁移 DB）。
 */

import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"

import type { ContentBundle } from "./content-bundle"

const REL_PATH = join("data", "content-bundles.json")

function filePath(): string {
  return join(process.cwd(), REL_PATH)
}

function isBundle(x: unknown): x is ContentBundle {
  if (!x || typeof x !== "object") {
    return false
  }
  const o = x as Record<string, unknown>
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.createdAt === "string" &&
    (!o.socialPosts || typeof o.socialPosts === "object")
  )
}

function safeParse(raw: string): ContentBundle[] {
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) {
      return []
    }
    return data.filter(isBundle)
  } catch {
    return []
  }
}

export async function readBundles(): Promise<ContentBundle[]> {
  const path = filePath()
  try {
    const raw = await readFile(path, "utf8")
    return safeParse(raw)
  } catch {
    return []
  }
}

/** 新 bundle 在前 */
export async function readBundlesLatestFirst(): Promise<ContentBundle[]> {
  const list = await readBundles()
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function appendBundle(bundle: ContentBundle): Promise<void> {
  const path = filePath()
  const existing = await readBundles()
  existing.push(bundle)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(existing, null, 2)}\n`, "utf8")
}
