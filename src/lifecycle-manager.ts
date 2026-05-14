/**
 * 生命周期管理系统
 *
 * T-0055: 生命周期状态机
 * T-0056: 生命周期变更处理器
 * T-0057: 满意度触发生命周期变更
 */

import { PersonaCard, SatisfactionRecord, StructuredArchive, WorkRecord, SkillEvolution } from "./schemas";

// ============ T-0055: 生命周期状态机 ============

export type LifecycleState = "ACTIVE" | "FROZEN" | "DESTROYED" | "ADJUSTING";

export interface LifecycleContext {
  card: PersonaCard;
  state: LifecycleState;
  /** 状态变更历史 */
  transitions: LifecycleTransition[];
  /** 冻结时的人物卡快照 */
  frozen_card?: PersonaCard;
  /** 项目销毁时保留的工作记录 */
  retained_records?: WorkRecord[];
  /** 调整次数 */
  adjust_count: number;
}

export interface LifecycleTransition {
  from: LifecycleState;
  to: LifecycleState;
  reason: string;
  triggered_by: string; // 主Agent | 客户 | 满意度系统
  at: string;
}

/**
 * 生命周期状态机
 *
 * ACTIVE → FROZEN (永久保留)
 * ACTIVE → DESTROYED (项目销毁)
 * ACTIVE → ADJUSTING (随项目调整)
 * ADJUSTING → ACTIVE (调整完成)
 * FROZEN → ACTIVE (重新激活)
 */
export const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  ACTIVE: ["FROZEN", "DESTROYED", "ADJUSTING"],
  FROZEN: ["ACTIVE", "DESTROYED"],
  DESTROYED: [], // 不可逆
  ADJUSTING: ["ACTIVE"],
};

/**
 * 初始化生命周期上下文
 */
export function init_lifecycle(card: PersonaCard): LifecycleContext {
  return {
    card: { ...card },
    state: "ACTIVE",
    transitions: [],
    adjust_count: 0,
  };
}

/**
 * 尝试状态转换
 */
export function transition_lifecycle(
  ctx: LifecycleContext,
  target: LifecycleState,
  reason: string,
  triggered_by: string
): { success: boolean; ctx: LifecycleContext; error?: string } {
  const valid_targets = VALID_TRANSITIONS[ctx.state];

  if (!valid_targets.includes(target)) {
    return {
      success: false,
      ctx,
      error: `非法状态转换: ${ctx.state} → ${target}，允许: ${valid_targets.join(", ")}`,
    };
  }

  const transition: LifecycleTransition = {
    from: ctx.state,
    to: target,
    reason,
    triggered_by,
    at: new Date().toISOString(),
  };

  const updated: LifecycleContext = {
    ...ctx,
    state: target,
    transitions: [...ctx.transitions, transition],
  };

  // 冻结时保存快照
  if (target === "FROZEN") {
    updated.frozen_card = { ...ctx.card };
  }

  // 销毁时清空角色上下文
  if (target === "DESTROYED") {
    updated.card = {
      ...ctx.card,
      must_do: [],
      must_not_do: ["已销毁"],
      behavior_rules: ["[已销毁] 此角色已销毁，不可被调度"],
      lifecycle: "project_destroy",
    };
  }

  // 调整时标记
  if (target === "ADJUSTING") {
    updated.adjust_count = ctx.adjust_count + 1;
    updated.card = {
      ...ctx.card,
      lifecycle: "follow_project",
      behavior_rules: [...ctx.card.behavior_rules, `[调整中 #${updated.adjust_count}] 等待重新采访补充`],
    };
  }

  return { success: true, ctx: updated };
}

/**
 * 获取所有合法目标状态
 */
export function get_valid_transitions(state: LifecycleState): LifecycleState[] {
  return VALID_TRANSITIONS[state] || [];
}

// ============ T-0056: 生命周期变更处理器 ============

export interface FreezeResult {
  frozen_card: PersonaCard;
  archive: StructuredArchive;
}

/**
 * 永久保留: 冻结人物卡 + 归档技能演进 → 入库
 */
export function process_freeze(
  ctx: LifecycleContext,
  archive: StructuredArchive,
  skill_evolution: SkillEvolution
): { ctx: LifecycleContext; result: FreezeResult } {
  const result = transition_lifecycle(ctx, "FROZEN", "客户要求永久保留", "客户");
  if (!result.success) {
    throw new Error(`无法冻结: ${result.error}`);
  }

  const enriched_archive: StructuredArchive = {
    ...archive,
    skill_evolution,
    annotations: [
      ...archive.annotations,
      { date: new Date().toISOString(), author: "生命周期系统", content: "角色永久保留，已冻结" },
    ],
  };

  return {
    ctx: result.ctx,
    result: {
      frozen_card: result.ctx.frozen_card!,
      archive: enriched_archive,
    },
  };
}

export interface DestroyResult {
  retained_records: WorkRecord[];
  archive_annotation: string;
}

/**
 * 项目销毁: 清角色上下文 → 工作记录留项目档案
 */
export function process_destroy(
  ctx: LifecycleContext,
  work_records: WorkRecord[]
): { ctx: LifecycleContext; result: DestroyResult } {
  const result = transition_lifecycle(ctx, "DESTROYED", "项目结束销毁", "客户");
  if (!result.success) {
    throw new Error(`无法销毁: ${result.error}`);
  }

  return {
    ctx: result.ctx,
    result: {
      retained_records: work_records,
      archive_annotation: `角色 ${ctx.card.name}(${ctx.card.role}) 于 ${new Date().toISOString()} 销毁，工作记录已保留`,
    },
  };
}

export interface AdjustResult {
  released_constraints: string[];
  needs_reinterview: string[];
}

/**
 * 随项目调整: 释放约束词 → 重新采访补充
 */
export function process_adjust(
  ctx: LifecycleContext,
  new_requirements?: string
): { ctx: LifecycleContext; result: AdjustResult } {
  const released_constraints = ctx.card.must_not_do.filter((r) =>
    !r.includes("越界") && !r.includes("主Agent") && !r.includes("已销毁")
  );

  const needs_reinterview = new_requirements
    ? ["技术栈确认", "新需求模块拆分", "接口变更评估"]
    : ["约束词更新", "角色范围确认"];

  const result = transition_lifecycle(
    ctx, "ADJUSTING",
    new_requirements ? `需求变更: ${new_requirements}` : "项目调整",
    "客户"
  );
  if (!result.success) {
    throw new Error(`无法调整: ${result.error}`);
  }

  return {
    ctx: result.ctx,
    result: {
      released_constraints: released_constraints.slice(0, 5),
      needs_reinterview,
    },
  };
}

/**
 * 从 ADJUSTING 回到 ACTIVE (调整完成)
 */
export function finish_adjust(
  ctx: LifecycleContext,
  updated_card: PersonaCard
): LifecycleContext {
  if (ctx.state !== "ADJUSTING") {
    throw new Error(`当前状态 ${ctx.state} 不处于调整中`);
  }

  const result = transition_lifecycle(ctx, "ACTIVE", "调整完成，回到活跃状态", "主Agent");
  if (!result.success) {
    throw new Error(`无法完成调整: ${result.error}`);
  }

  return {
    ...result.ctx,
    card: { ...updated_card },
  };
}

// ============ T-0057: 满意度触发生命周期变更 ============

export interface LowScoreEvidence {
  records: SatisfactionRecord[];
  reasons: string[];
  consecutive_count: number;
}

/**
 * 检查是否满足连续3次 ≤2 分
 */
export function check_satisfaction_trigger(
  records: SatisfactionRecord[]
): { triggered: boolean; evidence: LowScoreEvidence | null } {
  // 找最近连续 ≤2 分的记录，保留最长连续段的完整证据
  const low_records: SatisfactionRecord[] = [];
  let best_run: SatisfactionRecord[] = [];
  let max_consecutive = 0;
  let current_consecutive = 0;

  // 按 stage_id 排序（假设 stage_id 可比较）
  const sorted = [...records].sort((a, b) => a.stage_id.localeCompare(b.stage_id));

  for (const record of sorted) {
    if (record.final_scores.composite <= 2) {
      current_consecutive++;
      low_records.push(record);
      if (current_consecutive > max_consecutive) {
        max_consecutive = current_consecutive;
        best_run = [...low_records];
      }
    } else {
      current_consecutive = 0;
      low_records.length = 0;
    }
  }

  if (max_consecutive < 3) {
    return { triggered: false, evidence: null };
  }

  // 使用最长连续段的记录（而非可能被截断的最后一段）
  const evidence_records = best_run.slice(-3);
  const reasons = evidence_records.map((r) =>
    `阶段 ${r.stage_id}: 综合分 ${r.final_scores.composite}, ` +
    `质量=${r.final_scores.quality}, 标质=${r.final_scores.standard}, ` +
    `协作=${r.final_scores.collaboration}`
  );

  return {
    triggered: true,
    evidence: {
      records: evidence_records,
      reasons,
      consecutive_count: max_consecutive,
    },
  };
}

/**
 * 主Agent主动建议销毁/重构 (附带证据)
 */
export function suggest_destroy_from_low_score(
  card: PersonaCard,
  evidence: LowScoreEvidence
): {
  suggestion: string;
  option_destroy: string;
  option_refactor: string;
  evidence_summary: string;
} {
  return {
    suggestion: `角色 ${card.name}(${card.role}) 连续 ${evidence.consecutive_count} 次评分≤2，建议处理`,
    option_destroy: `选项1: 销毁角色 "${card.name}"，从库存中移除`,
    option_refactor: `选项2: 重构角色 "${card.name}"，重新设定约束和技能范围`,
    evidence_summary: evidence.reasons.join("; "),
  };
}

/**
 * 客户确认后执行销毁/重构
 */
export function execute_satisfaction_destroy(
  ctx: LifecycleContext,
  evidence: LowScoreEvidence,
  confirmed_by: string
): { ctx: LifecycleContext; archive_note: string } {
  if (ctx.state === "DESTROYED") {
    throw new Error("角色已销毁，不可重复执行");
  }

  const result = transition_lifecycle(
    ctx, "DESTROYED",
    `满意度触发销毁: 连续${evidence.consecutive_count}次低分`,
    confirmed_by
  );

  if (!result.success) {
    throw new Error(`满意度销毁失败: ${result.error}`);
  }

  return {
    ctx: result.ctx,
    archive_note: `[满意度销毁] ${ctx.card.name}(${ctx.card.role}): ${evidence.reasons.join(" | ")}`,
  };
}

/**
 * 重构角色而不是销毁
 */
export function execute_satisfaction_refactor(
  ctx: LifecycleContext,
  evidence: LowScoreEvidence,
  new_card: PersonaCard
): { ctx: LifecycleContext; old_card: PersonaCard } {
  const old_card = { ...ctx.card };

  const destroy_result = transition_lifecycle(
    ctx, "DESTROYED",
    `满意度触发重构: 连续${evidence.consecutive_count}次低分，已生成新卡`,
    "主Agent"
  );

  if (!destroy_result.success) {
    throw new Error(`重构失败: ${destroy_result.error}`);
  }

  return {
    ctx: { ...destroy_result.ctx, card: new_card },
    old_card,
  };
}
