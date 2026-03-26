/**
 * 横版品牌 lockup（图形标 + 木哈布），用于 Header。
 * 使用 inline SVG，字标随 `currentColor` 适配明暗主题。
 */
type LogoLockupProps = {
  className?: string;
  /** 条案高度，建议 32–36（tailwind h-8 / h-9） */
  heightClass?: string;
};

export function BrandLogoLockup({ className = "", heightClass = "h-8" }: LogoLockupProps) {
  return (
    <svg
      viewBox="0 0 236 48"
      className={`w-auto shrink-0 text-zinc-900 dark:text-zinc-50 ${heightClass} ${className}`}
      role="img"
      aria-label="木哈布"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="mhLockupGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f172a" />
          <stop offset="0.55" stopColor="#134e4a" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#mhLockupGrad)" />
      <g stroke="#f8fafc" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M11.5 15h25" />
        <path d="M24 15v19" />
        <path d="M24 24.5L16 36" />
        <path d="M24 24.5L32 36" />
      </g>
      <text
        x="58"
        y="33.5"
        fill="currentColor"
        fontSize="26"
        fontWeight="700"
        style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: "-0.02em" }}
      >
        木哈布
      </text>
    </svg>
  );
}
