import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "隐私政策",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell title="隐私政策" updatedAt="2026-04-13">
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">1. 引言</h2>
        <p className="mt-2">
          MUHUB（木哈布）重视您的个人信息与隐私保护。本政策适用于您使用 MUHUB 网站及相关服务的过程，说明我们如何收集、使用、存储和保护您的信息。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">2. 我们收集哪些信息</h2>
        <p className="mt-2">
          在提供服务过程中，我们可能在必要范围内收集：账户相关信息（当您注册或联系平台时提交的信息）、联系信息（如邮箱、电话等您主动提供的信息）、项目提交信息（如项目名称、链接、描述、标签、分类等）、基础使用信息（如访问日志、设备与浏览器信息、错误日志）以及为维持登录状态所需的 Cookie 或类似技术数据。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">3. 我们如何使用信息</h2>
        <p className="mt-2">
          我们可能将相关信息用于：提供、维护和改进服务；审核与展示项目内容；进行安全保障、风险控制和异常排查；与您沟通并处理反馈；履行法律法规要求。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">4. 我们如何共享、转让与公开披露</h2>
        <p className="mt-2">
          我们不会非法向第三方出售您的个人信息。仅在以下情形下，才会在合法、必要范围内共享相关信息：经您单独同意；为提供服务所必需的技术服务支持；依据法律法规或监管机关要求。除法律法规另有规定外，我们不会擅自公开披露您的个人信息。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">5. 信息存储与保护</h2>
        <p className="mt-2">
          我们将采取合理的管理与技术措施保护信息安全，防止未经授权的访问、披露、篡改或丢失。信息保存期限以实现处理目的所必需的最短时间为限，法律法规另有规定的从其规定。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">6. 用户权利</h2>
        <p className="mt-2">
          在适用法律规定范围内，您可通过 MUHUB@QQ.COM 提出查询、更正、删除、撤回同意、注销等请求，也可通过该联系方式进行投诉或举报。我们将在核验后依法处理。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">7. 儿童个人信息</h2>
        <p className="mt-2">
          平台原则上不面向未满 14 周岁的儿童提供服务。若确需处理儿童个人信息，我们将依法取得监护人同意，并采取与儿童信息敏感性相适应的保护措施。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">8. 政策更新</h2>
        <p className="mt-2">
          我们可根据法律法规、监管要求及业务变化更新本政策。重大变更将通过站内公告或其他合理方式提示。更新后的政策生效后，继续使用服务即视为您已知悉并同意更新内容。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">9. 联系我们</h2>
        <p className="mt-2">运营主体： 北京链上文投信息技术有限公司</p>
        <p>联系邮箱： MUHUB@QQ.COM</p>
        <p>联系地址： 北京市海淀区上地信息产业基地创业路6号</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">10. 其他说明</h2>
        <p className="mt-2">
          平台部分内容可能来自公开来源与 AI 辅助生成，相关信息仅供参考，不构成投资建议、商业承诺或结果保证。请您结合原始来源进行独立判断。
        </p>
      </section>
    </LegalPageShell>
  );
}
