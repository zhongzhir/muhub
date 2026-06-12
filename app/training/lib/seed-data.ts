import { TRAINING_2026_EVENT, TRAINING_2026_EVENT_SLUG } from "./current-event";

export { TRAINING_2026_EVENT, TRAINING_2026_EVENT_SLUG };

export type TrainingRole = "student" | "mentor" | "admin";

export type TrainingGroupSeed = {
  classNo: number;
  groupNo: number;
  name: string;
  caseSlug: string;
};

export type TrainingCaseSeed = {
  slug: string;
  name: string;
  organization: string;
  classNo: number;
  groupNo: number;
  track: string;
  traits: string;
  summary: string;
  needAndUsers: string;
  competitors: string;
  technologyAdoption: string;
  marketAndBenefits: string;
  teamMechanism: string;
  challenges: string;
  touchpointExperience: string;
  attachmentsJson: Array<{ title: string; note: string }>;
};

export type TrainingTaskSeed = {
  key: string;
  dayIndex: number;
  title: string;
  description: string;
  activitiesJson: string[];
  deliverablesJson: string[];
  promptPackJson: string[];
  sortOrder: number;
};

export type TrainingInviteSeed = {
  code: string;
  role: TrainingRole;
  classNo: number | null;
  groupNo: number | null;
  maxUses: number;
  note: string;
};

const MATERIAL_PENDING = "该部分资料将由活动组织方统一补充，当前请以现场发放材料为准。";

export const training2026Cases: TrainingCaseSeed[] = [
  {
    slug: "phoenix-zhiling",
    name: "凤凰智灵平台",
    organization: "江苏凤凰传媒股份",
    classNo: 1,
    groupNo: 1,
    track: "AI+教育",
    traits: "面向教育出版场景的智能化平台案例。",
    summary: MATERIAL_PENDING,
    needAndUsers: MATERIAL_PENDING,
    competitors: MATERIAL_PENDING,
    technologyAdoption: MATERIAL_PENDING,
    marketAndBenefits: MATERIAL_PENDING,
    teamMechanism: MATERIAL_PENDING,
    challenges: MATERIAL_PENDING,
    touchpointExperience: MATERIAL_PENDING,
    attachmentsJson: [],
  },
  {
    slug: "sanjin-culture-model",
    name: "三晋文化大模型",
    organization: "山西出版集团",
    classNo: 1,
    groupNo: 2,
    track: "AI+传统文化",
    traits: "面向区域文化资源活化与知识服务的大模型案例。",
    summary: MATERIAL_PENDING,
    needAndUsers: MATERIAL_PENDING,
    competitors: MATERIAL_PENDING,
    technologyAdoption: MATERIAL_PENDING,
    marketAndBenefits: MATERIAL_PENDING,
    teamMechanism: MATERIAL_PENDING,
    challenges: MATERIAL_PENDING,
    touchpointExperience: MATERIAL_PENDING,
    attachmentsJson: [],
  },
  {
    slug: "sanlian-civilization-tracing",
    name: "三联文明寻踪",
    organization: "三联生活周刊",
    classNo: 2,
    groupNo: 1,
    track: "期刊+文旅",
    traits: "将期刊内容品牌与文旅体验结合的融合出版案例。",
    summary: MATERIAL_PENDING,
    needAndUsers: MATERIAL_PENDING,
    competitors: MATERIAL_PENDING,
    technologyAdoption: MATERIAL_PENDING,
    marketAndBenefits: MATERIAL_PENDING,
    teamMechanism: MATERIAL_PENDING,
    challenges: MATERIAL_PENDING,
    touchpointExperience: MATERIAL_PENDING,
    attachmentsJson: [],
  },
  {
    slug: "lianhuanhua-ai-vertical-model",
    name: "连环画人工智能垂类模型",
    organization: "人民美术出版社",
    classNo: 2,
    groupNo: 2,
    track: "美育教育新业态",
    traits: "围绕连环画、美育教育与垂类 AI 模型建设的案例。",
    summary: MATERIAL_PENDING,
    needAndUsers: MATERIAL_PENDING,
    competitors: MATERIAL_PENDING,
    technologyAdoption: MATERIAL_PENDING,
    marketAndBenefits: MATERIAL_PENDING,
    teamMechanism: MATERIAL_PENDING,
    challenges: MATERIAL_PENDING,
    touchpointExperience: MATERIAL_PENDING,
    attachmentsJson: [],
  },
  {
    slug: "phoenix-literature-ai-comic-drama",
    name: "凤凰文艺 AI 漫剧",
    organization: "凤凰文艺",
    classNo: 3,
    groupNo: 1,
    track: "IP 衍生漫剧",
    traits: "围绕出版 IP 二次开发与 AI 漫剧生成的案例。",
    summary: MATERIAL_PENDING,
    needAndUsers: MATERIAL_PENDING,
    competitors: MATERIAL_PENDING,
    technologyAdoption: MATERIAL_PENDING,
    marketAndBenefits: MATERIAL_PENDING,
    teamMechanism: MATERIAL_PENDING,
    challenges: MATERIAL_PENDING,
    touchpointExperience: MATERIAL_PENDING,
    attachmentsJson: [],
  },
  {
    slug: "china-treasure-hunt",
    name: "大中华寻宝记",
    organization: "中文传媒 21 世纪出版社",
    classNo: 3,
    groupNo: 2,
    track: "出版 IP 多模态",
    traits: "围绕少儿出版 IP 的多模态开发与运营案例。",
    summary: MATERIAL_PENDING,
    needAndUsers: MATERIAL_PENDING,
    competitors: MATERIAL_PENDING,
    technologyAdoption: MATERIAL_PENDING,
    marketAndBenefits: MATERIAL_PENDING,
    teamMechanism: MATERIAL_PENDING,
    challenges: MATERIAL_PENDING,
    touchpointExperience: MATERIAL_PENDING,
    attachmentsJson: [],
  },
];

export const training2026Groups: TrainingGroupSeed[] = training2026Cases.map((item) => ({
  classNo: item.classNo,
  groupNo: item.groupNo,
  name: `${item.classNo} 班 ${item.groupNo} 组`,
  caseSlug: item.slug,
}));

export const training2026Tasks: TrainingTaskSeed[] = [
  {
    key: "organization_preview",
    dayIndex: 1,
    title: "组织建设与案例预习",
    description: "完成小组分工，预读案例材料，形成问题清单。",
    activitiesJson: ["小组分工", "案例预读"],
    deliverablesJson: ["分工表", "预习问题清单"],
    promptPackJson: [],
    sortOrder: 1,
  },
  {
    key: "experience_problem",
    dayIndex: 2,
    title: "项目体验与问题识别",
    description: "围绕案例开展项目体验、竞品分析和问题识别。",
    activitiesJson: ["项目体验", "竞品分析"],
    deliverablesJson: ["体验记录", "竞品分析表", "问题清单"],
    promptPackJson: [],
    sortOrder: 2,
  },
  {
    key: "solution_design",
    dayIndex: 3,
    title: "优化设计与方案研磨",
    description: "通过头脑风暴、方案设计和 AI 工具辅助形成优化方案初稿。",
    activitiesJson: ["头脑风暴", "方案设计", "AI 工具辅助"],
    deliverablesJson: ["讨论纪要", "优化方案初稿", "AI 工具使用记录"],
    promptPackJson: [],
    sortOrder: 3,
  },
  {
    key: "presentation_material",
    dayIndex: 4,
    title: "汇报材料形成",
    description: "完成汇报 PPT、作品生成、试讲和导师意见记录。",
    activitiesJson: ["PPT", "作品生成", "试讲", "导师点评"],
    deliverablesJson: ["汇报 PPT", "修改版", "导师意见记录"],
    promptPackJson: [],
    sortOrder: 4,
  },
  {
    key: "review_sharing",
    dayIndex: 5,
    title: "复盘分享",
    description: "提交最终成果，完成学习复盘和满意度调查。",
    activitiesJson: ["最终成果", "学习复盘"],
    deliverablesJson: ["最终 PPT", "复盘纪要", "满意度调查"],
    promptPackJson: [],
    sortOrder: 5,
  },
];

export const training2026Invites: TrainingInviteSeed[] = [
  { code: "C1G1-STUDENT", role: "student", classNo: 1, groupNo: 1, maxUses: 15, note: "一班一组学员" },
  { code: "C1G2-STUDENT", role: "student", classNo: 1, groupNo: 2, maxUses: 15, note: "一班二组学员" },
  { code: "C2G1-STUDENT", role: "student", classNo: 2, groupNo: 1, maxUses: 15, note: "二班一组学员" },
  { code: "C2G2-STUDENT", role: "student", classNo: 2, groupNo: 2, maxUses: 15, note: "二班二组学员" },
  { code: "C3G1-STUDENT", role: "student", classNo: 3, groupNo: 1, maxUses: 15, note: "三班一组学员" },
  { code: "C3G2-STUDENT", role: "student", classNo: 3, groupNo: 2, maxUses: 15, note: "三班二组学员" },
  { code: "C1-MENTOR", role: "mentor", classNo: 1, groupNo: null, maxUses: 4, note: "一班导师" },
  { code: "C2-MENTOR", role: "mentor", classNo: 2, groupNo: null, maxUses: 4, note: "二班导师" },
  { code: "C3-MENTOR", role: "mentor", classNo: 3, groupNo: null, maxUses: 4, note: "三班导师" },
  { code: "ADMIN-2026", role: "admin", classNo: null, groupNo: null, maxUses: 3, note: "活动管理员身份绑定" },
];
