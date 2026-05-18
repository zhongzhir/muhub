import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
      "tests/**",
    ],
  },
  {
    files: ["muhub-ops-engine/**/*.js"],
    rules: {
      // muhub-ops-engine 是独立的 Node CommonJS 小工具链；此处不强套用 TS ESM import 规则
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["scripts/monitor-muhub-site.js"],
    rules: {
      // 运维巡查脚本为 Node CommonJS，保持 require 与现有运行方式一致
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
