# TipAI Agent Team — 仓库开发工作流

本文档定义如何使用 TipAI Agent Team Skill 管理本仓库（及任意项目）的日常开发。所有开发活动运行在 `/agent-team` 模式下，由层级 Agent 团队协作完成。

## 角色体系

每一次 `/agent-team` 激活会生成以下角色结构：

```
                       ┌──────────────┐
                       │   主 Agent    │
                       │  项目总监     │
                       └──────┬───────┘
          ┌───────────────────┼───────────────────┐
   ┌──────┴──────┐    ┌──────┴──────┐    ┌──────┴──────┐
   │  架构组长    │    │  功能组长    │    │  质量组长    │
   │  (Arch Lead)│    │ (Feat Lead) │    │  (QA Lead)  │
   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
    ┌─────┼─────┐      ┌─────┼─────┐      ┌─────┼─────┐
  成员1  成员2  成员3  成员4  成员5  成员6  成员7  成员8  成员9
```

| 角色 | 职责 | 直辖 |
|------|------|------|
| **主 Agent** (项目总监) | 接收需求、人物卡生成、全局决策、冲突终裁、客户汇报 | 3 位组长 |
| **架构组长** | 模块划分、接口设计、技术选型、宪章合规 | 3 名成员 |
| **功能组长** | 任务拆分、实现监督、代码审查、进度追踪 | 3 名成员 |
| **质量组长** | 测试策略、QA 验收、满意度评估、故障分类 | 3 名成员 |

## 开发任务类型

### 类型 A：Bug 修复

```
触发: "修复 xxx 问题" 或 Issue 提交
流程: 采访(确认复现路径) → 卡片(1组长+1成员) → 组队 → 下发 → 审查 → 满意度
周期: 精简模式，跳过冲突仲裁
```

### 类型 B：功能新增

```
触发: "新增 xxx 功能" 或 PR 提交
流程: 完整 14 阶段
周期: 标准模式
```

### 类型 C：重构 / 技术债

```
触发: "重构 xxx" 或 Cross-scan 触发
流程: 采访(确认范围) → 卡片 → 组队 → 下发 → 审查(重点:假实现检测) → 满意度
周期: 标准模式
```

### 类型 D：安全审计

```
触发: "安全扫描" 或定时任务
流程: 采访(确认范围) → 卡片(仅质量组) → 审查(全量扫描) → 冲突仲裁 → 档案
周期: 精简模式，跳过满意度
```

## 阶段流程

### 阶段 1：需求采访 (Interview)

主 Agent 对客户执行 5 阶段采访：

```
INIT → IMAGE → TECH_BOUNDARY → FEATURE_BREAKDOWN → CONFIRM → DONE
```

本仓库常见采访模板：

| 阶段 | 关键问题 |
|------|----------|
| INIT | 要解决什么问题？是 Bug / 新功能 / 重构？ |
| IMAGE | 期望的最终效果？影响哪些模块？ |
| TECH_BOUNDARY | 涉及的技术边界？TypeScript 严格模式限制？ |
| FEATURE_BREAKDOWN | 可拆分为几个独立任务？依赖关系？ |
| CONFIRM | 确认理解无误，生成采访摘要 |

**输出**: 采访摘要 JSON（结构化的需求理解）

### 阶段 2：人物卡生成 (Card Generation)

主 Agent 根据采访摘要 + 角色库存检索匹配，生成人物卡：

| 卡片类型 | 必含字段 |
|----------|----------|
| 组长卡 | `role`, `summary`, `must_do (≥3)`, `must_not_do (≥2)`, `tech_env`, `permission_mode` |
| 成员卡 | `role`, `summary`, `must_do (≥3)`, `must_not_do (≥2)`, `behavior_rules`, `tech_env` |

**关键规则**:
- 组长卡必须设 `permission_mode: "acceptEdits"`
- 成员卡必须包含 `behavior_rules.越界回复` 和 `behavior_rules.不确定回复`
- 全部卡片需通过 `validate_persona_card()` 校验

**库存复用**: 优先从角色库存中匹配已有卡片（命中标准：role 相似度 > 0.7），减少生成成本。

**输出**: 人物卡集合（1 主Agent + 3 组长 + 9 成员）

### 阶段 3：团队组建 (Team Assembly)

根据人物卡构建层级结构 + 通信矩阵：

```
规则:
- 主Agent → 组长: 派发阶段卡
- 组长 → 成员: 派发模块卡
- 成员 → 组长: 汇报进度
- 组长 ↔ 组长: 接口协商（不含组内评价）
- 成员 ↛ 成员(跨组): 禁止
- 成员 ↛ 主Agent: 禁止
- 主Agent ↛ 成员: 禁止
```

**输出**: `TeamStructure { lead_agent, groups: [{name, lead, members}] }`

### 阶段 4：任务下发 (Task Distribution)

| 卡片类型 | 下发者 | 接收者 | 内容 |
|----------|--------|--------|------|
| 阶段卡 (StageTaskCard) | 主Agent | 组长 | 阶段目标 + 全部模块接口面 |
| 模块卡 (ModuleTaskCard) | 组长 | 成员 | 单一模块任务 + 上下游接口 |

**上下文裁剪规则**:
- 组长接收：阶段卡 + 其他组长接口面（不含客户需求原文）
- 成员接收：模块卡 + 上下游接口签名（不含客户偏好/全局架构）

**输出**: `DispatchState { stage_cards, module_cards, dispatch_log }`

### 阶段 5：代码审查 (Code Review)

架构组长 + 功能组长交叉审查，质量组长抽检：

| 检测类型 | 标准 | 严重度 |
|----------|------|--------|
| 假实现 | `if(false)`, `while(false)`, unreachable code | CRITICAL |
| 空实现 | 函数体仅 `return null` / `return` / 注释 | HIGH |
| 无价值 | `console.log` / `pass` / 纯占位符 | MEDIUM |
| 糊弄 | TODO 占位无实现 / 硬编码占位值 | HIGH |
| 冗余代码 | 未使用的 import / 死代码 | LOW |

**定级规则**:
- 出现 CRITICAL/HIGH → 打回重做
- 连续 3 次打回 → 触发故障处理流程

**输出**: `ReviewReport { issues, grade: "pass" | "reject", suggestions }`

### 阶段 6：冲突仲裁 (Conflict Arbitration)

4 类冲突检测 + 协商 + 仲裁：

| 冲突类型 | 示例 | 协商轮次 |
|----------|------|----------|
| 接口冲突 | 组 A 导出 `{id: string}` 组 B 期望 `{id: number}` | 2 轮 |
| 实现冲突 | 两组对同一函数有不同实现 | 2 轮 |
| Schema 冲突 | 字段名/类型不一致 | 1 轮 |
| 约定冲突 | 命名风格/文件组织不一致 | 2 轮 |

**协商流程**: 检测 → 创建协商 → 记录轮次(最多 2 轮) → 超时自动升级主Agent → 仲裁

**输出**: `ArbitrationResult { conflict_type, resolution, escalated }`

### 阶段 7：满意度评估 (Satisfaction Scoring)

质量组长对每组执行四维打分（1-5 分）：

| 维度 | 权重 | 评估依据 |
|------|------|----------|
| 代码质量 | 40% | Review 通过率、假实现次数 |
| 交付速度 | 25% | 是否逾期、超时次数 |
| 协作能力 | 20% | 冲突上报率、协商效率 |
| 主动性 | 15% | 自主发现问题、主动汇报 |

**触发动作**:
- 连续 3 次 composite ≤ 2 → 建议销毁该角色
- 单次 composite ≤ 1 → 立即冻结，等待客户决定

**输出**: `SatisfactionRecord { scores, composite, signals }`

### 阶段 8：生命周期管理 (Lifecycle)

```
状态机: ACTIVE → FROZEN → DESTROYED
         ↓          ↓
      ADJUSTING  (可恢复)
```

| 事件 | 触发条件 | 动作 |
|------|----------|------|
| 冻结 | 越级通信、连续打回 3 次 | 角色暂停，产出保留 |
| 销毁 | 客户确认、满意度 ≤ 2×3 次 | 角色移除，产出归档 |
| 调整 | 技能不匹配、需求变更 | 更新人物卡，重新组队 |

**输出**: `LifecycleContext { status, trigger, history }`

### 阶段 9：角色库存 (Role Inventory)

项目结束后，角色卡片写入库存：

```
写入条件:
- 满意度 composite ≥ 3.5 → 入库(active)
- 满意度 composite < 3.5 → 不入库
- 连续2个项目 low 分 → 标记 dormant
- dormant 角色在 3 个项目后被清理
```

**检索**: `search_and_match(requirements)` → 按相似度排序，dormant 排最后

**输出**: `RoleInventory { entries, indices }`

### 阶段 10：项目档案 (Project Archive)

```
归档内容:
├── 原始需求
├── 团队结构
├── 各阶段产出
├── 冲突记录
├── 故障记录
├── 满意度汇总
├── 可复用产出
└── 库存变更

规则:
- 档案冻结后不可修改（仅追加备注）
- 客户可主动删除（二次确认）
- 保留 30 天备份恢复期
```

**输出**: `ProjectArchive` (不可变)

### 阶段 11：容错恢复 (Fault Tolerance)

| 故障级别 | 说明 | 处理 |
|----------|------|------|
| F1 自愈 | 1 次审查打回 | 成员自动重做 |
| F2 需干预 | 2 次打回/逾期 | 组长介入，调整任务 |
| F3 升级 | 3 次打回/连续逾期 | 升级主Agent，评估替换 |
| F4 灾难 | 角色不可用 | 立即替换，全组回归 |

**恢复流程**:
```
classify_fault → handle_member_fault / handle_lead_fault →
auto_recover → (升级?) replace_member / replace_lead →
record_fault → check_replacement_threshold
```

**输出**: `FaultResult { classified, recovery, replacement? }`

### 阶段 12：上下文控制 (Context Control)

三层裁剪器确保信息最小化：

| 层级 | 可见范围 |
|------|----------|
| 主Agent | 全量：所有人物卡 + 客户需求 + 全局约定 + 冲突记录 + 满意度历史 |
| 组长 | 组内全员卡 + 阶段卡 + 其他组长接口面 + 全局约定全量 |
| 成员 | 自己的人物卡 + 模块任务卡 + 上下游接口签名 + 全局约定精简版 |

**泄漏检测**: 每次通信自动执行 `run_leak_detection()`，检查是否越界传递：
- 客户需求原文 → 成员
- 组内成员评价 → 其他组长
- 内部冲突细节 → 客户汇报

**输出**: `ContextSnapshot[]` + `LeakDetection[]`

### 阶段 13：退出 (Exit)

```
退出检查清单:
□ 所有阶段卡 marked done
□ 所有审查 grade = pass
□ 冲突已解决或 recorded
□ 满意度已评估
□ 库存已更新
□ 档案已生成 + 冻结
□ 故障记录已写入
```

**输出**: `ExitConfirmation { checklist, archive_summary }`

### 阶段 14：宪章检查 (Constitution Check)

主Agent 自检每条元规则的合规性：

```
[✓] 第〇条: 无跳步骤 / 无绕行
[✓] 第一条: 无越级通信
[✓] 第二条: 所有产出有 QA 记录
[✓] 第三条: 冲突已上报 / 无隐瞒
[✓] 第四条: 上下文裁剪正确 / 无泄漏
[✓] 第五条: 客户偏好已记录 / 分数真实
[✓] 第六条: 决策链路可追溯
[✓] 第七条: 破例已记录（如有）
```

任一违规 → `halt: true`，主Agent 暂停所有工作。

## 质量门禁

```
PR 合入前必须通过:
├── TypeScript 严格检查: tsc --noEmit 零错误
├── 全部测试套件: 18/18 通过, 623/623 用例
├── 代码审查: 架构组长 + 功能组长双签
├── 敏感信息扫描: pre-commit hook 通过
├── 宪章检查: check_constitution() 返回 pass
└── 满意度: composite ≥ 3.0
```

## 敏感信息防护

每次提交前 `pre-commit` hook 自动扫描：

| 检测项 | 正则 |
|--------|------|
| GitHub Token | `ghp_[A-Za-z0-9]{36}` |
| AWS Key | `AKIA[0-9A-Z]{16}` |
| API Key (sk-) | `sk-[A-Za-z0-9_-]{20,}` |
| 私钥 | `BEGIN (RSA\|DSA\|EC\|OPENSSH) PRIVATE KEY` |
| 硬编码密码 | `password\s*[:=]\s*["'][^"']{4,}["']` |
| Slack Token | `xox[baprs]-[A-Za-z0-9-]+` |

## 使用示例

### 示例 1: 修复 Bug

```
用户: /agent-team

Agent: 已进入 Agent Team 模式，宪章已加载。
       请描述你的项目需求。

用户: 修复 satisfaction-system.ts 中 composite 计算未加权的问题

Agent: [进入采访阶段]
       Q1: 当前 composite 是如何计算的？
       Q2: 期望的加权逻辑是什么（权重配置）？
       Q3: 会影响哪些下游模块？
       ...

       [采访摘要]:
       - 问题: score_all_members 中 composite 直接取平均，未应用 4 维权重
       - 期望: composite = quality×0.4 + speed×0.25 + collaboration×0.2 + initiative×0.15
       - 影响: satisfaction-system.ts + 下游 lifecycle-manager 满意度触发

       [生成人物卡]:
       - 架构组长卡: 审查接口兼容性
       - 功能组长卡: 修复计算逻辑
       - 质量组长卡: 更新测试用例
       - 成员 1: 修改 compute_composite 函数
       - 成员 2: 更新 lifecycle 触发逻辑

       ... [后续阶段自动执行] ...
```

### 示例 2: 交叉扫描

```
用户: /agent-team
      交叉扫描 扫描深层BUG 以及逻辑问题

Agent: [采访] 扫描范围？全量/增量？重点模块？

用户: 全量扫描

Agent: [组队] 质量组长 + 3 成员，全模块覆盖
       [下发] 每成员分配 5-6 个模块的审查任务
       [审查] 逐模块检测: 假实现/空实现/死代码/逻辑漏洞
       [汇总] 产出问题清单 + 严重度分级
       [修复] 进入新的修复周期...
```

### 示例 3: 新增功能

```
用户: /agent-team
      新增 pre-push hook，在推送前做最后一道安全检查

Agent: [完整 14 阶段流程]
       [采访] → [卡片] → [组队] → [下发] → [审查] →
       [仲裁(与 pre-commit hook 的职责边界)] →
       [满意度] → ... → [宪章检查]
```

## 快捷键

| 命令 | 作用 |
|------|------|
| `/agent-team` | 启动 Agent Team 模式 |
| `交叉扫描` | 触发全量代码审查 + Bug 检测 |
| `安全扫描` | 触发敏感信息 + 安全漏洞扫描 |
| `修复` | 执行上一轮扫描产出的修复任务 |

## 归档与复盘

项目结束后：

1. **生成档案**: 完整的 `ProjectArchive`（不可变）
2. **更新库存**: 满意度 ≥ 3.5 的角色入库复用
3. **经验沉淀**: 冲突记录 + 故障记录写入全局知识库
4. **清理**: 销毁生命周期到期的角色卡片
