export const OPEN_PROJECTS_META = {
  title: "开放项目入门",
  subtitle: "写给没有技术背景用户的 GitHub / GitCode / Gitee 使用指南",
  intro:
    "很多 MUHUB 项目来自 GitHub、GitCode、Gitee 等开放代码平台。本指南帮助非技术用户理解这些平台，并学会查看、下载和安全使用开放项目。",
} as const;

export const OPEN_PROJECTS_TOC = [
  { id: "what-are-platforms", title: "什么是 GitHub、GitCode、Gitee 这类开放代码平台？" },
  { id: "read-project-page", title: "小白如何看懂一个开源项目页面？" },
  { id: "download-to-local", title: "如何把开源项目下载到本地电脑？" },
  { id: "use-cases-and-safety", title: "普通用户使用开源项目的常见场景和安全提醒" },
] as const;

export const OPEN_PROJECTS_SECURITY_WARNINGS = [
  {
    title: "不要随便运行陌生代码",
    body: "看到网上的命令，不要不理解就复制运行。尤其是包含 rm -rf、sudo、curl ... | sh、powershell、Invoke-WebRequest 等内容的命令。如果不了解含义，先问技术人员。",
  },
  {
    title: "不要泄露敏感信息",
    body: "不要把银行卡信息、身份证信息、手机验证码、私钥、助记词、钱包密码、重要账号密码、公司内部 API Key、数据库密码等内容填进陌生项目。",
  },
  {
    title: "不要以为开源就一定安全",
    body: "开源意味着代码可以被公开查看，但不代表一定安全、稳定或没有恶意内容。普通用户仍然要看项目来源、作者信誉、社区反馈和下载渠道。",
  },
  {
    title: "商用前一定看许可证",
    body: "开源不等于免费商用。尤其是公司项目、商业产品、客户交付、二次开发时，要先确认 License。",
  },
  {
    title: "MUHUB 展示不等于背书",
    body: "MUHUB 的目标是帮助用户更完整地看到项目公开信息。MUHUB 不对项目的安全性、可用性、投资价值、商业价值作保证。用户应结合官方说明、社区反馈、技术评估和自身需求作出判断。",
  },
] as const;
