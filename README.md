# TipAI Agent Team Skill

Claude Code Agent Team 技能插件 — 将 Claude Code 从单 Agent 升级为层级 Agent 团队（Agent Swarm）。

## 核心流程

用户提出需求后，系统自动完成完整 14 阶段工作流：

```
采访 → 人物卡生成 → 团队组建 → 任务下发 → 代码审查 →
冲突仲裁 → 满意度评估 → 生命周期管理 → 角色库存 →
项目档案 → 容错恢复 → 上下文控制 → 退出 → 宪章检查
```

## 模块结构

```
src/
├── schemas.ts                  # 核心类型与结构定义（Layer 1）
├── constitution.ts             # 元规则/宪章检查引擎
├── interview.ts                # 多轮需求采访
├── card-generator.ts           # 人物卡生成与审查
├── team-assembler.ts           # 层级团队组建
├── validation.ts               # 人物卡/任务卡校验
├── task-distributor.ts         # 任务下发与进度追踪
├── code-reviewer.ts            # 代码审查（假实现/空实现/糊弄代码检测）
├── conflict-arbitrator.ts      # 冲突检测与仲裁引擎
├── satisfaction-system.ts      # 四维满意度打分引擎
├── lifecycle-manager.ts        # 角色生命周期管理
├── role-inventory.ts           # 角色库存系统
├── project-archive.ts          # 项目档案（不可变，可追加）
├── fault-tolerance.ts          # 容错与自动恢复
├── context-control.ts          # 上下文裁剪与泄漏防护
├── exit-handler.ts             # 退出与归档摘要
└── production-orchestrator.ts  # 生产编排器（连接全部模块）
```

## 测试覆盖

18 个测试套件，605+ 用例，零失败，覆盖所有模块与全链路端到端场景。

## 使用方式

在 Claude Code 对话中输入 `/agent-team` 启动 Agent Team 模式，系统将自动引导完成团队组建与任务执行全流程。

## 许可

MIT
