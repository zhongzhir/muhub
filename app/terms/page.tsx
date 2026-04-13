import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "用户协议",
};

export default function TermsPage() {
  return (
    <LegalPageShell title="用户协议" updatedAt="2026-04-13">
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">1. 适用范围</h2>
        <p className="mt-2">
          欢迎使用 MUHUB（木哈布）网站及相关服务。本《用户协议》适用于您访问、浏览、注册、提交项目信息、使用项目发现与内容补全等服务的全部过程。
          您使用本服务即表示已阅读并同意本协议。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">2. 服务内容</h2>
        <p className="mt-2">
          MUHUB 当前主要提供项目展示、项目发现、项目内容补全、信息浏览等服务。平台可根据法律法规、监管要求及实际运营情况，对服务功能、展示方式和产品结构进行调整。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">3. 用户注册与使用规则</h2>
        <p className="mt-2">
          您应提供真实、合法、有效的信息，不得冒用他人身份或提交虚假资料。您不得利用平台从事违法违规活动，不得干扰平台正常运行或损害他人合法权益。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">4. 用户提交内容规则</h2>
        <p className="mt-2">
          您对提交的项目名称、链接、图片、文本、标签及其他信息的真实性、合法性负责。不得上传或传播违法、侵权、误导性内容，不得侵犯他人知识产权、名誉权、隐私权及其他合法权益。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">5. 平台处理与处置权利</h2>
        <p className="mt-2">
          对涉嫌违法违规、侵权、虚假或误导的信息，平台有权在合理范围内采取删除、屏蔽、下架、限制展示等措施。平台可基于运营需要调整内容排序、展示逻辑和服务结构。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">6. 知识产权</h2>
        <p className="mt-2">
          MUHUB 平台自身页面设计、代码、标识、数据库整理内容等相关权利归平台或相关权利人所有。用户提交内容的权利归原权利人所有；您同意授予平台在提供服务所必需范围内对该内容进行非独占、可撤销的展示、传播、收录与优化处理授权。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">7. 免责声明与责任限制</h2>
        <p className="mt-2">
          平台不对第三方链接、外部项目、外部网站内容的准确性、完整性、持续可用性作保证。平台展示信息仅供参考，不构成投资建议、商业建议或法律建议。因不可抗力、系统维护或第三方服务异常导致的服务中断或波动，平台将在法律允许范围内承担相应责任。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">8. 协议变更与终止</h2>
        <p className="mt-2">
          平台可根据法律法规、监管要求或业务变化更新本协议。重大变更将通过站内公告或其他合理方式提示。若您不同意更新内容，可停止使用相关服务。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">9. 法律适用与争议解决</h2>
        <p className="mt-2">本协议的订立、执行和解释及争议的解决均适用中华人民共和国法律。</p>
        <p className="mt-2">
          如双方就本协议内容或其执行发生任何争议，双方应友好协商解决；协商不成时，任何一方均可向北京市海淀区人民法院提起诉讼。
        </p>
      </section>
    </LegalPageShell>
  );
}
