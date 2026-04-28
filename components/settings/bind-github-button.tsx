"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function BindGitHubButton({ callbackUrl }: { callbackUrl: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (pending) {
          return;
        }
        setPending(true);
        void signIn("github", { callbackUrl });
      }}
      className="muhub-btn-primary px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "跳转中..." : "绑定 GitHub"}
    </button>
  );
}
