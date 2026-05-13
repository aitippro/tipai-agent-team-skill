/**
 * 冲突检测与仲裁系统
 *
 * T-0039: 接口冲突检测器
 * T-0040: 数据冲突检测器
 * T-0041: 约定冲突检测器
 * T-0042: 逻辑冲突检测器
 * T-0043: 仲裁决策引擎
 * T-0044: 协商超时检测
 * T-0045: 仲裁结果写入
 */

import {
  ConflictRecord,
} from "./schemas";
import { PersonaCard } from "./schemas";

// ============ T-0039: 接口冲突检测器 ============

export interface InterfaceField {
  name: string;
  type: string;
  optional?: boolean;
}

export interface InterfaceDefinition {
  group: string;
  endpoint_or_module: string;
  fields: InterfaceField[];
  description: string;
}

/**
 * 对比两个接口定义，检测字段名/类型/结构不一致
 * 返回冲突记录或 null
 */
export function detect_interface_conflict(
  a: InterfaceDefinition,
  b: InterfaceDefinition
): ConflictRecord | null {
  const issues: string[] = [];
  const a_fields = new Map(a.fields.map((f) => [f.name, f]));
  const b_fields = new Map(b.fields.map((f) => [f.name, f]));

  // 字段名不一致
  for (const [name, field_a] of a_fields) {
    const field_b = b_fields.get(name);
    if (!field_b) {
      issues.push(`字段 ${name} 在 ${b.group} 侧缺失`);
      continue;
    }
    // 类型不一致
    if (!types_compatible(field_a.type, field_b.type)) {
      issues.push(`字段 ${name}: 类型不一致 (${a.group}=${field_a.type}, ${b.group}=${field_b.type})`);
    }
    // optional 状态不一致
    if (field_a.optional !== field_b.optional && field_a.optional !== undefined && field_b.optional !== undefined) {
      issues.push(`字段 ${name}: optional 状态不一致`);
    }
  }

  // B 中有但 A 中没有的字段
  for (const [name] of b_fields) {
    if (!a_fields.has(name)) {
      issues.push(`字段 ${name} 在 ${a.group} 侧缺失`);
    }
  }

  if (issues.length === 0) return null;

  return {
    conflict_id: `C-IFACE-${Date.now()}`,
    type: "interface",
    parties: [a.group, b.group],
    severity: issues.length >= 2 ? "blocking" : "delayed",
    detected_by: `${a.group}组长`,
    detection_time: new Date().toISOString(),
    resolution_path: "negotiation",
    result: issues.join("; "),
  };
}

/**
 * 批量检测多组间接口冲突
 */
export function detect_all_interface_conflicts(
  interfaces: InterfaceDefinition[]
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];

  for (let i = 0; i < interfaces.length; i++) {
    for (let j = i + 1; j < interfaces.length; j++) {
      const conflict = detect_interface_conflict(interfaces[i], interfaces[j]);
      if (conflict) conflicts.push(conflict);
    }
  }

  return conflicts;
}

function types_compatible(a: string, b: string): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, "").replace(/\[\]/g, "[]");

  const na = norm(a);
  const nb = norm(b);

  if (na === nb) return true;

  // 数字类型家族兼容
  const number_family = ["int", "int32", "int64", "number", "float", "double", "decimal", "bigint", "smallint", "integer"];
  if (number_family.some((n) => na.includes(n)) && number_family.some((n) => nb.includes(n))) {
    return true;
  }

  // 字符串类型家族
  const string_family = ["string", "varchar", "text", "char", "nvarchar"];
  if (string_family.some((s) => na.includes(s)) && string_family.some((s) => nb.includes(s))) {
    return true;
  }

  // 布尔
  if ((na === "bool" || na === "boolean") && (nb === "bool" || nb === "boolean")) return true;

  return false;
}

// ============ T-0040: 数据冲突检测器 ============

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable?: boolean;
  primary_key?: boolean;
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
}

export interface DataSchema {
  group: string;
  tables: TableDefinition[];
  version: string;
}

export interface WriteOperation {
  group: string;
  table: string;
  columns: string[];
  types: Record<string, string>;
  operation: "INSERT" | "UPDATE" | "DELETE";
}

/**
 * 以数据组长 schema 为权威源，检测其他组的写操作是否与 schema 一致
 */
export function detect_data_conflict(
  operation: WriteOperation,
  schema: DataSchema
): ConflictRecord | null {
  const issues: string[] = [];
  const table = schema.tables.find((t) => t.name === operation.table);

  if (!table) {
    return {
      conflict_id: `C-DATA-${Date.now()}`,
      type: "data",
      parties: [operation.group, schema.group],
      severity: "blocking",
      detected_by: `${schema.group}组长(数据权威)`,
      detection_time: new Date().toISOString(),
      resolution_path: "lead_arbitration",
      result: `表 ${operation.table} 不存在于数据 Schema 中`,
    };
  }

  // 列名检查
  for (const col of operation.columns) {
    const schema_col = table.columns.find((c) => c.name === col);
    if (!schema_col) {
      issues.push(`列 ${col} 不存在于 ${schema.group} 的 Schema 中`);
      continue;
    }
    // 类型检查
    const op_type = operation.types[col];
    if (op_type && !types_compatible(op_type, schema_col.type)) {
      issues.push(`列 ${col}: 类型不匹配 (操作=${op_type}, Schema=${schema_col.type})`);
    }
  }

  // INSERT 需检查 NOT NULL 列
  if (operation.operation === "INSERT") {
    for (const col of table.columns) {
      if (!col.nullable && !operation.columns.includes(col.name)) {
        issues.push(`INSERT 缺少非空列: ${col.name}`);
      }
    }
  }

  if (issues.length === 0) return null;

  return {
    conflict_id: `C-DATA-${Date.now()}`,
    type: "data",
    parties: [operation.group, schema.group],
    severity: issues.some((i) => i.includes("非空")) ? "blocking" : "delayed",
    detected_by: `${schema.group}组长`,
    detection_time: new Date().toISOString(),
    resolution_path: "lead_arbitration",
    result: issues.join("; "),
  };
}

// ============ T-0041: 约定冲突检测器 ============

export interface ConventionRule {
  id: string;
  category: string;
  rule: string;
  /** 正面模式: 代码应包含的关键词 */
  required_pattern?: string;
  /** 负面模式: 代码不应包含的关键词 */
  forbidden_pattern?: string;
}

export interface ConventionViolation {
  convention_id: string;
  rule: string;
  line: number;
  description: string;
}

/**
 * 组长审查成员代码时逐条比对全局约定表
 * 偏离 ≥3 处 → 上报主Agent
 */
export function detect_convention_violations(
  code: string,
  conventions: ConventionRule[]
): ConventionViolation[] {
  const violations: ConventionViolation[] = [];
  const lines = code.split("\n");

  for (const conv of conventions) {
    if (conv.required_pattern) {
      const found = code.includes(conv.required_pattern);
      if (!found) {
        violations.push({
          convention_id: conv.id,
          rule: conv.rule,
          line: 1,
          description: `缺少约定模式: ${conv.required_pattern}`,
        });
      }
    }

    if (conv.forbidden_pattern) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(conv.forbidden_pattern)) {
          violations.push({
            convention_id: conv.id,
            rule: conv.rule,
            line: i + 1,
            description: `使用了禁用模式: ${conv.forbidden_pattern}`,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * 检查是否需要上报主Agent (≥3 处偏离)
 */
export function should_escalate_convention(violations: ConventionViolation[]): boolean {
  return violations.length >= 3;
}

/**
 * 生成约定冲突记录
 */
export function create_convention_conflict(
  member_name: string,
  group_name: string,
  violations: ConventionViolation[]
): ConflictRecord {
  return {
    conflict_id: `C-CONV-${Date.now()}`,
    type: "convention",
    parties: [group_name, "主Agent"],
    severity: violations.length >= 5 ? "blocking" : "delayed",
    detected_by: `${group_name}组长`,
    detection_time: new Date().toISOString(),
    resolution_path: "lead_arbitration",
    result: `${member_name} 偏离全局约定 ${violations.length} 处: ${violations.map((v) => v.description).join("; ")}`,
  };
}

// ============ T-0042: 逻辑冲突检测器 ============

export interface RuleImplementation {
  rule_id: string;
  rule_description: string;
  location: string;
  group: string;
  /** 实现的粗略哈希/指纹 (用于比较) */
  fingerprint: string;
}

/**
 * 主Agent 持"业务规则→实现位置"映射表
 * 同一规则出现两个不同实现 → 判定冲突
 */
export function detect_logic_conflict(
  implementations: RuleImplementation[]
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];
  const by_rule = new Map<string, RuleImplementation[]>();

  for (const impl of implementations) {
    const existing = by_rule.get(impl.rule_id) || [];
    existing.push(impl);
    by_rule.set(impl.rule_id, existing);
  }

  for (const [rule_id, impls] of by_rule) {
    if (impls.length < 2) continue;

    // 比较任意两个实现
    for (let i = 0; i < impls.length; i++) {
      for (let j = i + 1; j < impls.length; j++) {
        if (impls[i].fingerprint !== impls[j].fingerprint &&
            impls[i].group !== impls[j].group) {
          conflicts.push({
            conflict_id: `C-LOGIC-${rule_id}-${Date.now()}`,
            type: "logic",
            parties: [impls[i].group, impls[j].group],
            severity: "blocking",
            detected_by: "主Agent",
            detection_time: new Date().toISOString(),
            resolution_path: "lead_arbitration",
            result: `业务规则 "${rule_id}" 在 ${impls[i].group}(${impls[i].location}) 和 ${impls[j].group}(${impls[j].location}) 中存在不同实现 (指纹: ${impls[i].fingerprint} vs ${impls[j].fingerprint})`,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * 生成实现的指纹
 */
export function generate_implementation_fingerprint(code: string): string {
  // 基于代码结构生成粗略指纹
  const normalized = code
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/['"`]/g, "'")
    .replace(/\b[a-zA-Z_]\w*\b/g, "_ID_")
    .replace(/\b\d+\b/g, "_NUM_")
    .trim();

  // 简单哈希
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// ============ T-0043: 仲裁决策引擎 ============

export type ArbitrationPath =
  | "side_a"
  | "side_b"
  | "compromise"
  | "client_decision";

export interface ArbitrationDecision {
  conflict_id: string;
  resolution: ArbitrationPath;
  winner?: string;
  reason: string;
  convention_update?: string;
  decided_at: string;
}

/**
 * 根据冲突类型和双方立场做出仲裁决策
 *
 * - 技术性冲突 → 查需求文档+全局约定 → 判偏离方
 * - 两方合理路径不同 → 主Agent 选最优 + 理由
 * - 需求模糊 → 两套方案让客户选
 */
export function arbitrate(
  conflict: ConflictRecord,
  context?: {
    requirements?: string;
    conventions?: string[];
    side_a_rationale?: string;
    side_b_rationale?: string;
  }
): ArbitrationDecision {
  // 约定冲突 → 以全局约定为准
  if (conflict.type === "convention") {
    return {
      conflict_id: conflict.conflict_id,
      resolution: "side_a", // 约定方(主Agent)为准
      reason: "以全局约定为准，偏离方需修正",
      convention_update: conflict.result,
      decided_at: new Date().toISOString(),
    };
  }

  // 数据冲突 → 数据组长为权威方
  if (conflict.type === "data") {
    return {
      conflict_id: conflict.conflict_id,
      resolution: "side_b", // 数据组长(schema方)为准
      winner: conflict.parties[1],
      reason: `数据 Schema 为权威源，${conflict.parties[0]} 需按 Schema 调整`,
      decided_at: new Date().toISOString(),
    };
  }

  // 接口冲突 → 查看需求约定
  if (conflict.type === "interface") {
    if (context?.requirements) {
      return {
        conflict_id: conflict.conflict_id,
        resolution: "compromise",
        reason: `依据需求 "${context.requirements}" 进行接口对齐`,
        convention_update: `接口约定: ${conflict.result}`,
        decided_at: new Date().toISOString(),
      };
    }
    // 需求模糊 → 客户决策
    return {
      conflict_id: conflict.conflict_id,
      resolution: "client_decision",
      reason: "需求不够明确，两种接口方案均可，建议提交客户选择",
      decided_at: new Date().toISOString(),
    };
  }

  // 逻辑冲突 → 主Agent 选择最优
  if (conflict.type === "logic") {
    // 简化的选择逻辑: 基于理由长度和质量
    const a_score = (context?.side_a_rationale?.length || 20) +
      (context?.side_a_rationale?.includes("性能") ? 10 : 0) +
      (context?.side_a_rationale?.includes("安全") ? 10 : 0);
    const b_score = (context?.side_b_rationale?.length || 20) +
      (context?.side_b_rationale?.includes("性能") ? 10 : 0) +
      (context?.side_b_rationale?.includes("安全") ? 10 : 0);

    const winner = a_score >= b_score ? conflict.parties[0] : conflict.parties[1];
    const reason_detail = a_score >= b_score ?
      (context?.side_a_rationale || "方案A综合更优") :
      (context?.side_b_rationale || "方案B综合更优");

    return {
      conflict_id: conflict.conflict_id,
      resolution: a_score >= b_score ? "side_a" : "side_b",
      winner,
      reason: `综合评估: ${reason_detail}`,
      decided_at: new Date().toISOString(),
    };
  }

  // 默认: 主Agent 裁决
  return {
    conflict_id: conflict.conflict_id,
    resolution: "compromise",
    reason: "主Agent 根据项目整体利益做出裁决",
    decided_at: new Date().toISOString(),
  };
}

// ============ T-0044: 协商超时检测 ============

export interface NegotiationState {
  conflict_id: string;
  rounds: number;
  max_rounds: number;
  started_at: string;
  last_round_at: string;
  status: "negotiating" | "escalated" | "resolved";
}

export function create_negotiation(conflict_id: string, max_rounds: number = 2): NegotiationState {
  return {
    conflict_id,
    rounds: 0,
    max_rounds,
    started_at: new Date().toISOString(),
    last_round_at: new Date().toISOString(),
    status: "negotiating",
  };
}

/**
 * 记录一轮协商
 */
export function record_negotiation_round(state: NegotiationState): NegotiationState {
  const new_rounds = state.rounds + 1;
  const exceeded = new_rounds > state.max_rounds;

  return {
    ...state,
    rounds: new_rounds,
    last_round_at: new Date().toISOString(),
    status: exceeded ? "escalated" : "negotiating",
  };
}

/**
 * 检查是否应该超时升级
 */
export function check_negotiation_timeout(state: NegotiationState): boolean {
  if (state.status === "escalated" || state.status === "resolved") return false;

  // 轮次超限
  if (state.rounds >= state.max_rounds) return true;

  // 时间超限 (每轮最多 30 分钟)
  const last_round = new Date(state.last_round_at).getTime();
  const now = Date.now();
  const minutes_since_last = (now - last_round) / (1000 * 60);

  return minutes_since_last > 30;
}

/**
 * 超时升级: 暂停相关成员任务，升级到主Agent
 */
export function escalate_to_main_agent(
  state: NegotiationState,
  conflict: ConflictRecord
): {
  state: NegotiationState;
  conflict: ConflictRecord;
  suspended_groups: string[];
} {
  const escalated_state: NegotiationState = {
    ...state,
    status: "escalated",
    last_round_at: new Date().toISOString(),
  };

  const escalated_conflict: ConflictRecord = {
    ...conflict,
    severity: "blocking",
    resolution_path: "lead_arbitration",
    result: `[协商超时升级] ${conflict.result}`,
  };

  return {
    state: escalated_state,
    conflict: escalated_conflict,
    suspended_groups: conflict.parties,
  };
}

// ============ T-0045: 仲裁结果写入 ============

export interface ArbitrationResult {
  decision: ArbitrationDecision;
  original_conflict: ConflictRecord;
  convention_updates: string[];
  party_marks: { name: string; mark: string }[];
  resolved_at: string;
}

/**
 * 将仲裁结果写入全局约定表、人物卡标记、项目档案
 */
export function apply_arbitration_result(
  decision: ArbitrationDecision,
  conflict: ConflictRecord,
  conventions: ConventionRule[],
  party_cards: PersonaCard[]
): {
  updated_conventions: ConventionRule[];
  updated_cards: PersonaCard[];
  archive_entry: ConflictRecord;
  result: ArbitrationResult;
} {
  // 1. 更新全局约定表
  const convention_updates: string[] = [];
  let updated_conventions = [...conventions];

  if (decision.convention_update) {
    convention_updates.push(decision.convention_update);
    updated_conventions = [
      ...updated_conventions,
      {
        id: `CONV-AUTO-${Date.now()}`,
        category: "arbitration",
        rule: decision.convention_update,
      },
    ];
  }

  // 2. 冲突双方人物卡打标记
  const updated_cards = party_cards.map((card) => {
    if (conflict.parties.some((p) => card.name.includes(p) || p.includes(card.name) || card.role.includes(p))) {
      return {
        ...card,
        behavior_rules: [
          ...card.behavior_rules,
          `[仲裁标记] 冲突 ${conflict.conflict_id}: ${decision.reason}`,
        ],
      };
    }
    return card;
  });

  const party_marks = updated_cards
    .filter((c) => party_cards.includes(c))
    .map((c) => ({ name: c.name, mark: decision.reason }));

  // 3. 写入冲突记录 (带解决信息)
  const archive_entry: ConflictRecord = {
    ...conflict,
    resolution_path: decision.resolution === "compromise" ? "negotiation" :
      decision.resolution === "client_decision" ? "client_decision" : "lead_arbitration",
    result: `[已仲裁: ${decision.resolution}] ${decision.reason}`,
    convention_update: decision.convention_update,
    resolved_at: decision.decided_at,
  };

  const result: ArbitrationResult = {
    decision,
    original_conflict: conflict,
    convention_updates,
    party_marks,
    resolved_at: decision.decided_at,
  };

  return { updated_conventions, updated_cards, archive_entry, result };
}

// ============ 全局约定模板库 ============

export const DEFAULT_CONVENTIONS: ConventionRule[] = [
  { id: "C001", category: "响应格式", rule: "统一使用 {code, data, message} 响应结构", required_pattern: "code", forbidden_pattern: "status_code" },
  { id: "C002", category: "错误处理", rule: "错误必须通过统一错误码返回，不可直接 panic/process.exit", forbidden_pattern: "process.exit" },
  { id: "C003", category: "命名规范", rule: "API 路由使用 camelCase 或 kebab-case", required_pattern: "" },
  { id: "C004", category: "数据库", rule: "表名使用 snake_case 复数形式", required_pattern: "" },
  { id: "C005", category: "日志", rule: "使用结构化日志，禁止 console.log 在生产代码中", forbidden_pattern: "console.log" },
  { id: "C006", category: "鉴权", rule: "所有 API 端点必须经过鉴权中间件", required_pattern: "auth" },
  { id: "C007", category: "版本", rule: "API URL 必须包含版本前缀 /api/v{N}/", required_pattern: "/api/v" },
  { id: "C008", category: "分页", rule: "列表接口必须支持分页参数 page/pageSize", required_pattern: "page" },
];

/**
 * 一站式冲突检测与仲裁流程
 */
export function run_conflict_detection_pipeline(
  interfaces: InterfaceDefinition[],
  operations: WriteOperation[],
  data_schema: DataSchema,
  member_code_map: Record<string, string>, // member_name → code
  implementations: RuleImplementation[],
  conventions: ConventionRule[],
  party_cards: PersonaCard[]
): {
  conflicts: ConflictRecord[];
  decisions: ArbitrationDecision[];
  results: ArbitrationResult[];
} {
  const all_conflicts: ConflictRecord[] = [];

  // T-0039: 接口冲突
  all_conflicts.push(...detect_all_interface_conflicts(interfaces));

  // T-0040: 数据冲突
  for (const op of operations) {
    const c = detect_data_conflict(op, data_schema);
    if (c) all_conflicts.push(c);
  }

  // T-0041: 约定冲突
  for (const [member, code] of Object.entries(member_code_map)) {
    const violations = detect_convention_violations(code, conventions);
    if (should_escalate_convention(violations)) {
      all_conflicts.push(create_convention_conflict(member, "相关组", violations));
    }
  }

  // T-0042: 逻辑冲突
  all_conflicts.push(...detect_logic_conflict(implementations));

  // T-0043: 仲裁
  const decisions = all_conflicts.map((c) => arbitrate(c));

  // T-0045: 写入
  const results = decisions.map((d, i) =>
    apply_arbitration_result(d, all_conflicts[i], conventions, party_cards).result
  );

  return { conflicts: all_conflicts, decisions, results };
}
