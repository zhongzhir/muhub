"use client"

import { useCallback, useState, useTransition } from "react"

import { generateExternalPostAction } from "@/app/dashboard/launch/actions"

export function ExternalPostGenerator({ siteContentId }: { siteContentId: string }) {
  const [text, setText] = useState("")
  const [hint, setHint] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  const onGenerate = () => {
    setHint(null)
    setCopied(false)
    startTransition(async () => {
      const res = await generateExternalPostAction(siteContentId)
      if (!res.ok) {
        setHint(res.error)
        setText("")
        return
      }
      setText(res.text)
    })
  }

  const onCopy = useCallback(async () => {
    setHint(null)
    setCopied(false)
    if (!text.trim()) {
      setHint("请先生成文案。")
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setHint("复制失败，请手动选中文本复制。")
    }
  }, [text])

  return (
    <div className="mt-4 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onGenerate}
          className="rounded-lg border border-violet-500/50 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-900 hover:bg-violet-500/20 disabled:opacity-50 dark:text-violet-200 dark:hover:bg-violet-500/20"
        >
          {pending ? "Generating…" : "Generate External Post"}
        </button>
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => void onCopy()}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        >
          Copy
        </button>
        {copied ? <span className="text-xs text-teal-600 dark:text-teal-400">已复制</span> : null}
      </div>
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400" htmlFor={`ext-post-${siteContentId}`}>
        Post draft (edit before copy)
      </label>
      <textarea
        id={`ext-post-${siteContentId}`}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setCopied(false)
        }}
        rows={10}
        placeholder="点击 Generate External Post 生成标题、摘要、链接与话题标签……"
        className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
      {hint ? (
        <p className="text-xs text-amber-800 dark:text-amber-200" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
