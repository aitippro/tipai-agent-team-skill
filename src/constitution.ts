/**
 * 宪章强制检测器 — check_constitution
 *
 * 每次主Agent/组长做决策前自动触发，返回 pass 或 violation。
 * 违反第〇条(跳出容器) → 返回 {pass: false, halt: true}
 */

export type AgentRole = "lead" | "team_lead" | "member";

export interface AgentAction {
  role: AgentRole;
  action: string;
  target?: string;
  context?: Record<string, unknown>;
}

export interface RuleResult {
  article: number;
  name: string;
  pass: boolean;
  reason: string;
  halt: boolean; // true = 立即暂停所有工作
}

export interface CheckResult {
  pass: boolean;
  results: RuleResult[];
  summary: string;
}

const ARTICLES: { article: number; name: string; check: (a: AgentAction) => Omit<RuleResult, "article" | "name"> }[] = [
  {
    article: 0,
    name: "Skill即容器",
    check: (a: AgentAction): Omit<RuleResult, "article" | "name"> => {
      // 禁止跳过采访直接写代码
      if (a.action === "skip_interview" || a.action === "direct_code_without_card") {
        return { pass: false, reason: "违反第〇条: 跳过需求采访/人物卡直接执行任务", halt: true };
      }
      // 禁止跳过人物卡
      if (a.action === "skip_persona_card" || a.action === "bypass_team_structure") {
        return { pass: false, reason: "违反第〇条: 绕过人物卡/跳过层级组队", halt: true };
      }
      return { pass: true, reason: "通过", halt: false };
    },
  },
  {
    article: 1,
    name: "不可越级",
    check: (a: AgentAction): Omit<RuleResult, "article" | "name"> => {
      if (a.action === "member_to_lead_direct") {
        return { pass: false, reason: "违反第一条: 成员直接联系主Agent", halt: true };
      }
      if (a.action === "member_cross_group") {
        return { pass: false, reason: "违反第一条: 成员跨组通信", halt: true };
      }
      if (a.action === "lead_to_member_direct") {
        return { pass: false, reason: "违反第一条: 主Agent直接给成员派活", halt: true };
      }
      return { pass: true, reason: "通过", halt: false };
    },
  },
  {
    article: 2,
    name: "交付做实",
    check: (a: AgentAction): Omit<RuleResult, "article" | "name"> => {
      if (a.action === "fake_implementation" || a.action === "empty_implementation") {
        return { pass: false, reason: "违反第二条: 检测到假实现/空实现", halt: false };
      }
      if (a.action === "team_lead_negligence") {
        return { pass: false, reason: "违反第二条: 组长失职未检出异常代码", halt: false };
      }
      return { pass: true, reason: "通过", halt: false };
    },
  },
  {
    article: 3,
    name: "冲突不沉默",
    check: (a: AgentAction): Omit<RuleResult, "article" | "name"> => {
      if (a.action === "suppress_conflict") {
        return { pass: false, reason: "违反第三条: 发现冲突未上报", halt: false };
      }
      if (a.action === "negotiation_timeout_not_escalated") {
        return { pass: false, reason: "违反第三条: 协商超时未升级主Agent", halt: false };
      }
      return { pass: true, reason: "通过", halt: false };
    },
  },
  {
    article: 4,
    name: "上下文最小化",
    check: (a: AgentAction): Omit<RuleResult, "article" | "name"> => {
      if (a.action === "leak_original_requirement") {
        return { pass: false, reason: "违反第四条: 向成员转发客户原始需求", halt: false };
      }
      if (a.action === "leak_member_evaluation") {
        return { pass: false, reason: "违反第四条: 组长间通信泄露组内成员评价", halt: false };
      }
      return { pass: true, reason: "通过", halt: false };
    },
  },
  {
    article: 5,
    name: "偏好遵从",
    check: (a: AgentAction): Omit<RuleResult, "article" | "name"> => {
      if (a.action === "preset_satisfaction_score") {
        return { pass: false, reason: "违反第五条: 主Agent替客户预设满意度分数", halt: false };
      }
      return { pass: true, reason: "通过", halt: false };
    },
  },
  {
    article: 6,
    name: "可追溯",
    check: (a: AgentAction): Omit<RuleResult, "article" | "name"> => {
      if (a.action === "unrecorded_decision") {
        return { pass: false, reason: "违反第六条: 决策未写入结构化档案", halt: false };
      }
      if (a.action === "modify_archive") {
        return { pass: false, reason: "违反第六条: 试图修改已归档档案", halt: false };
      }
      return { pass: true, reason: "通过", halt: false };
    },
  },
  {
    article: 7,
    name: "客户最终裁定",
    check: (a: AgentAction): Omit<RuleResult, "article" | "name"> => {
      if (a.action === "override_without_record") {
        return { pass: false, reason: "违反第七条: 破例未记录", halt: false };
      }
      return { pass: true, reason: "通过", halt: false };
    },
  },
];

export function check_constitution(action: AgentAction): CheckResult {
  const results: RuleResult[] = ARTICLES.map((a) => {
    const r = a.check(action);
    return { article: a.article, name: a.name, ...r };
  });

  const violations = results.filter((r) => !r.pass);

  const summary = violations.length === 0
    ? "全部8条宪章通过"
    : `${violations.length}条违规: ${violations.map((r) => `[第${r.article}条] ${r.reason}`).join("; ")}`;

  return { pass: violations.length === 0, results, summary };
}

export function is_halt_required(result: CheckResult): boolean {
  return result.results.some((r) => !r.pass && r.halt);
}
