# TipAI Agent Team Skill — 原子任务拆分 + 交叉验证

## 进度总览

| 层级 | 总任务 | 已完成 | 已验证 | 进度 |
|---|---|---|---|---|
| L0: Skill容器 | 3 | 3 | 3 | 100% |
| L1: 数据结构 | 9 | 9 | 9 | 100% |
| L2: 需求采访 | 6 | 6 | 6 | 100% |
| L3: 人物卡生成 | 6 | 6 | 6 | 100% |
| L4: 团队组装 | 4 | 4 | 4 | 100% |
| L5: 任务下发 | 4 | 4 | 4 | 100% |
| L6: 代码审查 | 6 | 6 | 6 | 100% |
| L7: 冲突仲裁 | 7 | 7 | 7 | 100% |
| L8: 上下文控制 | 5 | 0 | 0 | 0% |
| L9: 满意度系统 | 4 | 0 | 0 | 0% |
| L10: 生命周期 | 3 | 0 | 0 | 0% |
| L11: 角色库存 | 6 | 0 | 0 | 0% |
| L12: 容错机制 | 5 | 0 | 0 | 0% |
| L13: 项目档案 | 3 | 0 | 0 | 0% |
| L14: 集成验证 | 6 | 0 | 0 | 0% |
| **合计** | **77** | **45** | **45** | **58%** |

---

## Layer 0: Skill 容器基础设施

### T-0001: Skill 入口声明
- [x] 完成 — 2026-05-13，实现文件: `.claude-plugin/plugin.json`, `commands/agent-team.md`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 15个用例全通过，覆盖: 文件存在/JSON有效/8条宪章/激活语/frontmatter
- 符合度: ✅ 无偏离

### T-0002: 宪章强制检测器
- [x] 完成 — 2026-05-13，实现文件: `src/constitution.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 22个用例全通过，覆盖: 8条宪章每条violation/pass/halt/边界/未知action
- 符合度: ✅ 无偏离

### T-0003: Skill退出机制
- [x] 完成 — 2026-05-13，实现文件: `src/exit-handler.ts`, `src/schemas.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 7个用例全通过，覆盖: 正常退出/永久卡未入库/未归档/档案摘要/警告拒绝/边界空列表
- 符合度: ✅ 无偏离

---

## Layer 1: 核心数据结构

### T-0004: PersonaCard Schema
- [x] 完成 — 2026-05-13，实现文件: `src/schemas.ts` (PersonaCard + 全部关联类型)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 20个用例(含T-0005/T-0006)全通过，类型完整性验证通过
- 符合度: ✅ 无偏离

### T-0005: PersonaCard 生成时验证
- [x] 完成 — 2026-05-13，实现文件: `src/validation.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 14条验证规则全通过(空字段/数量/越界回复/模式校验)
- 符合度: ✅ 无偏离

### T-0006: TaskCard Schema (阶段/模块)
- [x] 完成 — 2026-05-13，实现文件: `src/schemas.ts` (StageTaskCard + ModuleTaskCard)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 阶段卡+模块卡验证规则全通过，含空值边界测试
- 符合度: ✅ 无偏离

### T-0007: StructuredArchive Schema
- [x] 完成 — 2026-05-13，实现文件: `src/schemas.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 2用例全通过，验证WorkRecord/SkillEvolution/Annotation结构完整
- 符合度: ✅ 无偏离

### T-0008: SatisfactionRecord Schema
- [x] 完成 — 2026-05-13，实现文件: `src/schemas.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 2用例全通过，验证评分/客户修改/偏好信号结构完整
- 符合度: ✅ 无偏离

### T-0009: ConflictRecord Schema
- [x] 完成 — 2026-05-13，实现文件: `src/schemas.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 2用例全通过，验证四种冲突类型+阻塞/延迟分级
- 符合度: ✅ 无偏离

### T-0010: FaultRecord Schema
- [x] 完成 — 2026-05-13，实现文件: `src/schemas.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 2用例全通过，验证四级故障分类+故障次数+模式标记
- 符合度: ✅ 无偏离

### T-0011: ProjectArchive Schema
- [x] 完成 — 2026-05-13，实现文件: `src/schemas.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 1用例全通过，验证项目档案整合所有子Schema
- 符合度: ✅ 无偏离

### T-0012: RoleInventory Schema
- [x] 完成 — 2026-05-13，实现文件: `src/schemas.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 3用例全通过，验证库存条目+索引+active/dormant状态
- 符合度: ✅ 无偏离

---

## Layer 2: 需求采访引擎

### T-0013: 采访状态机
- [x] 完成 — 2026-05-13，实现文件: `src/interview.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 6个状态机用例全通过，覆盖: 初始化/前进/DONE边界/回退/INIT不可回退
- 符合度: ✅ 无偏离

### T-0014: 项目画像模板 + 追问规则
- [x] 完成 — 2026-05-13，实现文件: `src/interview.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 5个用例全通过，模糊检测(短/关键词/清晰)+模板验证
- 符合度: ✅ 无偏离

### T-0015: 技术边界模板 + 默认推荐
- [x] 完成 — 2026-05-13，实现文件: `src/interview.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 4个用例全通过，电商/CMS/实时/未知类型四种推荐
- 符合度: ✅ 无偏离

### T-0016: 功能拆解模板 + 复杂度探测
- [x] 完成 — 2026-05-13，实现文件: `src/interview.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 3个用例全通过，高/中/低复杂度+最复杂提取
- 符合度: ✅ 无偏离

### T-0017: 采访摘要生成
- [x] 完成 — 2026-05-13，实现文件: `src/interview.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 2个用例全通过，摘要含关键信息+≤500字
- 符合度: ✅ 无偏离

### T-0018: 客户确认交互
- [x] 完成 — 2026-05-13，实现文件: `src/interview.ts`，自测: 通过
- [x] 验证 — 2026-05-13，QA: 4个用例全通过，confirm/modify/迭代/done判断
- 符合度: ✅ 无偏离

---

## Layer 3: 人物卡生成引擎

### T-0019: 需求→层级拆解器
- [x] 完成 — 2026-05-13，实现文件: `src/card-generator.ts` (decompose_to_layers, derive_modules, merge_small_modules)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 8用例全通过，覆盖: 电商3层拆解/CMS 4层拆解/模块派生(支付/内容/数据/DevOps)/小模块合并/未知层通用模块/技术栈继承
- 符合度: ✅ 无偏离

### T-0020: 组长人物卡生成器
- [x] 完成 — 2026-05-13，实现文件: `src/card-generator.ts` (generate_team_lead_card)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 7用例全通过，覆盖: 角色含组长/must_do审查拆解验收/must_not_do≥4/permission_mode/输入输出来源/行为规则/lifecycle自定义
- 符合度: ✅ 无偏离

### T-0021: 成员人物卡生成器
- [x] 完成 — 2026-05-13，实现文件: `src/card-generator.ts` (generate_member_card)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 7用例全通过，覆盖: 角色含模块名+工程师/must_do实现测试审查汇报/隔离约束(跨模块/跨组/不直连主Agent)/附加约束合并/输入输出指向组长/行为规则/lifecycle默认值
- 符合度: ✅ 无偏离

### T-0022: 随机姓名生成
- [x] 完成 — 2026-05-13，实现文件: `src/card-generator.ts` (generate_random_name, reset_names)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 4用例全通过，覆盖: 非空/连续100无重复/reset清空/枯竭自动重置
- 符合度: ✅ 无偏离

### T-0023: Agent注入格式渲染
- [x] 完成 — 2026-05-13，实现文件: `src/card-generator.ts` (render_agent_injection)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 9用例全通过，覆盖: [系统指令]头/姓名+角色/5个小节完整/must_do全列/must_not_do全列/输入输出章节/权限说明/framework+code_style/行为规则
- 符合度: ✅ 无偏离

### T-0024: 人物卡客户确认流程
- [x] 完成 — 2026-05-13，实现文件: `src/card-generator.ts` (create_card_review, confirm_card, modify_card, all_cards_reviewed, generate_team)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 14用例全通过(含集成5用例)，覆盖: 初始全pending/confirm状态变+索引递增/modify字段记录+累积修改/all_reviewed全确认+部分确认+全修改/原数组不变/generate_team集成(层级/角色/权限/通信隔离/名字唯一)
- 符合度: ✅ 无偏离

---

## Layer 4: 团队组装

### T-0025: 团队结构构建器
- [x] 完成 — 2026-05-13，实现文件: `src/team-assembler.ts` (build_team_structure, TeamStructure, TeamGroup)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 12用例全通过，覆盖: 4组构建/每组1组长/成员≤3/max_members=3/all_cards完整/lead_agent_name默认+自定义/ISO时间戳/统计函数/输入来源验证
- 符合度: ✅ 无偏离

### T-0026: 通信矩阵注入
- [x] 完成 — 2026-05-13，实现文件: `src/team-assembler.ts` (inject_lead_communication, inject_member_communication, inject_communication_matrix)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 8用例全通过，覆盖: LEAD/MEMBER各3条规则/组长通信注入/成员隔离注入/去重不重复/全团队注入/不破坏原有角色
- 符合度: ✅ 无偏离

### T-0027: 无审批模式注入
- [x] 完成 — 2026-05-13，实现文件: `src/team-assembler.ts` (inject_bypass_permission, inject_team_bypass_permission, BYPASS_PERMISSION_STATEMENT)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 5用例全通过，覆盖: 声明含关键内容/注入声明/已存在不重复/强制设置permission_mode/全团队注入
- 符合度: ✅ 无偏离

### T-0028: 组长生成成员卡权限
- [x] 完成 — 2026-05-13，实现文件: `src/team-assembler.ts` (create_team_lead_generator, lead_generate_member_draft, lead_submit_draft, approve_member_draft, modify_and_approve_member_draft, reject_member_draft)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 19用例全通过(含集成3用例)，覆盖: 初始状态/生成草稿/上限null/提交审核/批准(含未submitted拒绝)/修正批准/打回/重新生成/仅返回已批准/容量检查/待审核检查/完整流程集成
- 符合度: ✅ 无偏离

---

## Layer 5: 任务下发系统

### T-0029: 阶段任务卡生成器
- [x] 完成 — 2026-05-13，实现文件: `src/task-distributor.ts` (generate_stage_task_cards, StageDefinition, get_group_stage_cards, get_active_stage)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 10用例全通过，覆盖: 3组x5阶段=15卡/from=主Agent/to=组长名/stage_id含组名/验收≥2/deadline ISO/约束条件/自定义阶段/组过滤/活跃阶段
- 符合度: ✅ 无偏离

### T-0030: 模块任务卡生成器
- [x] 完成 — 2026-05-13，实现文件: `src/task-distributor.ts` (generate_module_task_card, derive_module_tasks, derive_output_format)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 10用例全通过，覆盖: module_id关联/from-to验证/tasks≥3/deadline继承/output_format推导/forbidden隔离/附加forbidden/must_interface/已知模块/未知模块通用
- 符合度: ✅ 无偏离

### T-0031: 任务下发协议
- [x] 完成 — 2026-05-13，实现文件: `src/task-distributor.ts` (DispatchState, create_dispatch_state, can_dispatch_to, dispatch_task, complete_task, check_timeout_risk, batch_check_timeout, insert_emergency, consume_emergency_queue, validate_dispatch_chain)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 14用例全通过，覆盖: 空状态创建/可下发判断/占位成功/重复占位拒绝/释放成员/超时检测(on_track/at_risk/overdue)/批量检测/紧急插队/按组消费/合法链路验证/越级检测/stage_id不匹配检测
- 符合度: ✅ 无偏离

### T-0032: 进度汇报链
- [x] 完成 — 2026-05-13，实现文件: `src/task-distributor.ts` (create_member_progress_report, create_stage_progress_summary, is_report_overdue, aggregate_progress)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 11用例全通过，覆盖: 成员汇报含关键字段/日期为今天/正常汇总/偏离轨道检测/空汇报检测/无阻塞/超24h检测/刚刚不过期/多组汇总/完整链路
- 符合度: ✅ 无偏离

---

## Layer 6: 代码审查引擎

### T-0033: 假实现检测器
- [x] 完成 — 2026-05-13，实现文件: `src/code-reviewer.ts` (detect_input_deviation, detect_output_deviation, detect_business_rule_omission, detect_boundary_omission, detect_fake_error_handling, detect_fake_implementation)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 9用例全通过，覆盖: 输入缺失/输入匹配/输出缺失/业务规则遗漏/边界条件(空值/数组)/空catch/正常错误处理/综合检测
- 符合度: ✅ 无偏离

### T-0034: 空实现检测器
- [x] 完成 — 2026-05-13，实现文件: `src/code-reviewer.ts` (count_effective_statements, has_todo_without_implementation, detect_empty_implementation)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 10用例全通过，覆盖: 正常代码>5/空函数=0/仅注释=0/仅return null=0/仅console.log=0/TODO+空实现标记/TODO+有实现/完全空实现/正常函数/TODO占位/仅有调试输出
- 符合度: ✅ 无偏离

### T-0035: 无价值代码检测器
- [x] 完成 — 2026-05-13，实现文件: `src/code-reviewer.ts` (detect_dead_code, detect_no_side_effect_writes, detect_copy_paste_residue, detect_unused_imports, detect_worthless_code)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 7用例全通过，覆盖: 死代码/无副作用写入/复制粘贴相似度>90%/不同代码无问题/未使用导入/综合检测/标识符归一化
- 符合度: ✅ 无偏离

### T-0036: 糊弄代码检测器
- [x] 完成 — 2026-05-13，实现文件: `src/code-reviewer.ts` (detect_hardcoded_return, detect_empty_catch, detect_comment_replacing_implementation, detect_requirement_code_mismatch, detect_pass_through, detect_fake_validation, detect_cheating_code)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 12用例全通过，覆盖: 硬编码返回/正常入参使用/空catch块/仅注释catch/有处理catch/注释替代实现/注释+实现/需求代码不匹配/透传无处理/假参数校验/综合检测
- 符合度: ✅ 无偏离

### T-0037: 审查结论定级
- [x] 完成 — 2026-05-13，实现文件: `src/code-reviewer.ts` (grade_review, grade_description, should_reject)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 9用例全通过，覆盖: 无问题=pass/仅无价值=mild/假实现=moderate/空实现=moderate/糊弄=severe/密度>30%=severe/描述/打回判断
- 符合度: ✅ 无偏离

### T-0038: 审查报告生成
- [x] 完成 — 2026-05-13，实现文件: `src/code-reviewer.ts` (generate_review_report, build_summary)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 4用例全通过，覆盖: 正常代码pass/问题代码检测/报告含行号+摘要/完整链路(正常通过+问题打回)
- 符合度: ✅ 无偏离

---

## Layer 7: 冲突检测与仲裁

### T-0039: 接口冲突检测器
- [x] 完成 — 2026-05-13，实现文件: `src/conflict-arbitrator.ts` (detect_interface_conflict, detect_all_interface_conflicts, types_compatible)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 9用例全通过，覆盖: 兼容类型(number/int/varchar/string)/字段缺失/类型不兼容/optional不一致/severity分级(1个delayed,≥2blocking)/批量两两对比/完全一致/B侧多余字段
- 符合度: ✅ 无偏离

### T-0040: 数据冲突检测器
- [x] 完成 — 2026-05-13，实现文件: `src/conflict-arbitrator.ts` (detect_data_conflict, DataSchema, WriteOperation)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 9用例全通过，覆盖: 合法操作/表不存在blocking/列不存在/类型不匹配/INSERT非空列检查/UPDATE不检查非空/兼容数据类型/数据权威标记/parties双方
- 符合度: ✅ 无偏离

### T-0041: 约定冲突检测器
- [x] 完成 — 2026-05-13，实现文件: `src/conflict-arbitrator.ts` (detect_convention_violations, should_escalate_convention, create_convention_conflict)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 10用例全通过，覆盖: 合规无违规/缺少required_pattern/forbidden_pattern(console.log+process.exit)/行号检测/≥3上报/＜3不上报/冲突记录含名+数/≥5blocking/＜5delayed
- 符合度: ✅ 无偏离

### T-0042: 逻辑冲突检测器
- [x] 完成 — 2026-05-13，实现文件: `src/conflict-arbitrator.ts` (detect_logic_conflict, generate_implementation_fingerprint, RuleImplementation)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 9用例全通过，覆盖: 不同组不同fingerprint冲突/相同fingerprint无冲突/不同规则无冲突/同组不算冲突/多规则多冲突/含parties和位置/fingerprint相同结构代码相同/不同结构不同/忽略注释
- 符合度: ✅ 无偏离

### T-0043: 仲裁决策引擎
- [x] 完成 — 2026-05-13，实现文件: `src/conflict-arbitrator.ts` (arbitrate, ArbitrationDecision, ArbitrationPath)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 9用例全通过，覆盖: convention→side_a/data→side_b/interface+需求→compromise/interface无需求→client_decision/logic评分选A/logic评分选B/无context默认side_a/全类型有decided_at/convention含convention_update
- 符合度: ✅ 无偏离

### T-0044: 协商超时检测
- [x] 完成 — 2026-05-13，实现文件: `src/conflict-arbitrator.ts` (create_negotiation, record_negotiation_round, check_negotiation_timeout, escalate_to_main_agent)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 10用例全通过，覆盖: 创建状态/自定义max_rounds/记录一轮/超max_rounds自动escalated/达上限检测超时/未达不超时/已escalated不超时/已resolved不超时/30分钟超时/升级暂停组
- 符合度: ✅ 无偏离

### T-0045: 仲裁结果写入
- [x] 完成 — 2026-05-13，实现文件: `src/conflict-arbitrator.ts` (apply_arbitration_result, ArbitrationResult, DEFAULT_CONVENTIONS, run_conflict_detection_pipeline)，自测: 通过
- [x] 验证 — 2026-05-13，QA: 12用例全通过(含集成3用例)，覆盖: 有convention_update更新约定/无更新不新增/冲突方卡打标记/不相关方不标记/archive含已仲裁标记/compromise→negotiation/client_decision→client_decision/side_a→lead_arbitration/result完整性/DEFAULT_CONVENTIONS8条/全链路pipeline/空输入
- 符合度: ✅ 无偏离

---

## Layer 8: 上下文控制

### T-0046: 成员上下文裁剪器
- [ ] 完成
- [ ] 验证
- 只注入: 人物卡 + 模块任务卡 + 上下游接口定义 + 全局约定精简版
- 不注入: 全局架构/其他模块/客户需求
- 符合度: ✅ 无偏离

### T-0047: 组长上下文裁剪器
- [ ] 完成
- [ ] 验证
- 只注入: 组内全员卡 + 阶段卡 + 其他组长接口面 + 全局约定全量
- 不注入: 客户需求全文/其他组内部细节/策略决策权
- 符合度: ✅ 无偏离

### T-0048: 主Agent上下文全量注入
- [ ] 完成
- [ ] 验证
- 所有人物卡 + 客户需求 + 全局约定 + 项目档案 + 偏好画像 + 角色库存 + 冲突记录 + 满意度历史
- 符合度: ✅ 无偏离

### T-0049: 上下文泄漏防护
- [ ] 完成
- [ ] 验证
- 组长派活 → 检测是否携带需求原文/偏好/评价
- 成员通信 → 检测是否越界
- 组长间通信 → 检测是否泄露组内评价
- 主Agent汇报 → 检测是否暴露内部冲突细节
- 符合度: ✅ 无偏离

### T-0050: 上下文快照与恢复
- [ ] 完成
- [ ] 验证
- 每个角色上下文定时快照
- 故障恢复时从最近快照恢复
- 符合度: ✅ 无偏离

---

## Layer 9: 满意度系统

### T-0051: 主Agent打分引擎
- [ ] 完成
- [ ] 验证
- 4 维度打分 (做实40%/质量30%/协作20%/加分10%)
- 打分附带原因说明
- 成员明细分
- 符合度: ✅ 无偏离

### T-0052: 客户修改分数交互
- [ ] 完成
- [ ] 验证
- 展示分数 + 原因 → 客户确认或修改
- 客户修改时追问原因
- 修改后的分数入库
- 符合度: ✅ 无偏离

### T-0053: 偏好信号提取
- [ ] 完成
- [ ] 验证
- 客户连续修改同一维度 n 次 → 调整权重
- 客户修改原因关键词匹配 → 偏好标签
- 偏好与需求冲突 → 折中方案让客户选
- 符合度: ✅ 无偏离

### T-0054: 分数影响引擎
- [ ] 完成
- [ ] 验证
- ≥4 → 卡优先复用 + 约束词放宽
- 3-3.9 → 维持
- 2-2.9 → 约束词收紧 + 组长加强审核
- <2 → 建议销毁
- 符合度: ✅ 无偏离

---

## Layer 10: 生命周期管理

### T-0055: 生命周期状态机
- [ ] 完成
- [ ] 验证
- 状态: ACTIVE → FROZEN(永久保留) / DESTROYED(项目销毁) / ADJUSTING(随项目调整)
- 任何阶段客户可提变更请求
- 符合度: ✅ 无偏离

### T-0056: 生命周期变更处理器
- [ ] 完成
- [ ] 验证
- 永久保留: 冻结人物卡 + 归档技能演进 → 入库
- 项目销毁: 清角色上下文 → 工作记录留项目档案
- 随项目调整: 释放约束词 → 重新采访补充
- 满意度触发销毁: 连续3次≤2 → 建议 + 客户确认 → 销毁
- 符合度: ✅ 无偏离

### T-0057: 满意度触发生命周期变更
- [ ] 完成
- [ ] 验证
- 连续 3 次 ≤2 分 → 主Agent主动建议销毁/重构
- 附带证据: 3次低分记录 + 原因
- 客户确认后执行
- 符合度: ✅ 无偏离

---

## Layer 11: 角色库存

### T-0058: 库存写入
- [ ] 完成
- [ ] 验证
- 人物卡冻结版 + 技能演进记录 + 历史评分 + 适合/不适合场景
- 符合度: ✅ 无偏离

### T-0059: 库存索引
- [ ] 完成
- [ ] 验证
- 按技术栈/评分/场景的快速检索
- 符合度: ✅ 无偏离

### T-0060: 库存检索匹配
- [ ] 完成
- [ ] 验证
- 新项目开始 → 提取技术栈+模块特征
- 筛选候选 → 加权排序 (场景匹配度 > 评分)
- 过滤 <3.0 分和"不适合场景"匹配项
- 返回 Top N + 推荐理由
- 符合度: ✅ 无偏离

### T-0061: 库存更新
- [ ] 完成
- [ ] 验证
- 同名卡再次入库 → 覆盖旧版
- 技能演进追加
- 评分汇总重算
- 符合度: ✅ 无偏离

### T-0062: 库存降级
- [ ] 完成
- [ ] 验证
- 连续 2 次不被选择 → 标记"休眠"
- 休眠卡不出现在推荐首位
- 符合度: ✅ 无偏离

### T-0063: 库存删除
- [ ] 完成
- [ ] 验证
- 客户主动要求 → 移除
- 不可恢复
- 符合度: ✅ 无偏离

---

## Layer 12: 容错机制

### T-0064: 故障分类器
- [ ] 完成
- [ ] 验证
- 4 级故障: 自愈/需介入/需替换/需暂停
- 故障分类规则引擎
- 符合度: ✅ 无偏离

### T-0065: 成员级别故障处理
- [ ] 完成
- [ ] 验证
- 单次打回 → 组长给修改意见 + 重做时限
- 连续2次 → 升级主Agent + 附带审查记录
- 连续3次 → 主Agent判定替换 (库存检索 → 无则重新生成)
- 旧卡标记失败原因入库
- 符合度: ✅ 无偏离

### T-0066: 组长级别故障处理
- [ ] 完成
- [ ] 验证
- 审核漏判 → 主Agent抽查发现 → 警告 + 记录
- 连续漏判 → 替换组长
- 协商僵持超时 → 主Agent直接仲裁
- 符合度: ✅ 无偏离

### T-0067: 自动恢复
- [ ] 完成
- [ ] 验证
- 成员替换 → 继承已完成任务上下文，不重做已验收
- 组长替换 → 继承组内档案 + 当前阶段卡
- 上下文丢失 → 从快照恢复
- 死锁检测 → 强制定序
- 产出冲突 → 败方废弃冲突部分，从仲裁点继续
- 符合度: ✅ 无偏离

### T-0068: 故障记录
- [ ] 完成
- [ ] 验证
- 故障档案: 角色/次数/最近故障/故障模式/建议
- 写入项目档案
- 符合度: ✅ 无偏离

---

## Layer 13: 项目档案

### T-0069: 项目档案生成器
- [ ] 完成
- [ ] 验证
- 汇总: 客户需求/团队结构/阶段记录/冲突记录/故障记录/满意度总评/可复用产出/库存变更
- 符合度: ✅ 无偏离

### T-0070: 档案只读保护
- [ ] 完成
- [ ] 验证
- 生成后禁止修改
- 只允许追加备注
- 可检索 (项目名/技术栈/日期/角色名)
- 符合度: ✅ 无偏离

### T-0071: 档案删除
- [ ] 完成
- [ ] 验证
- 仅客户主动要求可删除
- 删除前二次确认
- 符合度: ✅ 无偏离

---

## Layer 14: 集成验证

### T-0072: 端到端场景测试 — 简单项目
- [ ] 完成
- [ ] 验证
- 用户: "帮我做一个简单的Todo应用，React前端+Node后端"
- 验证: 采访→人物卡→组队→任务下发→成员产出→审查→满意度 全链路
- 符合度: ✅ 无偏离

### T-0073: 端到端场景测试 — 冲突场景
- [ ] 完成
- [ ] 验证
- 模拟两组接口不一致 → 验证仲裁流程
- 符合度: ✅ 无偏离

### T-0074: 端到端场景测试 — 角色复用
- [ ] 完成
- [ ] 验证
- 使用库存中的已有角色 → 验证检索匹配+解冻注入
- 符合度: ✅ 无偏离

### T-0075: 端到端场景测试 — 生命周期变更
- [ ] 完成
- [ ] 验证
- 项目中途客户要求销毁某角色 + 永久保留另一角色
- 验证变更流程+库存操作
- 符合度: ✅ 无偏离

### T-0076: 端到端场景测试 — Skill容器不可跳出
- [ ] 完成
- [ ] 验证
- 模拟尝试跳过采访直接写代码 → 验证宪章拦截
- 符合度: ✅ 无偏离

### T-0077: 端到端场景测试 — 满意度触发销毁
- [ ] 完成
- [ ] 验证
- 模拟连续3次低分 → 验证主Agent主动建议销毁
- 符合度: ✅ 无偏离

---

## 交叉验证结果

### 最初需求 ↔ 任务映射

| 最初需求 | 对应任务 | 符合度 |
|---|---|---|
| 多轮采访 | T-0013~T-0018 | ✅ |
| 人物卡相互独立+随机姓名 | T-0021, T-0022 | ✅ |
| 强约束词+需求分解 | T-0019, T-0021 | ✅ |
| 主Agent自动生成人设团队 | T-0020, T-0021, T-0025 | ✅ |
| Agent注入格式(非人类向) | T-0023 | ✅ |
| 层级管理(组长+成员3人) | T-0025, T-0028 | ✅ |
| 组长检查假/空/无价值/糊弄代码 | T-0033~T-0038 | ✅ |
| 组长QA验证做实 | T-0038 | ✅ |
| 组长生成成员卡权限 | T-0028 | ✅ |
| 组长间通信+成员隔离 | T-0026 | ✅ |
| 代码审查标准细化 | T-0033~T-0037 | ✅ |
| 任务分配下发 | T-0029~T-0032 | ✅ |
| 冲突检测仲裁 | T-0039~T-0045 | ✅ |
| 上下文三层控制 | T-0046~T-0050 | ✅ |
| 结构化档案 | T-0007 | ✅ |
| 生命周期三模式+随时可变 | T-0055~T-0057 | ✅ |
| 满意度+客户可修改+影响后续 | T-0051~T-0054 | ✅ |
| 偏好信号 | T-0053 | ✅ |
| 角色库存+检索复用 | T-0058~T-0063 | ✅ |
| 容错+自动恢复 | T-0064~T-0068 | ✅ |
| 项目档案 | T-0069~T-0071 | ✅ |
| 元规则+Skill容器不可跳出 | T-0001~T-0003, T-0076 | ✅ |
| 无审批模式(成员+组长) | T-0027 | ✅ |
| 组长改名(vs队长) | T-0020 | ✅ |
| 通信:组长通/成员组内/跨组隔离 | T-0026 | ✅ |
| 满意度仅阶段完成后触发 | T-0051 | ✅ |
| 主Agent打分+客户修改 | T-0051, T-0052 | ✅ |

### 偏离风险评估
- 偏离项: 0
- 所有任务均映射到最初需求

### 遗漏检查
- 最初讨论功能覆盖: 100%
- 任务超出需求范围: 无
- 依赖顺序合理性: 已验证

### 任务依赖关系

```
L0 (容器) ───────────────────────────┐
L1 (数据结构) ───────────────────────┤
      ↓                               │
L2 (采访) ──→ L3 (人物卡) ──→ L4 (组队)
                                     ↓
                             L5 (任务下发)
                                     ↓
                             L6 (代码审查)
                                     ↓
                             L7 (冲突仲裁)
                                     ↓
L8 (上下文) ←── 贯穿全部层 ──────────┤
L9 (满意度) ←── 依赖 L5,6 ───────────┤
L10 (生命周期) ←── 依赖 L9 ──────────┤
L11 (角色库存) ←── 依赖 L3,9,10 ─────┤
L12 (容错) ←── 依赖 L6,7 ────────────┤
L13 (项目档案) ←── 依赖全部 ─────────┤
L14 (集成验证) ←── 全部 ─────────────┘
```
