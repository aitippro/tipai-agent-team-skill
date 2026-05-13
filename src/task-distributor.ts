/**
 * 任务下发系统
 *
 * T-0029: 阶段任务卡生成器
 * T-0030: 模块任务卡生成器
 * T-0031: 任务下发协议
 * T-0032: 进度汇报链
 */

import {
  StageTaskCard, ModuleTaskCard,
  AcceptanceCriterion,
} from "./schemas";
import { InterviewSummary } from "./interview";
import { TeamGroup } from "./team-assembler";

// ============ T-0029: 阶段任务卡生成器 ============

export interface StageDefinition {
  stage_id: string;
  goal: string;
  acceptance_criteria: AcceptanceCriterion[];
  assigned_groups: string[];
  deadline_offset_days: number;
}

const DEFAULT_STAGES: StageDefinition[] = [
  {
    stage_id: "S-001",
    goal: "项目脚手架搭建与CI/CD配置",
    acceptance_criteria: [
      { description: "所有组代码仓库初始化完成" },
      { description: "CI/CD流水线可正常执行" },
      { description: "各组依赖安装无报错" },
    ],
    assigned_groups: [],
    deadline_offset_days: 3,
  },
  {
    stage_id: "S-002",
    goal: "核心业务模块开发",
    acceptance_criteria: [
      { description: "核心API端点实现并可通过冒烟测试" },
      { description: "数据库表结构创建完毕" },
      { description: "前端页面骨架可交互" },
    ],
    assigned_groups: [],
    deadline_offset_days: 14,
  },
  {
    stage_id: "S-003",
    goal: "功能完善与集成联调",
    acceptance_criteria: [
      { description: "各组接口对接完毕" },
      { description: "端到端主流程可走通" },
      { description: "单元测试覆盖率 ≥ 80%" },
    ],
    assigned_groups: [],
    deadline_offset_days: 7,
  },
  {
    stage_id: "S-004",
    goal: "QA测试与问题修复",
    acceptance_criteria: [
      { description: "所有已知Bug修复完毕" },
      { description: "性能测试通过" },
      { description: "安全扫描无高危漏洞" },
    ],
    assigned_groups: [],
    deadline_offset_days: 5,
  },
  {
    stage_id: "S-005",
    goal: "上线部署与文档归档",
    acceptance_criteria: [
      { description: "生产环境部署成功" },
      { description: "监控告警配置完毕" },
      { description: "项目档案归档完毕" },
    ],
    assigned_groups: [],
    deadline_offset_days: 3,
  },
];

/**
 * 生成阶段任务卡
 * 主Agent 将项目拆分为多个阶段，每组生成对应阶段卡
 */
export function generate_stage_task_cards(
  summary: InterviewSummary,
  groups: TeamGroup[],
  stages?: StageDefinition[]
): StageTaskCard[] {
  const stage_defs = stages || DEFAULT_STAGES;
  const cards: StageTaskCard[] = [];

  // 自动分配组到阶段
  const all_groups = groups.map((g) => g.group_name);
  const stages_with_groups = stage_defs.map((s) => ({
    ...s,
    assigned_groups: s.assigned_groups.length > 0 ? s.assigned_groups : all_groups,
  }));

  for (const stage of stages_with_groups) {
    for (const group_name of stage.assigned_groups) {
      const group = groups.find((g) => g.group_name === group_name);
      if (!group) continue;

      const stage_id = `${stage.stage_id}-${group_name}`;

      // 计算截止日期: 假设从今天开始
      const start_date = new Date();
      const deadline = new Date(start_date);
      deadline.setDate(deadline.getDate() + stage.deadline_offset_days);

      cards.push({
        stage_id,
        from: "主Agent",
        to: group.lead.name,
        goal: `${stage.goal} (${group_name})`,
        acceptance_criteria: stage.acceptance_criteria,
        deadline: deadline.toISOString().split("T")[0],
        dependencies: {
          upstream: groups.length > 0 && group_name !== groups[0].group_name
            ? groups[0].group_name
            : undefined,
          downstream: undefined,
        },
        constraints: [
          `技术栈: ${summary.tech_stack}`,
          "不得跳过组长直接指派成员",
          "完成标准以验收条件为准",
        ],
      });
    }
  }

  return cards;
}

/**
 * 获取指定组的所有阶段任务卡
 */
export function get_group_stage_cards(
  cards: StageTaskCard[],
  lead_name: string
): StageTaskCard[] {
  return cards.filter((c) => c.to === lead_name);
}

/**
 * 获取当前活跃阶段 (第一个未完成的阶段)
 */
export function get_active_stage(
  cards: StageTaskCard[],
  completed_stage_ids: Set<string>
): StageTaskCard | null {
  for (const card of cards) {
    if (!completed_stage_ids.has(card.stage_id)) {
      return card;
    }
  }
  return null;
}

// ============ T-0030: 模块任务卡生成器 ============

/**
 * 组长将阶段任务卡拆解为模块任务卡
 */
export function generate_module_task_card(
  stage_card: StageTaskCard,
  module_name: string,
  member_name: string,
  lead_name: string,
  forbidden_items?: string[],
  must_interface?: { role: string; spec: string }[]
): ModuleTaskCard {
  const tasks = derive_module_tasks(module_name, stage_card.goal);
  const output_format = derive_output_format(module_name);
  const deadline = stage_card.deadline; // 继承阶段截止日期

  return {
    module_id: `${stage_card.stage_id}-${module_name}`,
    from: lead_name,
    to: member_name,
    tasks,
    output_format,
    deadline,
    must_interface: must_interface || [],
    forbidden: [
      "不得跨模块修改代码",
      "不得自行与其他组对接",
      "不得修改全局配置文件",
      ...(forbidden_items || []),
    ],
  };
}

function derive_module_tasks(
  module_name: string,
  _stage_goal: string
): { id: string; description: string }[] {
  const base_tasks: Record<string, { id: string; description: string }[]> = {
    "页面布局与路由": [
      { id: "T1", description: "设计页面路由结构" },
      { id: "T2", description: "实现布局组件" },
      { id: "T3", description: "编写路由单元测试" },
    ],
    "组件库": [
      { id: "T1", description: "盘点所需组件清单" },
      { id: "T2", description: "实现核心通用组件" },
      { id: "T3", description: "编写组件文档与Storybook" },
    ],
    "状态管理": [
      { id: "T1", description: "设计状态结构" },
      { id: "T2", description: "实现actions/reducers" },
      { id: "T3", description: "编写状态测试" },
    ],
    "API对接": [
      { id: "T1", description: "定义API请求层" },
      { id: "T2", description: "实现数据获取与缓存" },
      { id: "T3", description: "错误处理与重试逻辑" },
    ],
    "订单模块": [
      { id: "T1", description: "设计订单表结构与状态机" },
      { id: "T2", description: "实现订单CRUD API" },
      { id: "T3", description: "编写订单事务测试" },
    ],
    "支付模块": [
      { id: "T1", description: "设计支付流水表" },
      { id: "T2", description: "实现支付接口对接" },
      { id: "T3", description: "编写支付对账测试" },
    ],
    "库存模块": [
      { id: "T1", description: "设计库存表与锁机制" },
      { id: "T2", description: "实现库存扣减API" },
      { id: "T3", description: "编写并发库存测试" },
    ],
    "用户模块": [
      { id: "T1", description: "设计用户表与权限模型" },
      { id: "T2", description: "实现注册登录API" },
      { id: "T3", description: "编写认证测试" },
    ],
    "内容管理": [
      { id: "T1", description: "设计内容模型" },
      { id: "T2", description: "实现CRUD+发布流程" },
      { id: "T3", description: "编写内容管理测试" },
    ],
    "用户权限": [
      { id: "T1", description: "设计RBAC权限模型" },
      { id: "T2", description: "实现鉴权中间件" },
      { id: "T3", description: "编写权限测试" },
    ],
    "搜索模块": [
      { id: "T1", description: "设计搜索索引结构" },
      { id: "T2", description: "实现全文搜索API" },
      { id: "T3", description: "编写搜索测试" },
    ],
    "核心业务API": [
      { id: "T1", description: "设计API路由结构" },
      { id: "T2", description: "实现核心业务逻辑" },
      { id: "T3", description: "编写集成测试" },
    ],
    "用户认证": [
      { id: "T1", description: "设计JWT/Session方案" },
      { id: "T2", description: "实现登录+刷新token" },
      { id: "T3", description: "编写认证测试" },
    ],
    "数据接口": [
      { id: "T1", description: "设计数据访问层" },
      { id: "T2", description: "实现查询与写入接口" },
      { id: "T3", description: "编写DAO测试" },
    ],
    "表结构设计": [
      { id: "T1", description: "ER图设计与评审" },
      { id: "T2", description: "编写migration文件" },
      { id: "T3", description: "执行并验证migration" },
    ],
    "查询优化": [
      { id: "T1", description: "识别慢查询" },
      { id: "T2", description: "添加索引与优化SQL" },
      { id: "T3", description: "编写性能对比报告" },
    ],
    "数据迁移": [
      { id: "T1", description: "制定数据迁移方案" },
      { id: "T2", description: "实现迁移脚本" },
      { id: "T3", description: "编写迁移回滚测试" },
    ],
    "备份策略": [
      { id: "T1", description: "设计备份策略" },
      { id: "T2", description: "实现自动备份脚本" },
      { id: "T3", description: "编写恢复验证测试" },
    ],
    "CI/CD流水线": [
      { id: "T1", description: "配置构建流水线" },
      { id: "T2", description: "配置自动化测试" },
      { id: "T3", description: "配置自动部署" },
    ],
    "部署配置": [
      { id: "T1", description: "编写Dockerfile/docker-compose" },
      { id: "T2", description: "配置环境变量与密钥管理" },
      { id: "T3", description: "编写部署文档" },
    ],
    "监控告警": [
      { id: "T1", description: "配置健康检查端点" },
      { id: "T2", description: "接入监控系统" },
      { id: "T3", description: "配置告警规则" },
    ],
  };

  const key = Object.keys(base_tasks).find((k) => module_name.includes(k) || k.includes(module_name));
  if (key) return base_tasks[key];

  // 合并模块 (如 "订单模块 + 支付模块")
  const parts = module_name.split(" + ");
  if (parts.length > 1) {
    const merged: { id: string; description: string }[] = [];
    for (const part of parts) {
      const match_key = Object.keys(base_tasks).find((k) => part.includes(k) || k.includes(part));
      if (match_key) merged.push(...base_tasks[match_key]);
    }
    if (merged.length > 0) return merged;
  }

  return [
    { id: "T1", description: `实现${module_name}核心逻辑` },
    { id: "T2", description: `对接上下游接口` },
    { id: "T3", description: `编写${module_name}单元测试` },
  ];
}

function derive_output_format(module_name: string): string {
  if (module_name.includes("前端") || module_name.includes("页面") || module_name.includes("组件") || module_name.includes("状态") || module_name.includes("API对接")) {
    return "TypeScript/TSX源码 + 单元测试文件";
  }
  if (module_name.includes("表结构") || module_name.includes("迁移") || module_name.includes("备份")) {
    return "SQL文件 + migration脚本 + 测试报告";
  }
  if (module_name.includes("CI/CD") || module_name.includes("部署") || module_name.includes("监控")) {
    return "YAML配置文件 + 部署文档";
  }
  return "源码文件(.go/.ts) + 单元测试文件 + API文档";
}

// ============ T-0031: 任务下发协议 ============

export interface DispatchState {
  /** 成员当前持有的模块卡ID (member_name -> module_id) */
  member_tasks: Record<string, string>;
  /** 紧急插队队列 */
  emergency_queue: { stage_id: string; to_group: string; reason: string; inserted_at: string }[];
  /** 已完成的模块 */
  completed_modules: Set<string>;
  /** 模块截止日期记录 */
  deadlines: Record<string, string>; // module_id -> ISO date
}

export function create_dispatch_state(): DispatchState {
  return {
    member_tasks: {},
    emergency_queue: [],
    completed_modules: new Set(),
    deadlines: {},
  };
}

/**
 * 检查是否可以下发任务给某成员
 * 规则: 每成员同时只持 1 张模块卡
 */
export function can_dispatch_to(member_name: string, state: DispatchState): boolean {
  return !(member_name in state.member_tasks);
}

/**
 * 下发模块任务卡给成员
 * 返回 null 表示该成员已有任务在身
 */
export function dispatch_task(
  card: ModuleTaskCard,
  state: DispatchState
): DispatchState | null {
  if (!can_dispatch_to(card.to, state)) {
    return null;
  }

  return {
    ...state,
    member_tasks: { ...state.member_tasks, [card.to]: card.module_id },
    deadlines: { ...state.deadlines, [card.module_id]: card.deadline },
  };
}

/**
 * 标记任务完成，释放成员
 */
export function complete_task(
  module_id: string,
  member_name: string,
  state: DispatchState
): DispatchState {
  const member_tasks = { ...state.member_tasks };
  delete member_tasks[member_name];

  const completed_modules = new Set(state.completed_modules);
  completed_modules.add(module_id);

  return {
    ...state,
    member_tasks,
    completed_modules,
  };
}

/**
 * 超时检测: 距 deadline 剩 30% → 警告
 */
export type TimeoutStatus = "on_track" | "at_risk" | "overdue";

export function check_timeout_risk(
  _module_id: string,
  deadline: string,
  assigned_at: string
): TimeoutStatus {
  const deadline_ms = new Date(deadline).getTime();
  const assigned_ms = new Date(assigned_at).getTime();
  const now = Date.now();

  if (now >= deadline_ms) return "overdue";

  const total_duration = deadline_ms - assigned_ms;
  const remaining = deadline_ms - now;
  const ratio = remaining / total_duration;

  if (ratio <= 0.3) return "at_risk";
  return "on_track";
}

/**
 * 批量检查所有活跃任务的超时状态
 */
export function batch_check_timeout(
  state: DispatchState,
  assigned_dates: Record<string, string> // module_id -> assigned_at ISO
): { module_id: string; member: string; status: TimeoutStatus }[] {
  const results: { module_id: string; member: string; status: TimeoutStatus }[] = [];

  for (const [member, module_id] of Object.entries(state.member_tasks)) {
    const deadline = state.deadlines[module_id];
    const assigned_at = assigned_dates[module_id];
    if (deadline && assigned_at) {
      results.push({
        module_id,
        member,
        status: check_timeout_risk(module_id, deadline, assigned_at),
      });
    }
  }

  return results;
}

/**
 * 紧急插队: 主Agent→组长 P0 插入
 */
export function insert_emergency(
  stage_id: string,
  to_group: string,
  reason: string,
  state: DispatchState
): DispatchState {
  return {
    ...state,
    emergency_queue: [
      ...state.emergency_queue,
      {
        stage_id,
        to_group,
        reason,
        inserted_at: new Date().toISOString(),
      },
    ],
  };
}

/**
 * 获取并清除紧急队列 (组长取走)
 */
export function consume_emergency_queue(
  state: DispatchState,
  group_name: string
): { queue: DispatchState["emergency_queue"]; state: DispatchState } {
  const group_emergencies = state.emergency_queue.filter((e) => e.to_group === group_name);
  const remaining = state.emergency_queue.filter((e) => e.to_group !== group_name);

  return {
    queue: group_emergencies,
    state: { ...state, emergency_queue: remaining },
  };
}

/**
 * 验证下发层级: 不可越级
 * - StageTaskCard: from必须是"主Agent"
 * - ModuleTaskCard: from必须是组长
 */
export function validate_dispatch_chain(
  stage_card: StageTaskCard,
  module_card: ModuleTaskCard,
  lead_name: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (stage_card.from !== "主Agent") {
    errors.push("阶段任务卡必须由主Agent下发");
  }
  if (stage_card.to !== lead_name) {
    errors.push(`阶段任务卡收件人必须是组长 ${lead_name}`);
  }
  if (module_card.from !== lead_name) {
    errors.push("模块任务卡必须由组长下发");
  }
  if (!module_card.module_id.startsWith(stage_card.stage_id)) {
    errors.push("模块任务卡的module_id必须以阶段任务卡的stage_id为前缀");
  }

  return { valid: errors.length === 0, errors };
}

// ============ T-0032: 进度汇报链 ============

export interface MemberProgressReport {
  member_name: string;
  date: string;
  done: string[];
  problems: string[];
  on_track: boolean;
}

export interface StageProgressSummary {
  stage_id: string;
  group_name: string;
  completion_rate: number;
  total_tasks: number;
  completed_tasks: number;
  blockers: string[];
  abnormal_members: { name: string; issue: string }[];
  generated_at: string;
}

/**
 * 成员创建每日进度报告
 */
export function create_member_progress_report(
  member_name: string,
  done: string[],
  problems: string[],
  on_track: boolean
): MemberProgressReport {
  return {
    member_name,
    date: new Date().toISOString().split("T")[0],
    done,
    problems,
    on_track,
  };
}

/**
 * 组长汇总成阶段进度摘要
 */
export function create_stage_progress_summary(
  reports: MemberProgressReport[],
  stage_id: string,
  group_name: string,
  total_tasks: number,
  completed_tasks: number
): StageProgressSummary {
  const blockers: string[] = [];
  const abnormal_members: { name: string; issue: string }[] = [];

  for (const report of reports) {
    // 收集所有问题
    for (const problem of report.problems) {
      blockers.push(`${report.member_name}: ${problem}`);
    }
    // 偏离轨道的成员
    if (!report.on_track) {
      abnormal_members.push({
        name: report.member_name,
        issue: "进度偏离计划轨道",
      });
    }
    // 无汇报的成员 -> 也需要标记
    if (report.done.length === 0 && report.problems.length === 0) {
      abnormal_members.push({
        name: report.member_name,
        issue: "未提交有效汇报",
      });
    }
  }

  const completion_rate = total_tasks > 0 ? completed_tasks / total_tasks : 0;

  return {
    stage_id,
    group_name,
    completion_rate: Math.round(completion_rate * 100) / 100,
    total_tasks,
    completed_tasks,
    blockers: blockers.length > 0 ? blockers : ["无阻塞"],
    abnormal_members,
    generated_at: new Date().toISOString(),
  };
}

/**
 * 检查汇报是否每日 (至少每24小时一次)
 */
export function is_report_overdue(last_report_date: string): boolean {
  const last = new Date(last_report_date).getTime();
  const now = Date.now();
  const hours_since = (now - last) / (1000 * 60 * 60);
  return hours_since > 24;
}

/**
 * 汇总所有组的阶段摘要到主Agent视图
 */
export function aggregate_progress(
  summaries: StageProgressSummary[]
): {
  overall_completion: number;
  total_blockers: string[];
  critical_groups: string[];
} {
  const total_completion = summaries.reduce((sum, s) => sum + s.completion_rate, 0);
  const overall_completion = summaries.length > 0
    ? Math.round((total_completion / summaries.length) * 100) / 100
    : 0;

  const total_blockers = summaries.flatMap((s) => s.blockers.filter((b) => b !== "无阻塞"));

  const critical_groups = summaries
    .filter((s) => s.abnormal_members.length > 0)
    .map((s) => s.group_name);

  return { overall_completion, total_blockers, critical_groups };
}
