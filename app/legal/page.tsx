import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "法律声明",
};

export default function LegalNoticePage() {
  return (
    <LegalPageShell title="法律声明" updatedAt="2026-04-13">
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">1. 网站权利声明</h2>
        <p className="mt-2">
          MUHUB 网站整体内容、页面设计、数据库整理、代码、标识、图形及相关资料受中华人民共和国法律法规保护。未经权利人书面许可，任何主体不得以不当方式复制、传播或用于其他商业目的。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">2. 信息来源说明</h2>
        <p className="mt-2">
          平台内容可能来源于用户提交、公开网络信息、第三方链接、自动发现系统以及 AI 辅助生成补全。平台会尽合理努力进行整理与展示，但不承诺所有信息绝对准确、完整或实时更新。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">3. 非投资与非保证声明</h2>
        <p className="mt-2">
          平台展示内容仅供一般信息参考，不构成投资建议、融资承诺、背书、担保或推荐。用户应结合自身情况独立判断并自行承担决策风险。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">4. 第三方链接声明</h2>
        <p className="mt-2">
          平台可能链接至 GitHub、项目官网、社交媒体及其他第三方页面。该等页面由其运营方独立管理，相关内容、可用性与合规性由第三方自行负责。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">5. 知识产权与侵权处理</h2>
        <p className="mt-2">
          如权利人认为平台内容侵犯其合法权益，可通过【联系邮箱待补充】提交权利通知及必要证明材料。平台在核实后将依法采取删除、屏蔽或其他必要处理措施。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">6. AI 内容说明</h2>
        <p className="mt-2">
          平台部分摘要、标签及结构化信息可能由 AI 自动生成或辅助生成。该类内容可能存在不准确、不完整或时效滞后等情况，请用户结合原始来源进行核实。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">7. 未成年人说明</h2>
        <p className="mt-2">
          平台原则上不面向未满 14 周岁的儿童主动提供专门服务。若确需处理儿童个人信息，平台将依法取得监护人同意并采取相应保护措施。
        </p>
      </section>
    </LegalPageShell>
  );
}
