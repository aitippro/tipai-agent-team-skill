/**
 * 需求采访引擎
 *
 * T-0013: 采访状态机
 * T-0014: 项目画像模板 + 追问规则
 * T-0015: 技术边界模板 + 默认推荐
 * T-0016: 功能拆解模板 + 复杂度探测
 * T-0017: 采访摘要生成
 * T-0018: 客户确认交互
 */

// ============ T-0013: 采访状态机 ============

export type InterviewPhase =
  | "INIT"
  | "IMAGE"
  | "TECH_BOUNDARY"
  | "FEATURE_BREAKDOWN"
  | "CONFIRM"
  | "DONE";

export interface InterviewState {
  phase: InterviewPhase;
  question_index: number;
  probe_depth: number;
  max_probe_depth: number;
  answers: Record<string, string[]>;
  can_go_back: boolean;
}

export function create_interview_state(): InterviewState {
  return {
    phase: "INIT",
    question_index: 0,
    probe_depth: 0,
    max_probe_depth: 3,
    answers: {},
    can_go_back: false,
  };
}

export const PHASE_ORDER: InterviewPhase[] = [
  "INIT", "IMAGE", "TECH_BOUNDARY", "FEATURE_BREAKDOWN", "CONFIRM", "DONE",
];

export function advance_phase(state: InterviewState): InterviewState {
  const idx = PHASE_ORDER.indexOf(state.phase);
  if (idx < PHASE_ORDER.length - 1) {
    return {
      ...state,
      phase: PHASE_ORDER[idx + 1],
      question_index: 0,
      probe_depth: 0,
      can_go_back: idx > 0,
    };
  }
  return state;
}

export function go_back_phase(state: InterviewState): InterviewState {
  const idx = PHASE_ORDER.indexOf(state.phase);
  if (idx > 1) { // Can't go back past IMAGE
    const prev = PHASE_ORDER[idx - 1];
    return {
      ...state,
      phase: prev,
      question_index: 0,
      probe_depth: 0,
      can_go_back: PHASE_ORDER.indexOf(prev) > 0,
    };
  }
  return state;
}

// ============ T-0014: 项目画像模板 ============

export interface TemplateQuestion {
  id: string;
  question: string;
  probe_directions: string[];
  is_vague: (answer: string) => boolean;
}

export function is_vague_answer(answer: string): boolean {
  if (answer.length < 10) return true;
  const vague_words = ["大概", "可能", "差不多", "也许", "应该", "不确定", "不知道", "随便", "都行", "你定"];
  return vague_words.some((w) => answer.includes(w));
}

export const IMAGE_TEMPLATE: TemplateQuestion[] = [
  {
    id: "image_1",
    question: "你要做什么？一句话描述你的项目。",
    probe_directions: ["能再说具体一点吗？比如主要解决什么问题？", "目标用户是谁？他们在什么场景下使用？"],
    is_vague: is_vague_answer,
  },
  {
    id: "image_2",
    question: "这是新项目还是改造现有系统？",
    probe_directions: ["现有系统用的是什么技术栈？", "改造的主要痛点是什么？"],
    is_vague: (a) => a.length < 3,
  },
  {
    id: "image_3",
    question: "核心用户是谁？预期有多少用户？",
    probe_directions: ["用户规模大概多大？是否有高并发场景？", "用户分布在哪些地区？对延迟敏感吗？"],
    is_vague: is_vague_answer,
  },
  {
    id: "image_4",
    question: "有没有明确的时间节点或硬性截止日期？",
    probe_directions: ["这个时间节点是外部决定的还是内部期望？", "如果时间紧，哪些功能可以推迟？"],
    is_vague: (a) => a.includes("没有") || a.includes("暂时没有"),
  },
];

// ============ T-0015: 技术边界模板 + 默认推荐 ============

export interface TechRecommendation {
  name: string;
  reasons: string[];
  risks: string[];
}

export const TECH_TEMPLATE: TemplateQuestion[] = [
  {
    id: "tech_1",
    question: "技术栈有没有偏好或限制？比如语言、框架、数据库？",
    probe_directions: ["有必须避开的特定技术吗？", "团队对什么技术最熟悉？"],
    is_vague: is_vague_answer,
  },
  {
    id: "tech_2",
    question: "部署环境是什么？云服务/私有化/混合？",
    probe_directions: ["有没有网络隔离或安全合规要求？", "需要支持多租户吗？"],
    is_vague: is_vague_answer,
  },
  {
    id: "tech_3",
    question: "有没有需要对接的现有系统或第三方服务？",
    probe_directions: ["这些系统的API格式和鉴权方式是怎样的？", "对接的稳定性要求高吗？"],
    is_vague: (a) => a.includes("没有") || a.includes("暂时没有"),
  },
];

export function recommend_tech_stack(project_type: string): TechRecommendation {
  const type = project_type.toLowerCase();

  if (type.includes("电商") || type.includes("交易") || type.includes("支付")) {
    return {
      name: "Go + PostgreSQL + React",
      reasons: [
        "Go的并发性能适合高并发交易场景",
        "PostgreSQL的事务支持保障数据一致性",
        "React生态成熟，前端组件丰富",
      ],
      risks: ["Go的泛型支持相对有限", "需要关注数据库连接池配置"],
    };
  }

  if (type.includes("cms") || type.includes("内容") || type.includes("博客")) {
    return {
      name: "Node.js + PostgreSQL + Next.js",
      reasons: [
        "Node.js处理内容型请求轻量高效",
        "Next.js的SSR/SSG适合内容展示",
        "PostgreSQL的全文搜索支持内容检索",
      ],
      risks: ["高并发写入场景需额外优化"],
    };
  }

  if (type.includes("实时") || type.includes("聊天") || type.includes("协作")) {
    return {
      name: "Node.js + Redis + React + WebSocket",
      reasons: [
        "Node.js事件驱动适合长连接",
        "Redis pub/sub天然支持实时消息",
        "WebSocket实现双向通信",
      ],
      risks: ["需要关注水平扩展时的WebSocket状态同步"],
    };
  }

  // 默认推荐
  return {
    name: "TypeScript + PostgreSQL + React",
    reasons: [
      "TypeScript全栈类型安全",
      "PostgreSQL成熟稳定",
      "React前端生态最丰富",
    ],
    risks: ["无明显风险点"],
  };
}

// ============ T-0016: 功能拆解模板 + 复杂度探测 ============

export const FEATURE_TEMPLATE: TemplateQuestion[] = [
  {
    id: "feature_1",
    question: "核心功能有哪些？请按优先级从高到低排列。",
    probe_directions: ["这个功能具体是什么用户场景？", "有没有可以被替代或砍掉的功能？"],
    is_vague: is_vague_answer,
  },
  {
    id: "feature_2",
    question: "哪个功能最复杂或风险最高？",
    probe_directions: ["复杂点在哪？数据一致性？高并发？还是业务规则多？", "以前有没有遇到过类似的问题？"],
    is_vague: is_vague_answer,
  },
  {
    id: "feature_3",
    question: "有没有绝对不能妥协的限制或要求？",
    probe_directions: ["是合规要求还是性能底线？", "如果做不到会有什么后果？"],
    is_vague: (a) => a.includes("没有") || a.includes("暂时没有"),
  },
];

export const COMPLEXITY_KEYWORDS = [
  "支付", "交易", "实时", "同步", "并发", "分布式", "消息队列",
  "事务", "锁", "状态机", "认证", "鉴权", "加密", "流媒体",
  "大数据", "ai", "机器学习", "推荐", "搜索", "缓存",
];

export function detect_complexity(features: string[]): { feature: string; complexity: "high" | "medium" | "low" }[] {
  return features.map((f) => {
    const match_count = COMPLEXITY_KEYWORDS.filter((kw) => f.toLowerCase().includes(kw)).length;
    const complexity = match_count >= 3 ? "high" : match_count >= 1 ? "medium" : "low";
    return { feature: f, complexity };
  });
}

export function get_most_complex(features: { feature: string; complexity: "high" | "medium" | "low" }[]): string | null {
  const high = features.filter((f) => f.complexity === "high");
  if (high.length > 0) return high[0].feature;
  const medium = features.filter((f) => f.complexity === "medium");
  if (medium.length > 0) return medium[0].feature;
  return null;
}

// ============ T-0017: 采访摘要生成 ============

export interface InterviewSummary {
  project_description: string;
  tech_stack: string;
  deployment: string;
  suggested_layers: string[];
  estimated_roles: number;
  risk_items: string[];
}

export function generate_summary(answers: Record<string, string[]>, recommended_tech: TechRecommendation): InterviewSummary {
  const project_desc = answers["image_1"]?.[0] || "未提供";
  const is_new = answers["image_2"]?.[0]?.includes("新") ?? true;
  const users = answers["image_3"]?.[0] || "未提供";
  const deadline = answers["image_4"]?.[0] || "未提供";
  const tech_pref = answers["tech_1"]?.[0];
  const deploy = answers["tech_2"]?.[0] || "未提供";
  const features = answers["feature_1"]?.[0] || "未提供";

  const stack = tech_pref && !is_vague_answer(tech_pref) ? tech_pref : recommended_tech.name;

  // 推断层级
  const layers: string[] = [];
  if (features.includes("页面") || features.includes("界面") || features.includes("前端")) layers.push("前端层");
  layers.push("后端层"); // 始终需要
  layers.push("数据层"); // 始终需要
  if (features.includes("部署") || features.includes("CI/CD") || features.includes("监控")) layers.push("DevOps层");

  const feature_list = features.split(/[,，、\n]/).filter((f) => f.trim().length > 0);
  const complexity_result = detect_complexity(feature_list);
  const _most_complex = get_most_complex(complexity_result);

  // 预估角色数: 每组1组长+至少2成员
  const estimated_roles = 1 + layers.length * 3; // 主Agent + 每组3人

  const risk_items = complexity_result
    .filter((f) => f.complexity === "high")
    .map((f) => `高风险模块: ${f.feature}`);

  if (!deadline || deadline.includes("没有")) {
    risk_items.push("无明确时间节点，可能缺乏紧迫性");
  }

  return {
    project_description: `${is_new ? "新项目" : "改造项目"}: ${project_desc}。目标用户: ${users}。`,
    tech_stack: stack,
    deployment: deploy,
    suggested_layers: layers,
    estimated_roles,
    risk_items: risk_items.length > 0 ? risk_items : ["无明显风险"],
  };
}

export function format_summary(summary: InterviewSummary): string {
  const lines: string[] = [];
  lines.push("# 需求摘要");
  lines.push("");
  lines.push(`**项目**: ${summary.project_description}`);
  lines.push(`**技术栈**: ${summary.tech_stack}`);
  lines.push(`**部署**: ${summary.deployment}`);
  lines.push("");
  lines.push("## 建议层级结构");
  summary.suggested_layers.forEach((l) => lines.push(`- ${l}`));
  lines.push("");
  lines.push(`## 预估`);
  lines.push(`- 角色总数: ${summary.estimated_roles}人（含主Agent + 各组组长）`);
  lines.push("");
  lines.push("## 风险提示");
  summary.risk_items.forEach((r) => lines.push(`- ${r}`));

  const result = lines.join("\n");
  return result.length <= 500 ? result : result.substring(0, 497) + "...";
}

// ============ T-0018: 客户确认交互 ============

export type ConfirmAction = "confirm" | "modify" | "pending";

export interface ConfirmState {
  summary: InterviewSummary;
  status: ConfirmAction;
  modified_fields: string[];
  iteration: number;
}

export function create_confirm_state(summary: InterviewSummary): ConfirmState {
  return {
    summary,
    status: "pending",
    modified_fields: [],
    iteration: 0,
  };
}

export function handle_confirm(state: ConfirmState): ConfirmState {
  return { ...state, status: "confirm" };
}

export function handle_modify(
  state: ConfirmState,
  modifications: Partial<InterviewSummary>
): ConfirmState {
  return {
    summary: { ...state.summary, ...modifications },
    status: "modify",
    modified_fields: [...state.modified_fields, ...Object.keys(modifications)],
    iteration: state.iteration + 1,
  };
}

export function is_interview_done(state: ConfirmState): boolean {
  return state.status === "confirm";
}
