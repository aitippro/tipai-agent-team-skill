/**
 * 核心数据结构 — 人物卡 Schema (T-0004 将完整定义)
 */

export type LifecycleMode = "permanent" | "project_destroy" | "follow_project";

export interface PersonaCard {
  name: string;
  role: string;
  summary: string;
  must_do: string[];
  must_not_do: string[];
  tech_env: Record<string, string>;
  input_sources: { from: string; format: string }[];
  output_targets: { to: string; format: string }[];
  behavior_rules: string[];
  permission_mode: "bypassPermissions" | "default";
  lifecycle: LifecycleMode;
}
