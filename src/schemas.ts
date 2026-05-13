/**
 * 核心数据结构 — 完整 Schema 定义
 *
 * T-0004: PersonaCard Schema
 * T-0005: PersonaCard 生成时验证
 * T-0006: TaskCard Schema
 * T-0007: StructuredArchive Schema
 * T-0008: SatisfactionRecord Schema
 * T-0009: ConflictRecord Schema
 * T-0010: FaultRecord Schema
 * T-0011: ProjectArchive Schema
 * T-0012: RoleInventory Schema
 */

// ============ T-0004: PersonaCard Schema ============

export type LifecycleMode = "permanent" | "project_destroy" | "follow_project";
export type PermissionMode = "bypassPermissions" | "default";
export type AgentRole = "lead" | "team_lead" | "member";

export interface InputSource {
  from: string;
  format: string;
}

export interface OutputTarget {
  to: string;
  format: string;
}

export interface TechEnv {
  language?: string;
  framework?: string;
  tools?: string[];
  code_style?: string;
}

export interface PersonaCard {
  /** 随机生成的姓名，同一项目内不重名 */
  name: string;
  /** 角色/职位，如"订单模块后端工程师" */
  role: string;
  /** 一句话概述，≤20字 */
  summary: string;
  /** 核心能力 — 强制做的事（3-5条强约束词） */
  must_do: string[];
  /** 能力边界线 — 绝对不能做的事（≥2条） */
  must_not_do: string[];
  /** 技术环境 */
  tech_env: TechEnv;
  /** 输入源 — 从谁接收什么 */
  input_sources: InputSource[];
  /** 交付物 — 产出什么给谁 */
  output_targets: OutputTarget[];
  /** 行为准则 — 默认含"越界回复"和"不确定回复" */
  behavior_rules: string[];
  /** 权限模式，组长和成员强制 bypassPermissions */
  permission_mode: PermissionMode;
  /** 生命周期模式 */
  lifecycle: LifecycleMode;
}

// ============ T-0006: TaskCard Schema ============

export interface AcceptanceCriterion {
  description: string;
  threshold?: string;
}

export interface StageTaskCard {
  stage_id: string;
  from: "主Agent";
  to: string; // 组长名
  goal: string;
  acceptance_criteria: AcceptanceCriterion[];
  deadline: string; // ISO date
  dependencies: { upstream?: string; downstream?: string };
  constraints: string[];
}

export interface ModuleTaskCard {
  module_id: string;
  from: string; // 组长名
  to: string; // 成员名
  tasks: { id: string; description: string }[];
  output_format: string;
  deadline: string;
  must_interface: { role: string; spec: string }[];
  forbidden: string[];
}

// ============ T-0007: StructuredArchive Schema ============

export interface WorkRecord {
  task_id: string;
  time_range: string;
  goal: string;
  decision_chain: string;
  outputs: string[];
  pitfalls: string[];
  reusable_snippets: string[];
}

export interface SkillEvolution {
  start: string;
  mid: string;
  end: string;
}

export interface StructuredArchive {
  name: string;
  role: string;
  lifecycle: LifecycleMode;
  /** 从人物卡继承的基础信息 */
  base_info: PersonaCard;
  /** 工作履历 */
  work_history: WorkRecord[];
  /** 技能演进 */
  skill_evolution: SkillEvolution;
  /** 组长和主Agent的批注 */
  annotations: { date: string; author: string; content: string }[];
}

// ============ T-0008: SatisfactionRecord Schema ============

export interface SatisfactionScore {
  quality: number;      // 做实程度 1-5
  standard: number;     // 质量标准 1-5
  collaboration: number; // 协作表现 1-5
  bonus: number;        // 加分项 0-5
  composite: number;    // 综合分 (权重计算)
}

export interface ClientModification {
  original_score: number;
  modified_score: number;
  client_reason: string;
  dimension: string;
}

export interface SatisfactionRecord {
  stage_id: string;
  group_name: string;
  lead_score: SatisfactionScore;
  member_details: { name: string; scores: SatisfactionScore }[];
  client_modifications: ClientModification[];
  final_scores: SatisfactionScore;
}

// ============ T-0009: ConflictRecord Schema ============

export type ConflictType = "interface" | "data" | "convention" | "logic";
export type ConflictSeverity = "blocking" | "delayed";

export interface ConflictRecord {
  conflict_id: string;
  type: ConflictType;
  parties: string[];
  severity: ConflictSeverity;
  detected_by: string;
  detection_time: string;
  resolution_path: "negotiation" | "lead_arbitration" | "client_decision";
  result: string;
  convention_update?: string;
  resolved_at?: string;
}

// ============ T-0010: FaultRecord Schema ============

export type FaultLevel = "self_heal" | "need_intervention" | "need_replace" | "need_pause";

export interface FaultRecord {
  fault_id: string;
  role_name: string;
  fault_count: number;
  latest_fault: { date: string; description: string };
  fault_pattern: string;
  suggestion: string;
  level: FaultLevel;
}

// ============ T-0011: ProjectArchive Schema ============

export interface ProjectArchive {
  project_id: string;
  project_name: string;
  time_range: string;
  status: "active" | "completed" | "paused";
  original_requirements: string;
  team_structure: { lead_agent: string; groups: { name: string; lead: string; members: string[] }[] };
  stage_records: { stage_id: string; completed_at: string; outputs: string[]; satisfaction: number }[];
  conflict_records: ConflictRecord[];
  fault_records: FaultRecord[];
  satisfaction_summary: { group_avg: Record<string, number>; project_avg: number };
  reusable_outputs: string[];
  inventory_changes: { action: "add" | "remove" | "update"; name: string }[];
}

// ============ T-0012: RoleInventory Schema ============

export interface FrozenPersonaCard {
  original: PersonaCard;
  frozen_at: string;
  tech_tags: string[];
}

export interface RoleInventoryEntry {
  persona_card: FrozenPersonaCard;
  skill_evolution: SkillEvolution;
  history_scores: { project: string; score: number }[];
  avg_score: number;
  suitable_scenarios: string[];
  unsuitable_scenarios: string[];
  status: "active" | "dormant";
}

export interface RoleInventoryIndex {
  entries: { name: string; tech_tags: string[]; avg_score: number; scenarios: string[]; status: string }[];
}

export interface RoleInventory {
  entries: RoleInventoryEntry[];
  index: RoleInventoryIndex;
}
