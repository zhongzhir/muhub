"use client";

import Link from "next/link";
import { useState } from "react";

const inputClass = "muhub-input mt-1";

type SubmitState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string; duplicate?: boolean };

type Props = {
  slug: string;
};

export function ClaimProjectForm({ slug }: Props) {
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState({ kind: "idle" });

    const form = new FormData(event.currentTarget);
    const payload = {
      claimantName: String(form.get("claimantName") ?? ""),
      claimantRole: String(form.get("claimantRole") ?? ""),
      organizationName: String(form.get("organizationName") ?? ""),
      contactEmail: String(form.get("contactEmail") ?? ""),
      contactWechat: String(form.get("contactWechat") ?? ""),
      contactPhone: String(form.get("contactPhone") ?? ""),
      proofUrl: String(form.get("proofUrl") ?? ""),
      message: String(form.get("message") ?? ""),
    };

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        duplicate?: boolean;
      };
      if (!res.ok || !json.ok) {
        setState({ kind: "error", message: json.error || "提交失败，请稍后重试。" });
        return;
      }
      setState({
        kind: "success",
        message: json.message || "认领申请已提交。MUHUB 管理员会在核验后与你联系。",
        duplicate: json.duplicate,
      });
      event.currentTarget.reset();
    } catch {
      setState({ kind: "error", message: "网络异常，提交失败，请稍后重试。" });
    } finally {
      setPending(false);
    }
  }

  if (state.kind === "success") {
    return (
      <section className="muhub-card p-6" role="status" data-testid="claim-success">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          {state.duplicate ? "认领申请已存在" : "认领申请已提交"}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{state.message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/projects/${encodeURIComponent(slug)}`} className="muhub-btn-primary px-4 py-2 text-sm">
            返回项目页
          </Link>
          <Link href="/projects" className="muhub-btn-secondary px-4 py-2 text-sm">
            继续浏览项目广场
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="muhub-card space-y-6 p-5 sm:p-6" data-testid="project-claim-form">
      {state.kind === "error" ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
        >
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="claimantName">
            姓名 / 联系人
          </label>
          <input
            id="claimantName"
            name="claimantName"
            required
            maxLength={80}
            autoComplete="name"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="claimantRole">
            你与项目的关系
          </label>
          <select id="claimantRole" name="claimantRole" required className={inputClass} defaultValue="">
            <option value="" disabled>
              请选择
            </option>
            <option value="项目创始人">项目创始人</option>
            <option value="团队成员">团队成员</option>
            <option value="运营负责人">运营负责人</option>
            <option value="投资/孵化机构">投资/孵化机构</option>
            <option value="社区维护者">社区维护者</option>
            <option value="其他">其他</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="organizationName">
          机构/团队名称
        </label>
        <input id="organizationName" name="organizationName" maxLength={120} className={inputClass} />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="contactEmail">
            邮箱
          </label>
          <input id="contactEmail" name="contactEmail" type="email" maxLength={120} autoComplete="email" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="contactWechat">
            微信号
          </label>
          <input id="contactWechat" name="contactWechat" maxLength={120} autoComplete="off" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="contactPhone">
            手机号
          </label>
          <input id="contactPhone" name="contactPhone" maxLength={60} autoComplete="tel" className={inputClass} />
        </div>
      </div>
      <p className="-mt-4 text-xs text-zinc-500 dark:text-zinc-400">邮箱、微信号、手机号三者至少填写一项。</p>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="proofUrl">
          身份证明/项目方证明链接
        </label>
        <input
          id="proofUrl"
          name="proofUrl"
          type="url"
          maxLength={500}
          placeholder="官网团队页、GitHub profile、公司页面、公众号文章、LinkedIn 等"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="message">
          补充说明
        </label>
        <textarea id="message" name="message" maxLength={2000} rows={5} className={`${inputClass} resize-y`} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="submit" disabled={pending} className="muhub-btn-primary px-4 py-3 disabled:opacity-60">
          {pending ? "提交中..." : "提交认领申请"}
        </button>
        <Link href={`/projects/${encodeURIComponent(slug)}`} className="muhub-btn-secondary px-4 py-3">
          返回项目页
        </Link>
      </div>
    </form>
  );
}
