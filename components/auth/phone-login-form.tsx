"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const SEND_COOLDOWN_SEC = 60;

export function PhoneLoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const t = window.setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = useCallback(async () => {
    setError(null);
    setHint(null);
    setSending(true);
    try {
      const res = await fetch("/api/auth/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        devCode?: string;
      };

      if (!data.ok) {
        const msg =
          data.error === "invalid_phone"
            ? "请输入正确的 11 位中国大陆手机号"
            : data.error === "rate_limited_cooldown"
              ? "发送过于频繁，请 60 秒后再试"
              : data.error === "rate_limited_daily"
                ? "该号码 24 小时内发送次数已达上限"
                : data.error === "disabled"
                  ? "手机号登录未启用"
                  : data.error === "no_database"
                    ? "服务未就绪，请稍后再试"
                    : "验证码发送失败，请稍后重试";
        setError(msg);
        return;
      }

      let msg = "验证码已发送。开发环境请查看服务端日志。";
      if (typeof data.devCode === "string" && process.env.NODE_ENV !== "production") {
        msg += ` （调试 devCode：${data.devCode}）`;
      }
      setHint(msg);
      setCooldown(SEND_COOLDOWN_SEC);
    } catch {
      setError("网络异常，请稍后再试");
    } finally {
      setSending(false);
    }
  }, [phone]);

  const login = useCallback(async () => {
    setError(null);
    const p = phone.replace(/\D/g, "");
    const c = code.trim();
    if (!p || !c) {
      setError("请填写手机号与验证码");
      return;
    }
    setLoggingIn(true);
    try {
      const res = await signIn("phone-login", {
        phone: p,
        code: c,
        redirect: false,
      });
      if (!res?.ok || res.error) {
        setError("验证码错误、已过期或校验次数超限，请重新获取验证码");
        setLoggingIn(false);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("登录失败，请稍后再试");
      setLoggingIn(false);
    }
  }, [callbackUrl, code, phone, router]);

  const inputClass =
    "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:focus:border-zinc-400";

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="phone-login-phone">
          手机号
        </label>
        <input
          id="phone-login-phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="11 位中国大陆手机号"
          className={inputClass}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={11}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="phone-login-code">
            验证码
          </label>
          <input
            id="phone-login-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6 位数字"
            className={inputClass}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
          />
        </div>
        <button
          type="button"
          disabled={sending || cooldown > 0}
          onClick={() => void sendCode()}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {cooldown > 0 ? `${cooldown} 秒后可重发` : sending ? "发送中…" : "发送验证码"}
        </button>
      </div>

      {hint ? (
        <p className="text-sm text-emerald-800 dark:text-emerald-200/90" role="status">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={loggingIn}
        onClick={() => void login()}
        className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {loggingIn ? "登录中…" : "手机号登录"}
      </button>
    </div>
  );
}
