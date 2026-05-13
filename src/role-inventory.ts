/**
 * 角色库存系统
 *
 * T-0058: 库存写入
 * T-0059: 库存索引
 * T-0060: 库存检索匹配
 * T-0061: 库存更新
 * T-0062: 库存降级
 * T-0063: 库存删除
 */

import { PersonaCard, SkillEvolution, RoleInventory, RoleInventoryEntry, RoleInventoryIndex, FrozenPersonaCard } from "./schemas";

// ============ T-0058: 库存写入 ============

export interface InventoryWriteInput {
  card: PersonaCard;
  skill_evolution: SkillEvolution;
  history_scores: { project: string; score: number }[];
  suitable_scenarios: string[];
  unsuitable_scenarios: string[];
}

/**
 * 人物卡冻结版 + 技能演进记录 + 历史评分 + 适合/不适合场景 → 入库
 */
export function write_to_inventory(
  input: InventoryWriteInput,
  existing_inventory: RoleInventory
): RoleInventory {
  const frozen_card: FrozenPersonaCard = {
    original: { ...input.card },
    frozen_at: new Date().toISOString(),
    tech_tags: extract_tech_tags(input.card),
  };

  const avg_score = calculate_avg_score(input.history_scores);

  const entry: RoleInventoryEntry = {
    persona_card: frozen_card,
    skill_evolution: { ...input.skill_evolution },
    history_scores: [...input.history_scores],
    avg_score,
    suitable_scenarios: [...input.suitable_scenarios],
    unsuitable_scenarios: [...input.unsuitable_scenarios],
    status: "active",
  };

  return {
    entries: [...existing_inventory.entries, entry],
    index: rebuild_index([...existing_inventory.entries, entry]),
  };
}

// ============ T-0059: 库存索引 ============

/**
 * 按技术栈/评分/场景重建索引
 */
export function rebuild_index(entries: RoleInventoryEntry[]): RoleInventoryIndex {
  const index_entries = entries.map((e) => ({
    name: e.persona_card.original.name,
    tech_tags: e.persona_card.tech_tags,
    avg_score: e.avg_score,
    scenarios: e.suitable_scenarios,
    status: e.status,
  }));

  return { entries: index_entries };
}

/**
 * 按技术栈检索
 */
export function search_by_tech(
  index: RoleInventoryIndex,
  tech_keyword: string
): RoleInventoryIndex["entries"] {
  const kw = tech_keyword.toLowerCase();
  return index.entries.filter((e) =>
    e.tech_tags.some((t) => t.toLowerCase().includes(kw))
  );
}

/**
 * 按评分范围检索
 */
export function search_by_score(
  index: RoleInventoryIndex,
  min_score: number,
  max_score?: number
): RoleInventoryIndex["entries"] {
  return index.entries.filter((e) =>
    e.avg_score >= min_score && (max_score === undefined || e.avg_score <= max_score)
  );
}

/**
 * 按场景关键词检索
 */
export function search_by_scenario(
  index: RoleInventoryIndex,
  scenario_keyword: string
): RoleInventoryIndex["entries"] {
  const kw = scenario_keyword.toLowerCase();
  return index.entries.filter((e) =>
    e.scenarios.some((s) => s.toLowerCase().includes(kw))
  );
}

// ============ T-0060: 库存检索匹配 ============

export interface SearchQuery {
  tech_stack: string[];
  module_features: string[];
  /** 期望的场景 */
  target_scenarios?: string[];
}

export interface MatchResult {
  entry: RoleInventoryEntry;
  match_score: number;
  reasons: string[];
  rank: number;
}

/**
 * 新项目开始 → 提取技术栈+模块特征 → 加权排序
 * 场景匹配度 > 评分
 * 过滤 <3.0 分和"不适合场景"匹配项
 */
export function search_and_match(
  inventory: RoleInventory,
  query: SearchQuery,
  top_n: number = 5
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const entry of inventory.entries) {
    // 过滤: 休眠卡不参与检索
    if (entry.status === "dormant") continue;

    // 过滤: <3.0 分
    if (entry.avg_score < 3.0) continue;

    // 过滤: 不适合场景匹配
    const unsuitable = query.target_scenarios?.some((s) =>
      entry.unsuitable_scenarios.some((us) => us.toLowerCase().includes(s.toLowerCase()))
    );
    if (unsuitable) continue;

    const { score, reasons } = calculate_match_score(entry, query);
    if (score > 0) {
      results.push({ entry, match_score: score, reasons, rank: 0 });
    }
  }

  // 按匹配分降序
  results.sort((a, b) => b.match_score - a.match_score);

  // 分配排名
  const top = results.slice(0, top_n);
  top.forEach((r, i) => { r.rank = i + 1; });

  return top;
}

function calculate_match_score(
  entry: RoleInventoryEntry,
  query: SearchQuery
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let tech_score = 0;
  let scenario_score = 0;

  // 技术栈匹配 (权重 0.35)
  const tags = entry.persona_card.tech_tags.map((t) => t.toLowerCase());
  for (const tech of query.tech_stack) {
    const tl = tech.toLowerCase();
    const match_count = tags.filter((t) => t.includes(tl) || tl.includes(t)).length;
    if (match_count > 0) {
      tech_score += match_count;
      reasons.push(`技术栈匹配: ${tech}`);
    }
  }
  const tech_ratio = query.tech_stack.length > 0
    ? tech_score / query.tech_stack.length : 0;

  // 场景匹配 (权重 0.50, 更高优先级)
  const module_features = query.module_features.map((f) => f.toLowerCase());
  for (const feat of module_features) {
    for (const scenario of entry.suitable_scenarios) {
      if (scenario.toLowerCase().includes(feat) || feat.includes(scenario.toLowerCase())) {
        scenario_score += 1;
        reasons.push(`场景匹配: ${feat} ↔ ${scenario}`);
      }
    }
  }
  const scenario_ratio = query.module_features.length > 0
    ? scenario_score / query.module_features.length : 0;

  // 评分贡献 (权重 0.15)
  const score_bonus = Math.min(entry.avg_score / 5, 1);

  const score = Math.round(
    (tech_ratio * 0.35 + scenario_ratio * 0.50 + score_bonus * 0.15) * 100
  );

  return { score, reasons };
}

// ============ T-0061: 库存更新 ============

/**
 * 同名卡再次入库 → 覆盖旧版
 * 技能演进追加
 * 评分汇总重算
 */
export function update_inventory(
  input: InventoryWriteInput,
  existing_inventory: RoleInventory
): RoleInventory {
  const name = input.card.name;
  const idx = existing_inventory.entries.findIndex(
    (e) => e.persona_card.original.name === name
  );

  const frozen_card: FrozenPersonaCard = {
    original: { ...input.card },
    frozen_at: new Date().toISOString(),
    tech_tags: extract_tech_tags(input.card),
  };

  // 合并评分
  const existing = idx >= 0 ? existing_inventory.entries[idx] : null;
  const merged_scores = existing
    ? [...existing.history_scores, ...input.history_scores]
    : input.history_scores;
  const avg_score = calculate_avg_score(merged_scores);

  // 技能演进追加
  const merged_evolution: SkillEvolution = existing
    ? {
        start: existing.skill_evolution.start || input.skill_evolution.start,
        mid: existing.skill_evolution.end || input.skill_evolution.mid,
        end: input.skill_evolution.end,
      }
    : input.skill_evolution;

  const updated_entry: RoleInventoryEntry = {
    persona_card: frozen_card,
    skill_evolution: merged_evolution,
    history_scores: merged_scores,
    avg_score,
    suitable_scenarios: input.suitable_scenarios,
    unsuitable_scenarios: input.unsuitable_scenarios,
    status: existing?.status || "active",
  };

  const new_entries = [...existing_inventory.entries];
  if (idx >= 0) {
    new_entries[idx] = updated_entry;
  } else {
    new_entries.push(updated_entry);
  }

  return {
    entries: new_entries,
    index: rebuild_index(new_entries),
  };
}

// ============ T-0062: 库存降级 ============

export interface SelectionTracker {
  name: string;
  consecutive_not_selected: number;
  last_selected_at?: string;
}

/**
 * 记录一次检索结果的使用情况
 */
export function track_selection(
  selected_names: string[],
  all_candidates: string[],
  tracker: SelectionTracker[]
): SelectionTracker[] {
  const tracker_map = new Map(tracker.map((t) => [t.name, t]));

  // 初始化未跟踪的候选人
  for (const name of all_candidates) {
    if (!tracker_map.has(name)) {
      tracker_map.set(name, { name, consecutive_not_selected: 0 });
    }
  }

  // 更新记录
  for (const name of all_candidates) {
    const t = tracker_map.get(name)!;
    if (selected_names.includes(name)) {
      t.consecutive_not_selected = 0;
      t.last_selected_at = new Date().toISOString();
    } else {
      t.consecutive_not_selected += 1;
    }
  }

  return Array.from(tracker_map.values());
}

/**
 * 连续 2 次不被选择 → 标记"休眠"
 */
export function apply_dormant_rule(
  inventory: RoleInventory,
  tracker: SelectionTracker[]
): RoleInventory {
  const dormant_names = new Set(
    tracker
      .filter((t) => t.consecutive_not_selected >= 2)
      .map((t) => t.name)
  );

  const updated_entries = inventory.entries.map((e) => {
    if (dormant_names.has(e.persona_card.original.name) && e.status === "active") {
      return { ...e, status: "dormant" as const };
    }
    return e;
  });

  return {
    entries: updated_entries,
    index: rebuild_index(updated_entries),
  };
}

/**
 * 休眠卡不出现在推荐首位 — 排序时移到末尾
 */
export function sort_with_dormant_last(
  results: MatchResult[]
): MatchResult[] {
  const active = results.filter((r) => r.entry.status === "active");
  const dormant = results.filter((r) => r.entry.status === "dormant");
  return [...active, ...dormant];
}

/**
 * 重新激活休眠卡
 */
export function reactivate_entry(
  inventory: RoleInventory,
  name: string
): RoleInventory {
  const updated_entries = inventory.entries.map((e) => {
    if (e.persona_card.original.name === name && e.status === "dormant") {
      return { ...e, status: "active" as const };
    }
    return e;
  });

  return {
    entries: updated_entries,
    index: rebuild_index(updated_entries),
  };
}

// ============ T-0063: 库存删除 ============

/**
 * 客户主动要求 → 移除
 * 不可恢复: 直接从 entries 中删除 (不保留)
 */
export function delete_from_inventory(
  inventory: RoleInventory,
  name: string
): { inventory: RoleInventory; deleted: RoleInventoryEntry | null } {
  const idx = inventory.entries.findIndex(
    (e) => e.persona_card.original.name === name
  );

  if (idx < 0) {
    return { inventory, deleted: null };
  }

  const deleted = inventory.entries[idx];
  const new_entries = [...inventory.entries];
  new_entries.splice(idx, 1);

  return {
    inventory: {
      entries: new_entries,
      index: rebuild_index(new_entries),
    },
    deleted,
  };
}

/**
 * 删除前二次确认检查
 */
export function confirm_deletion(
  inventory: RoleInventory,
  name: string,
  confirmed: boolean
): { success: boolean; inventory: RoleInventory; message: string } {
  if (!confirmed) {
    return { success: false, inventory, message: "需要二次确认才能删除" };
  }

  const result = delete_from_inventory(inventory, name);
  if (!result.deleted) {
    return { success: false, inventory, message: `未找到角色: ${name}` };
  }

  return {
    success: true,
    inventory: result.inventory,
    message: `角色 ${name} 已从库存中永久删除，不可恢复`,
  };
}

// ============ 工具函数 ============

function extract_tech_tags(card: PersonaCard): string[] {
  const tags: string[] = [];

  if (card.tech_env.language) {
    tags.push(card.tech_env.language);
  }
  if (card.tech_env.framework) {
    tags.push(card.tech_env.framework);
  }
  if (card.tech_env.tools) {
    tags.push(...card.tech_env.tools);
  }
  if (card.tech_env.code_style) {
    tags.push(card.tech_env.code_style);
  }

  // 从角色描述提取关键词
  const role_words = card.role.split(/[\s\-/]+/);
  for (const w of role_words) {
    if (w.length > 1 && !tags.includes(w)) {
      tags.push(w);
    }
  }

  // 从 must_do 提取
  for (const md of card.must_do) {
    for (const w of md.split(/[\s\-/]+/)) {
      if (w.length > 1 && !tags.includes(w) && !["实现", "开发", "编写"].includes(w)) {
        tags.push(w);
      }
    }
  }

  return [...new Set(tags)];
}

function calculate_avg_score(
  scores: { project: string; score: number }[]
): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b.score, 0);
  return Math.round((sum / scores.length) * 100) / 100;
}
