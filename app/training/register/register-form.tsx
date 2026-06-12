"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function RegisterForm() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [organization, setOrganization] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setMessage(null);
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/training/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode,
          displayName,
          organization,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        alreadyBound?: boolean;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "绑定失败，请稍后重试。");
        return;
      }
      setMessage(data.alreadyBound ? "你已绑定本次活动身份，正在进入工作台。" : "身份绑定成功，正在进入工作台。");
      router.push("/training/workspace");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        请使用主办方发放的邀请码绑定本次活动身份。绑定后，系统会根据你的班级、小组或导师身份展示对应资料。
      </div>

      {message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <label className="block text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">活动邀请码 *</span>
        <input
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
          name="inviteCode"
          type="text"
          required
          placeholder="例如 C1G1-STUDENT"
          className={inputClass}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">姓名</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            name="displayName"
            type="text"
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">单位</span>
          <input
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
            name="organization"
            type="text"
            className={inputClass}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400"
      >
        {submitting ? "绑定中..." : "绑定身份并进入工作台"}
      </button>
    </form>
  );
}
