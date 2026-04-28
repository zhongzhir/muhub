"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const SEND_COOLDOWN_SEC = 60;

function sendCodeErrorMessage(error: string | undefined): string {
  switch (error) {
    case "invalid_phone":
      return "请输入正确的 11 位中国大陆手机号";
    case "rate_limited_cooldown":
      return "发送过于频繁，请 60 秒后再试";
    case "rate_limited_daily":
      return "该手机号今日发送次数已达上限";
    case "rate_limited_ip":
      return "当前网络请求过于频繁，请稍后再试";
    case "disabled":
      return "手机号登录未启用";
    case "no_database":
      return "服务暂不可用，请稍后再试";
    default:
      return "验证码发送失败，请稍后重试";
  }
}

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
    if (sending || loggingIn || cooldown > 0) {
      return;
    }
    setError(null);
    setHint(null);
    setSending(true);
    try {
      const res = await fetch("/api/auth/sms/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!data.ok) {
        setError(sendCodeErrorMessage(data.error));
        return;
      }

      setHint("验证码已发送，请在 5 分钟内输入。");
      setCooldown(SEND_COOLDOWN_SEC);
    } catch {
      setError("网络异常，请稍后再试");
    } finally {
      setSending(false);
    }
  }, [cooldown, loggingIn, phone, sending]);

  const login = useCallback(async () => {
    if (loggingIn || sending) {
      return;
    }
    setError(null);
    const p = phone.replace(/\D/g, "");
    const c = code.trim();
    if (!p || !c) {
      setError("请填写手机号与验证码");
      return;
    }
    setLoggingIn(true);
    try {
      const res = await fetch("/api/auth/sms/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p, code: c }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError("验证码错误、已过期或校验次数超限，请重新获取验证码");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("登录失败，请稍后再试");
    } finally {
      setLoggingIn(false);
    }
  }, [callbackUrl, code, loggingIn, phone, router, sending]);

  const inputClass = "muhub-input mt-1";

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
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
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
          disabled={sending || loggingIn || cooldown > 0}
          onClick={() => void sendCode()}
          className="muhub-btn-outline shrink-0"
        >
          {cooldown > 0 ? `${cooldown} 秒后可重发` : sending ? "发送中..." : "发送验证码"}
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
        disabled={loggingIn || sending}
        onClick={() => void login()}
        className="muhub-btn-primary w-full px-5 py-3 disabled:opacity-60"
      >
        {loggingIn ? "登录中..." : "手机号登录"}
      </button>
    </div>
  );
}
