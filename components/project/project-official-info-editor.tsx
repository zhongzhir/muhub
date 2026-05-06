"use client";

import { useState } from "react";

type Props = {
  projectId: string;
  initial: {
    summary: string;
    fullDescription: string;
    website: string;
    twitter: string;
    discord: string;
    contactEmail: string;
    useCases: string[];
    whoFor: string[];
    collaborationNeeds: string;
    hiringNeeds: string;
  };
};

export function ProjectOfficialInfoEditor({ projectId, initial }: Props) {
  const [summary, setSummary] = useState(initial.summary);
  const [fullDescription, setFullDescription] = useState(initial.fullDescription);
  const [website, setWebsite] = useState(initial.website);
  const [twitter, setTwitter] = useState(initial.twitter);
  const [discord, setDiscord] = useState(initial.discord);
  const [contactEmail, setContactEmail] = useState(initial.contactEmail);
  const [collaborationNeeds, setCollaborationNeeds] = useState(initial.collaborationNeeds);
  const [hiringNeeds, setHiringNeeds] = useState(initial.hiringNeeds);
  const [useCases, setUseCases] = useState(initial.useCases.join("，"));
  const [whoFor, setWhoFor] = useState(initial.whoFor.join("，"));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/official-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary,
          fullDescription,
          website,
          twitter,
          discord,
          contactEmail,
          useCases: useCases.split(/[，,]/).map((item) => item.trim()).filter(Boolean),
          whoFor: whoFor.split(/[，,]/).map((item) => item.trim()).filter(Boolean),
          collaborationNeeds,
          hiringNeeds,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        window.alert(json.error || "保存官方信息失败。");
        return;
      }
      window.alert("官方信息已保存。");
      window.location.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="muhub-card space-y-3 p-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">官方信息编辑（项目方）</h3>
      <input className="muhub-input" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="一句话介绍" />
      <textarea className="muhub-input min-h-[120px]" value={fullDescription} onChange={(e) => setFullDescription(e.target.value)} placeholder="详细介绍" />
      <input className="muhub-input" value={useCases} onChange={(e) => setUseCases(e.target.value)} placeholder="使用场景（逗号分隔）" />
      <input className="muhub-input" value={whoFor} onChange={(e) => setWhoFor(e.target.value)} placeholder="适合人群（逗号分隔）" />
      <input className="muhub-input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="官网" />
      <input className="muhub-input" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="Twitter" />
      <input className="muhub-input" value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="Discord" />
      <input className="muhub-input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="联系邮箱" />
      <div className="space-y-1">
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">合作需求说明</label>
        <textarea
          className="muhub-input min-h-[72px]"
          rows={3}
          value={collaborationNeeds}
          onChange={(e) => setCollaborationNeeds(e.target.value)}
          placeholder="描述你的合作意向，例如：寻找渠道合作伙伴、技术联合开发..."
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">招聘需求</label>
        <textarea
          className="muhub-input min-h-[72px]"
          rows={3}
          value={hiringNeeds}
          onChange={(e) => setHiringNeeds(e.target.value)}
          placeholder="例如：寻找全栈工程师、产品设计师..."
        />
      </div>
      <button type="button" onClick={save} disabled={saving} className="muhub-btn-secondary px-3 py-2 text-sm disabled:opacity-60">
        {saving ? "保存中..." : "保存官方信息"}
      </button>
    </section>
  );
}
