# TipAI Agent Team Skill

Claude Code Agent Team 技能插件 — 将 Claude Code 从单 Agent 升级为层级 Agent 团队（Agent Swarm）。

## 概述

用户提出需求后，系统自动完成完整 14 阶段工作流，实现需求采访 → 人物卡生成 → 层级组队 → 任务下发 → 代码审查 → 冲突仲裁 → 满意度评估 → 角色库存管理的全链路闭环。

## 核心流程

```
采访 → 人物卡生成 → 团队组建 → 任务下发 → 代码审查 →
冲突仲裁 → 满意度评估 → 生命周期管理 → 角色库存 →
项目档案 → 容错恢复 → 上下文控制 → 退出 → 宪章检查
```

## 架构

```
                         ┌──────────────┐
                         │   主 Agent    │
                         │  (Lead Agent) │
                         └──────┬───────┘
                    ┌───────────┼───────────┐
              ┌─────┴─────┐ ┌──┴──┐ ┌──────┴─────┐
              │  组长 A    │ │组长B│ │  组长 C    │
              │ (Team Lead)│ │     │ │ (Team Lead)│
              └─────┬─────┘ └──┬──┘ └──────┬─────┘
           ┌────────┼────────┐ │   ┌───────┼───────┐
        ┌──┴──┐  ┌──┴──┐  ┌──┴┴┐ ┌┴──┐  ┌──┴──┐  ┌──┴──┐
        │成员1│  │成员2│  │成员3│ │成员4│  │成员5│  │成员6│
        └─────┘  └─────┘  └─────┘ └─────┘  └─────┘  └─────┘
```

### 通信矩阵

| 方向 | 允许 | 规则 |
|------|------|------|
| 主Agent → 组长 | ✅ | 派发阶段卡，不直接派活给成员 |
| 组长 → 成员 | ✅ | 派发模块卡，仅传递必要上下文 |
| 成员 → 组长 | ✅ | 汇报进度、提交产出 |
| 组长 → 组长 | ✅ | 接口协商（不含组内评价） |
| 主Agent → 成员 | ❌ | 越级禁止 |
| 成员 → 成员(跨组) | ❌ | 跨组禁止 |
| 成员 → 主Agent | ❌ | 越级禁止 |

## 模块结构

```
src/
├── schemas.ts                  # 核心类型与结构定义（Layer 1）
├── constitution.ts             # 元规则 / 宪章检查引擎（7 条铁律）
├── interview.ts                # 多轮需求采访（INIT → IMAGE → TECH → FEATURE → CONFIRM）
├── card-generator.ts           # 人物卡生成与审查确认
├── team-assembler.ts           # 层级团队组建（主Agent → 组长 → 成员）
├── validation.ts               # 人物卡 / 任务卡校验
├── task-distributor.ts         # 任务下发与进度追踪（阶段卡 → 模块卡）
├── code-reviewer.ts            # 代码审查（假实现 / 空实现 / 无价值 / 糊弄代码检测）
├── conflict-arbitrator.ts      # 冲突检测与仲裁引擎（4 类检测 / 协商 / 仲裁）
├── satisfaction-system.ts      # 四维满意度打分引擎（质量 / 速度 / 协作 / 主动性）
├── lifecycle-manager.ts        # 角色生命周期管理（活跃 / 冻结 / 销毁 / 调整）
├── role-inventory.ts           # 角色库存系统（写入 / 检索 / 休眠 / 复用）
├── project-archive.ts          # 项目档案（不可变，仅追加）
├── fault-tolerance.ts          # 容错与自动恢复（4 级故障分类）
├── context-control.ts          # 上下文裁剪与泄漏防护（三层裁剪器）
├── exit-handler.ts             # 退出与归档摘要
└── production-orchestrator.ts  # 生产编排器（连接全部模块，1400+ 行）
```

## 安装

```bash
# 克隆仓库
git clone git@github.com:aitippro/tipai-agent-team-skill.git
cd tipai-agent-team-skill

# 安装依赖
npm install

# 类型检查
npm run check

# 运行测试
npm test
```

## 使用方式

在 Claude Code 对话中输入 `/agent-team` 启动 Agent Team 模式：

```
/agent-team
```

系统将自动引导完成：
1. 多轮需求采访（明确项目画像、技术边界、功能拆解）
2. 生成并确认人物卡
3. 组建层级 Agent 团队
4. 分发任务并追踪进度
5. 组长审查代码产出
6. 处理冲突并进行满意度评估

## 测试覆盖

18 个测试套件，623 用例，零失败。

```bash
# 运行全部测试
npm test

# 运行单个测试套件
npx tsx tests/test_constitution.ts
npx tsx tests/test_schemas.ts
npx tsx tests/test_interview.ts
# ... 等 18 个套件
```

### 测试套件列表

| 套件 | 覆盖模块 | 用例数 |
|------|----------|--------|
| `test_layer1_schemas` | 核心类型定义 | 13 |
| `test_schemas` | Schema 校验 + 人物卡/任务卡验证 | 21 |
| `test_constitution` | 宪章检查引擎 | 23 |
| `test_interview` | 多轮采访 | 25 |
| `test_card_generator` | 人物卡生成 | 50 |
| `test_team_assembler` | 团队组建 | 45 |
| `test_task_distributor` | 任务下发 | 46 |
| `test_code_reviewer` | 代码审查 | 57 |
| `test_conflict_arbitrator` | 冲突仲裁 | 69 |
| `test_satisfaction_system` | 满意度系统 | 42 |
| `test_lifecycle_manager` | 生命周期管理 | 31 |
| `test_role_inventory` | 角色库存 | 34 |
| `test_project_archive` | 项目档案 | 20 |
| `test_fault_tolerance` | 容错恢复 | 35 |
| `test_context_control` | 上下文控制 | 51 |
| `test_exit_handler` | 退出处理 | 8 |
| `test_production_orchestrator` | 生产编排器(全链路) | 43 |
| `test_integration` | 端到端集成 | 10 |

## 元规则（宪章）

系统遵循 7 条元规则，优先级 `客户明确指令 > 元规则 > 主Agent决策 > 组长决策 > 全局约定`：

1. **不可越级** — 严格层级通信
2. **交付做实** — 代码必须通过组长 QA
3. **冲突不沉默** — 检测到冲突必须上报
4. **上下文最小化** — 每角色仅接收必要信息
5. **偏好遵从** — 客户偏好优先于内部决策
6. **可追溯** — 所有决策写入不可变档案
7. **客户最终裁定** — 客户可打破任何规则

详见 [commands/agent-team.md](commands/agent-team.md)。

## 许可

[MIT](LICENSE)
