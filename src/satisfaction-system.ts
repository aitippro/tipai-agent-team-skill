/**
 * 满意度系统
 *
 * T-0051: 主Agent打分引擎
 * T-0052: 客户修改分数交互
 * T-0053: 偏好信号提取
 * T-0054: 分数影响引擎
 */

import { SatisfactionRecord, SatisfactionScore, ClientModification } from "./schemas";
import { PersonaCard } from "./schemas";

// ============ T-0051: 主Agent打分引擎 ============

export interface ScoringInput {
  member_name: string;
  role: string;
  /** 任务完成度 - 是否按规格全部实现 */
  implementation_completeness: number; // 1-5
  /** 代码质量 - 是否通过审查无问题 */
  code_quality: number; // 1-5
  /** 协作表现 - 沟通/按时交付/对接顺畅 */
  collaboration: number; // 1-5
  /** 加分项 - 超预期/优化/创新 */
  bonus_items: string[];
  /** 扣分项 */
  penalty_items: string[];
}

export interface ScoringOutput {
  scores: SatisfactionScore;
  reasons: string[];
  member_name: string;
}

/**
 * 4维度打分: 做实(40%) + 质量(30%) + 协作(20%) + 加分(10%)
 */
export function score_member(input: ScoringInput): ScoringOutput {
  const quality = clamp_score(input.implementation_completeness);
  const standard = clamp_score(input.code_quality);
  const collaboration = clamp_score(input.collaboration);

  // 加分项: 每项 0-1 分，最多 5 分
  const bonus = Math.min(input.bonus_items.length, 5);

  // 扣分项不单独减分，而是在原因中体现
  const reasons: string[] = [];

  if (input.implementation_completeness >= 4) {
    reasons.push("任务实现完整");
  } else if (input.implementation_completeness >= 2) {
    reasons.push("部分任务未完成");
  } else {
    reasons.push("大量任务未完成或虚假实现");
  }

  if (input.code_quality >= 4) {
    reasons.push("代码质量良好，审查通过");
  } else if (input.code_quality >= 2) {
    reasons.push("代码存在需要修改的问题");
  } else {
    reasons.push("代码质量差，存在严重问题");
  }

  if (input.collaboration >= 4) {
    reasons.push("协作顺畅，按时交付");
  } else if (input.collaboration >= 2) {
    reasons.push("协作有延迟或沟通问题");
  } else {
    reasons.push("协作表现差，严重影响进度");
  }

  if (input.bonus_items.length > 0) {
    reasons.push(`加分项: ${input.bonus_items.join(", ")}`);
  }

  if (input.penalty_items.length > 0) {
    reasons.push(`问题项: ${input.penalty_items.join(", ")}`);
  }

  const composite = round2(quality * 0.4 + standard * 0.3 + collaboration * 0.2 + bonus * 0.1 * 2);

  const scores: SatisfactionScore = {
    quality,
    standard,
    collaboration,
    bonus,
    composite,
  };

  return { scores, reasons, member_name: input.member_name };
}

/**
 * 批量成员打分
 */
export function score_all_members(
  inputs: ScoringInput[]
): { member_details: ScoringOutput[]; lead_scores: SatisfactionScore } {
  const member_details = inputs.map(score_member);

  // 组长分 = 成员分平均值
  const avg_q = avg(member_details.map((m) => m.scores.quality));
  const avg_s = avg(member_details.map((m) => m.scores.standard));
  const avg_c = avg(member_details.map((m) => m.scores.collaboration));
  const avg_b = avg(member_details.map((m) => m.scores.bonus));

  const lead_scores: SatisfactionScore = {
    quality: round2(avg_q),
    standard: round2(avg_s),
    collaboration: round2(avg_c),
    bonus: round2(avg_b),
    composite: round2(avg_q * 0.4 + avg_s * 0.3 + avg_c * 0.2 + avg_b * 0.1 * 2),
  };

  return { member_details, lead_scores };
}

/**
 * 创建满意度记录 (含组长分+成员明细)
 */
export function create_satisfaction_record(
  stage_id: string,
  group_name: string,
  member_inputs: ScoringInput[]
): SatisfactionRecord {
  const { member_details, lead_scores } = score_all_members(member_inputs);

  return {
    stage_id,
    group_name,
    lead_score: lead_scores,
    member_details: member_details.map((m) => ({
      name: m.member_name,
      scores: m.scores,
    })),
    client_modifications: [],
    final_scores: lead_scores,
  };
}

// ============ T-0052: 客户修改分数交互 ============

export type ClientAction = "confirm" | "modify";

export interface ClientScoreAction {
  action: ClientAction;
  modifications?: ClientModification[];
  /** client confirmation timestamp */
  confirmed_at?: string;
}

/**
 * 客户确认分数 → 原样入库
 */
export function client_confirm(
  record: SatisfactionRecord
): SatisfactionRecord {
  return {
    ...record,
    final_scores: { ...record.lead_score },
    client_modifications: [],
  };
}

/**
 * 客户修改分数 → 追问原因 → 记录修改
 */
export function client_modify_score(
  record: SatisfactionRecord,
  dimension: "quality" | "standard" | "collaboration" | "bonus",
  new_score: number,
  reason: string
): SatisfactionRecord {
  const clamped = clamp_score(new_score);

  const modification: ClientModification = {
    original_score: record.lead_score[dimension],
    modified_score: clamped,
    client_reason: reason,
    dimension,
  };

  return {
    ...record,
    client_modifications: [...record.client_modifications, modification],
    final_scores: {
      ...record.final_scores,
      [dimension]: clamped,
      composite: recalculate_composite({
        ...record.final_scores,
        [dimension]: clamped,
      }),
    },
  };
}

/**
 * 客户多次修改同一维度 → 需要追问额外理由
 */
export function should_ask_followup(
  record: SatisfactionRecord,
  dimension: string
): boolean {
  const same_mods = record.client_modifications.filter(
    (m) => m.dimension === dimension
  );
  return same_mods.length >= 2;
}

/**
 * 处理客户分数操作
 */
export function process_client_action(
  record: SatisfactionRecord,
  action: ClientScoreAction
): SatisfactionRecord {
  if (action.action === "confirm" || !action.modifications) {
    return client_confirm(record);
  }

  let updated = { ...record };

  for (const mod of action.modifications) {
    const followup = should_ask_followup(updated, mod.dimension);
    if (followup && !mod.client_reason) {
      // 需要追问，不应用此修改
      continue;
    }
    updated = client_modify_score(
      updated,
      mod.dimension as "quality" | "standard" | "collaboration" | "bonus",
      mod.modified_score,
      mod.client_reason
    );
  }

  return updated;
}

// ============ T-0053: 偏好信号提取 ============

export interface PreferenceSignal {
  dimension: string;
  direction: "higher" | "lower";
  strength: number; // 累加强度
  labels: string[];
}

export interface PreferenceProfile {
  signals: PreferenceSignal[];
  adjusted_weights: Partial<Record<"quality" | "standard" | "collaboration" | "bonus", number>>;
  last_updated: string;
}

const PREFERENCE_KEYWORDS: Record<string, { direction: "higher" | "lower"; label: string }> = {
  // 偏高质量
  "功能完整": { direction: "higher", label: "重视功能完整性" },
  "功能缺失": { direction: "lower", label: "关注功能缺口" },
  "实现程度": { direction: "higher", label: "要求高度实现" },
  // 偏高标质量
  "代码质量": { direction: "higher", label: "重视代码质量" },
  "bug": { direction: "lower", label: "关注bug数量" },
  "性能": { direction: "higher", label: "重视性能" },
  "安全": { direction: "higher", label: "重视安全性" },
  // 协作
  "沟通": { direction: "higher", label: "重视沟通协作" },
  "延期": { direction: "lower", label: "关注交付时效" },
  "交付": { direction: "higher", label: "重视按时交付" },
  // 创新
  "创新": { direction: "higher", label: "期待创新" },
  "体验": { direction: "higher", label: "重视用户体验" },
};

/**
 * 从客户修改历史和原因中提取偏好信号
 */
export function extract_preference_signals(
  modifications: ClientModification[]
): PreferenceProfile {
  const signals = new Map<string, PreferenceSignal>();

  for (const mod of modifications) {
    const dimension = mod.dimension;
    const direction: "higher" | "lower" =
      mod.modified_score > mod.original_score ? "higher" : "lower";

    if (!signals.has(dimension)) {
      signals.set(dimension, {
        dimension,
        direction,
        strength: 0,
        labels: [],
      });
    }

    const signal = signals.get(dimension)!;
    signal.strength += 1;

    // 关键词匹配
    for (const [keyword, info] of Object.entries(PREFERENCE_KEYWORDS)) {
      if (mod.client_reason.includes(keyword)) {
        if (!signal.labels.includes(info.label)) {
          signal.labels.push(info.label);
        }
      }
    }
  }

  // 调整权重: 连续修改同一维度 → 权重偏移
  const adjusted_weights: Partial<Record<"quality" | "standard" | "collaboration" | "bonus", number>> = {};

  const dimension_totals = new Map<string, number>();
  for (const mod of modifications) {
    dimension_totals.set(mod.dimension, (dimension_totals.get(mod.dimension) || 0) + 1);
  }

  const defaults: Record<string, number> = {
    quality: 0.4, standard: 0.3, collaboration: 0.2, bonus: 0.1,
  };

  for (const [dim, count] of dimension_totals) {
    if (count >= 3) {
      // 连续修改 ≥3 次 → 该维度权重 ±0.05
      const mods = modifications.filter((m) => m.dimension === dim);
      const direction = mods[mods.length - 1].modified_score > mods[mods.length - 1].original_score
        ? "higher" : "lower";
      const delta = direction === "higher" ? 0.05 : -0.05;
      adjusted_weights[dim as keyof typeof adjusted_weights] =
        (defaults[dim] || 0) + delta;
    }
  }

  return {
    signals: Array.from(signals.values()),
    adjusted_weights,
    last_updated: new Date().toISOString(),
  };
}

/**
 * 检查偏好是否与需求冲突
 */
export function detect_preference_conflict(
  preference: PreferenceProfile,
  requirements: string
): { has_conflict: boolean; conflict_description: string } {
  const conflicts: string[] = [];

  for (const signal of preference.signals) {
    for (const label of signal.labels) {
      // 如果偏好"重视性能" 但需求中没有体现
      if (label === "重视性能" && !requirements.includes("性能")) {
        conflicts.push("客户偏好性能但需求未提及");
      }
      if (label === "重视安全性" && !requirements.includes("安全")) {
        conflicts.push("客户偏好安全但需求未提及");
      }
    }
  }

  return {
    has_conflict: conflicts.length > 0,
    conflict_description: conflicts.join("; ") || "无冲突",
  };
}

/**
 * 生成折中方案 (当偏好与需求冲突时)
 */
export function generate_compromise_options(
  preference: PreferenceProfile,
  requirements: string
): string[] {
  const options: string[] = [];
  const conflict = detect_preference_conflict(preference, requirements);

  if (!conflict.has_conflict) return options;

  options.push("方案A: 以原始需求为准，忽略偏好信号");
  options.push("方案B: 以客户偏好为准，调整需求范围");
  options.push("方案C: 需求+偏好各取一半，额外迭代一轮");

  return options;
}

// ============ T-0054: 分数影响引擎 ============

export type ScoreImpactAction =
  | "priority_reuse"
  | "relax_constraints"
  | "maintain"
  | "tighten_constraints"
  | "enhanced_review"
  | "destroy_suggestion";

export interface ScoreImpact {
  score_range: string;
  actions: ScoreImpactAction[];
  description: string;
  affected_cards: string[];
}

/**
 * 根据综合分决定对人物卡的影响
 *
 * ≥4 分 → 优先复用 + 约束词放宽
 * 3-3.9 → 维持不变
 * 2-2.9 → 约束词收紧 + 组长加强审核
 * <2   → 建议销毁
 */
export function evaluate_score_impact(
  composite: number,
  card: PersonaCard
): ScoreImpact {
  const affected_cards = [card.name];

  if (composite >= 4) {
    return {
      score_range: "≥4",
      actions: ["priority_reuse", "relax_constraints"],
      description: `角色 ${card.name}(${card.role}) 综合分 ${composite}，表现优秀：优先在该场景复用，可适当放宽约束词`,
      affected_cards,
    };
  }

  if (composite >= 3) {
    return {
      score_range: "3-3.9",
      actions: ["maintain"],
      description: `角色 ${card.name}(${card.role}) 综合分 ${composite}，正常表现：维持当前约束和审核力度`,
      affected_cards,
    };
  }

  if (composite >= 2) {
    return {
      score_range: "2-2.9",
      actions: ["tighten_constraints", "enhanced_review"],
      description: `角色 ${card.name}(${card.role}) 综合分 ${composite}，需要改进：收紧约束词，组长加强审核`,
      affected_cards,
    };
  }

  return {
    score_range: "<2",
    actions: ["destroy_suggestion"],
    description: `角色 ${card.name}(${card.role}) 综合分 ${composite}，表现差：建议销毁该角色卡`,
    affected_cards,
  };
}

/**
 * 批量评估分数影响 (组内)
 */
export function evaluate_group_score_impact(
  member_details: { name: string; scores: SatisfactionScore }[],
  cards: PersonaCard[]
): ScoreImpact[] {
  const card_map = new Map(cards.map((c) => [c.name, c]));
  return member_details
    .filter((m) => card_map.has(m.name))
    .map((m) => evaluate_score_impact(m.scores.composite, card_map.get(m.name)!));
}

/**
 * 应用分数影响 → 更新人物卡约束
 */
export function apply_score_impact(
  impact: ScoreImpact,
  card: PersonaCard
): PersonaCard {
  let updated = { ...card };

  if (impact.actions.includes("relax_constraints")) {
    // 放宽约束: 从 must_not_do 中移除最多2条泛化约束
    const relaxable = updated.must_not_do.filter((r) =>
      !r.includes("越界") && !r.includes("主Agent")
    );
    if (relaxable.length > 0) {
      updated = {
        ...updated,
        must_not_do: updated.must_not_do.filter((r) => !relaxable.slice(0, 2).includes(r)),
      };
    }
  }

  if (impact.actions.includes("tighten_constraints")) {
    // 收紧约束: 追加额外约束词
    updated = {
      ...updated,
      must_not_do: [
        ...updated.must_not_do,
        "未经组长二次确认不可提交代码",
        "所有输出需附带自测结果",
      ],
    };
  }

  if (impact.actions.includes("destroy_suggestion")) {
    // 建议销毁: 标记 lifecycle
    updated = {
      ...updated,
      lifecycle: "project_destroy",
      behavior_rules: [
        ...updated.behavior_rules,
        "[低分销毁建议] 综合分过低，等待客户确认销毁",
      ],
    };
  }

  return updated;
}

// ============ 工具函数 ============

function clamp_score(v: number): number {
  return Math.max(1, Math.min(5, Math.round(v)));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function recalculate_composite(scores: SatisfactionScore): number {
  return round2(
    scores.quality * 0.4 +
    scores.standard * 0.3 +
    scores.collaboration * 0.2 +
    scores.bonus * 0.1 * 2
  );
}
