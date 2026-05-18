import type { ReactNode } from "react";
import Link from "next/link";
import { HelpCallout, HelpList, HelpProse, HelpTable } from "@/components/help/help-blocks";
import { OPEN_PROJECTS_SECURITY_WARNINGS, OPEN_PROJECTS_TOC } from "@/lib/help/open-projects";

function ArticleCard({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article id={id} className="muhub-card scroll-mt-24 p-6 md:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </article>
  );
}

export function OpenProjectsGuide() {
  return (
    <div className="space-y-10">
      <nav aria-label="本页目录" className="muhub-card p-5 md:p-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">目录</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {OPEN_PROJECTS_TOC.map((item, index) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
              >
                {index + 1}. {item.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <ArticleCard id="what-are-platforms" title={OPEN_PROJECTS_TOC[0].title}>
        <HelpProse>
          很多 MUHUB 上展示的项目，都会提供 GitHub、GitCode、Gitee 等代码平台链接。对于没有技术背景的用户来说，可以先把它们理解为：
        </HelpProse>
        <HelpCallout>
          <p className="font-medium">项目的「公开工作台」和「技术档案馆」。</p>
        </HelpCallout>
        <HelpProse>一个项目如果把代码、说明文档、更新记录放在这些平台上，外部用户就可以看到：</HelpProse>
        <HelpList
          items={[
            "这个项目做什么；",
            "最近有没有更新；",
            "开发是否活跃；",
            "是否有安装说明；",
            "是否允许别人使用、修改或参与贡献；",
            "是否有其他用户提出问题、反馈 bug 或参与讨论。",
          ]}
        />
        <HelpProse>
          GitHub 是全球常用的代码托管与协作平台。开发者可以在上面保存代码、管理项目、协作开发、发布版本。
        </HelpProse>
        <HelpProse>
          GitCode、Gitee 是国内常见的代码托管和研发协作平台，也可以用来保存代码、管理项目、展示开源成果和协作开发。
        </HelpProse>
        <HelpProse>
          普通用户不用一开始就理解所有技术细节，只需要先知道：这些平台记录了一个技术项目的公开资料、更新过程和社区反馈。
        </HelpProse>
        <HelpProse>你可以重点看这些地方：</HelpProse>
        <HelpTable
          headers={["你想了解什么", "可以看哪里"]}
          rows={[
            ["项目是做什么的", "README / 项目介绍"],
            ["怎么安装使用", "Installation / Quick Start / 使用说明"],
            ["最近是否还在更新", "Commits / Releases / 更新记录"],
            ["是否有人使用和反馈", "Issues / Discussions"],
            ["是否允许商用", "License / 许可证"],
            ["有没有正式版本", "Releases / 发行版"],
          ]}
        />
        <HelpCallout>
          提醒：MUHUB 展示 GitHub、GitCode、Gitee 等公开信息，是为了帮助用户更好地理解项目，并不等于 MUHUB
          对项目质量、安全性、商业价值或投资价值作出保证。
        </HelpCallout>
      </ArticleCard>

      <ArticleCard id="read-project-page" title={OPEN_PROJECTS_TOC[1].title}>
        <HelpProse>
          打开一个 GitHub、GitCode、Gitee 项目页面后，很多人第一眼会看到一堆英文、文件夹和代码，容易不知道从哪里开始。其实普通用户只需要先看几个关键位置。
        </HelpProse>

        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">1. 先看项目名称和简介</h3>
        <HelpProse>通常页面顶部会显示：项目名称、简短介绍、官网链接、标签或技术分类。你可以先判断：这个项目是不是你要找的东西。</HelpProse>
        <HelpProse>例如：是 AI 工具？是网页应用？是数据集？是浏览器插件？是命令行工具？是模型、插件、模板，还是完整软件？</HelpProse>

        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">2. 看 README</h3>
        <HelpProse>README 通常是项目最重要的说明书，一般会告诉你项目做什么、有哪些功能、如何安装与运行、有没有截图或示例、使用时需要注意什么。</HelpProse>
        <HelpProse>如果你没有技术背景，建议优先找这些标题：</HelpProse>
        <HelpList
          items={[
            "Quick Start",
            "Getting Started",
            "Installation",
            "Usage",
            "Demo",
            "Documentation",
            "中文文档",
            "使用说明",
          ]}
        />

        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">3. 看 Releases</h3>
        <HelpProse>Releases 可以理解为「正式发布版本」。有些项目的代码不能直接双击运行，但作者会在 Releases 里放已经打包好的文件，例如：</HelpProse>
        <HelpList
          items={[
            "Windows 安装包；",
            "macOS 安装包；",
            "压缩包；",
            "浏览器插件文件；",
            "移动端安装包；",
            "模型文件；",
            "示例数据。",
          ]}
        />
        <HelpProse>普通用户如果只是想使用软件，优先看 Releases，而不是直接下载 Source code。</HelpProse>

        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">4. 看 License</h3>
        <HelpProse>License 是许可证，决定你能不能使用、修改、传播或商用这个项目。</HelpProse>
        <HelpTable
          headers={["许可证情况", "通俗理解"]}
          rows={[
            ["MIT / Apache-2.0", "通常比较开放，但仍需遵守条款"],
            ["GPL", "可以使用，但修改和再发布时有更多要求"],
            ["没有 License", "不代表可以随便使用，尤其不要直接商用"],
            ["商业许可", "可能需要购买授权"],
          ]}
        />
        <HelpCallout>
          小白原则：如果你只是自己学习、体验，一般风险较低；如果要用于公司业务、产品上线、商用传播，最好先确认许可证。
        </HelpCallout>

        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">5. 看 Issues</h3>
        <HelpProse>Issues 是用户反馈问题的地方。你可以观察：有没有很多人反馈无法安装；作者有没有回复；最近的问题有没有处理；有没有严重安全或稳定性问题。这对普通用户判断项目是否成熟很有帮助。</HelpProse>
      </ArticleCard>

      <ArticleCard id="download-to-local" title={OPEN_PROJECTS_TOC[2].title}>
        <HelpProse>
          很多用户看到「开源项目」后，会以为下载后就能像普通软件一样双击运行。实际情况要分几种。
        </HelpProse>

        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">方式一：下载压缩包</h3>
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">适合人群：不懂代码，只想先看看项目文件、文档或简单尝试。</p>
        <HelpProse>一般步骤：</HelpProse>
        <HelpList
          ordered
          items={[
            "打开项目页面；",
            "找到 Code / 克隆 / 下载 按钮；",
            "选择 Download ZIP 或下载压缩包；",
            "下载完成后解压；",
            "打开文件夹，先看 README 文件。",
          ]}
        />
        <HelpProse>适合下载 ZIP 的情况：只想查看说明文档、交给技术人员研究、保存一份源码，或项目是网页模板、图片素材、文档模板等。</HelpProse>
        <HelpProse>
          不适合的情况：项目需要复杂安装环境、依赖数据库、需要 API Key、需要命令行运行，或项目本身是开发者工具或代码库。
        </HelpProse>

        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">方式二：下载正式发行版</h3>
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">适合人群：想直接使用软件，而不是研究代码。</p>
        <HelpList
          ordered
          items={[
            "打开项目页面；",
            "找到 Releases / 发行版；",
            "进入最新版本；",
            "在 Assets / 附件 区域寻找适合自己电脑的文件；",
            "下载后按说明安装。",
          ]}
        />
        <HelpTable
          headers={["文件类型", "可能适合谁"]}
          rows={[
            [".exe", "Windows 用户"],
            [".msi", "Windows 安装包"],
            [".dmg", "macOS 用户"],
            [".zip", "压缩包，需要解压"],
            [".apk", "Android 安装包"],
            [".tar.gz", "更偏技术用户"],
            ["Source code", "源代码，不一定能直接运行"],
          ]}
        />
        <HelpCallout>
          小白建议：优先找 .exe、.msi、.dmg、.apk 这类安装文件。看到 Source code 不要急着下载，它通常是给开发者看的源码包。
        </HelpCallout>

        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">方式三：Clone 克隆项目</h3>
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">适合人群：懂一点 Git，或者有技术人员协助。</p>
        <HelpProse>
          所谓 Clone，就是把远程平台上的项目完整复制到本地电脑，并保留后续同步更新的能力。常见命令是：
        </HelpProse>
        <pre className="overflow-x-auto rounded-lg bg-zinc-100 px-4 py-3 font-mono text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
          git clone 项目地址
        </pre>
        <HelpProse>
          普通用户如果看到这些命令，不用紧张。你可以把它理解为：用专业工具把项目完整复制到自己电脑上。如果你不熟悉命令行，建议请技术人员协助。
        </HelpProse>

        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">下载后为什么不能直接运行？</h3>
        <HelpProse>这是很多小白最容易遇到的问题。原因是：开源项目不一定是「已经打包好的软件」。它可能只是：</HelpProse>
        <HelpList
          items={[
            "一套源代码；",
            "一个开发框架；",
            "一个插件；",
            "一个模型；",
            "一个接口服务；",
            "一个网页项目；",
            "一个需要数据库和服务器的系统。",
          ]}
        />
        <HelpProse>所以下载后可能还需要：安装 Python、Node.js、Java 等运行环境；安装依赖包；配置数据库；填写 API Key；修改配置文件；执行启动命令。</HelpProse>
        <HelpProse>如果 README 中出现以下词汇，说明它可能需要一定技术基础：</HelpProse>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          npm install、pip install、docker、database、.env、API_KEY、build、localhost、deploy
        </p>
        <HelpCallout>这时建议请技术人员协助，不要随意操作。</HelpCallout>
      </ArticleCard>

      <ArticleCard id="use-cases-and-safety" title={OPEN_PROJECTS_TOC[3].title}>
        <HelpProse>
          开放代码平台不仅给程序员使用，普通用户也可以用它来了解项目、试用工具、学习技术、判断项目活跃度。
        </HelpProse>

        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">场景一：我只是想了解这个项目靠不靠谱</h3>
        <HelpProse>你可以看：README 是否清楚；最近是否更新；Releases 是否有正式版本；Issues 是否有人反馈；作者是否持续回复；是否有官网、文档、演示地址；License 是否明确。</HelpProse>
        <HelpCallout>如果一个项目长期没有更新、说明很少、没有许可证、问题没人回复，就要谨慎。</HelpCallout>

        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">场景二：我想下载一个工具自己用</h3>
        <HelpProse>建议顺序：优先找项目官网；再找 Releases；优先下载正式安装包；不要随便下载陌生人提供的第三方安装包；安装前先看说明和用户反馈。</HelpProse>

        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">场景三：我想让技术人员帮我部署</h3>
        <HelpProse>你可以把这些信息发给技术人员：MUHUB 项目页面链接；GitHub / GitCode / Gitee 链接；README 链接；Releases 链接；你希望实现的用途；你的电脑系统或服务器环境。</HelpProse>
        <HelpCallout>
          你可以这样说：我在 MUHUB 上看到这个开放项目，想在本地或服务器上试用。请帮我看一下 README，判断是否能安装、需要什么环境、有没有安全风险。
        </HelpCallout>

        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">场景四：我想参与项目或反馈问题</h3>
        <HelpProse>即使不会写代码，也可以参与开源项目：提 Issue 反馈 bug 或提出建议；写使用体验；补充中文说明；分享教程；提供测试反馈；向项目方提出合作需求。</HelpProse>
        <HelpProse>开放项目的价值不只来自代码，也来自用户、社区、反馈和传播。</HelpProse>
      </ArticleCard>

      <section
        id="security-reminder"
        className="scroll-mt-24 rounded-xl border-2 border-red-200 bg-red-50 p-6 dark:border-red-900/60 dark:bg-red-950/30 md:p-8"
        aria-labelledby="security-reminder-heading"
      >
        <h2 id="security-reminder-heading" className="text-lg font-bold text-red-900 dark:text-red-100">
          安全提醒
        </h2>
        <ol className="mt-5 space-y-5">
          {OPEN_PROJECTS_SECURITY_WARNINGS.map((item, index) => (
            <li key={item.title} className="text-sm leading-relaxed text-red-950 dark:text-red-100">
              <span className="font-semibold">
                {index + 1}. {item.title}
              </span>
              <p className="mt-1 text-red-900/90 dark:text-red-100/90">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/help" className="underline-offset-4 hover:underline">
          返回网站帮助
        </Link>
      </p>
    </div>
  );
}
