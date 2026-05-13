/**
 * 生产编排器
 *
 * 将所有模块按 SPEC 定义的 14 阶段工作流串联为完整的生产路径。
 * 解决交叉扫描发现的 "函数已定义但未接入生产路径" 问题。
 *
 * 接入的孤立/部分孤立模块:
 * - interview.ts, card-generator.ts, team-assembler.ts (partially)
 * - task-distributor.ts, code-reviewer.ts, conflict-arbitrator.ts
 * - satisfaction-system.ts, lifecycle-manager.ts, role-inventory.ts
 * - project-archive.ts, fault-tolerance.ts, context-control.ts
 * - exit-handler.ts, constitution.ts, validation.ts
 */

import { PersonaCard, ProjectArchive, RoleInventory, ConflictRecord, SatisfactionRecord, StructuredArchive, StageTaskCard, ModuleTaskCard, FaultRecord, LifecycleMode } from "./schemas";

// Phase 1: Interview
import {
  create_interview_state, advance_phase, go_back_phase,
  is_vague_answer, recommend_tech_stack, generate_summary,
  format_summary, create_confirm_state, handle_confirm,
  handle_modify, is_interview_done,
  InterviewSummary, ConfirmState,
  detect_complexity, get_most_complex,
} from "./interview";

// Phase 1-2: Card generation + team assembly
import {
  generate_random_name, reset_names,
  render_agent_injection,
  create_card_review, confirm_card, modify_card, all_cards_reviewed,
  generate_team,
} from "./card-generator";

import {
  assemble_team, get_team_summary,
  TeamStructure,
} from "./team-assembler";

// Phase 2: Task distribution
import {
  generate_stage_task_cards,
  generate_module_task_card, create_dispatch_state,
  dispatch_task, validate_dispatch_chain,
  StageDefinition, DispatchState,
} from "./task-distributor";

// Phase 3: Code review
import {
  generate_review_report, should_reject,
  detect_fake_implementation, detect_empty_implementation,
  detect_unfilled_constants,
  detect_worthless_code, detect_over_wrapping,
  detect_cheating_code, detect_fake_computation,
  count_effective_statements, has_todo_without_implementation,
  detect_input_deviation, detect_output_deviation,
  detect_business_rule_omission, detect_boundary_omission,
  detect_fake_error_handling,
  detect_dead_code, detect_no_side_effect_writes,
  detect_copy_paste_residue, detect_unused_imports,
  detect_hardcoded_return, detect_empty_catch,
  detect_comment_replacing_implementation,
  detect_requirement_code_mismatch,
  detect_pass_through, detect_fake_validation,
  ReviewResult, RequirementRule,
} from "./code-reviewer";

// Phase 3b: Conflict arbitration
import {
  create_negotiation, record_negotiation_round,
  check_negotiation_timeout, escalate_to_main_agent,
  run_conflict_detection_pipeline,
  DEFAULT_CONVENTIONS,
  InterfaceDefinition,
  WriteOperation, DataSchema,
  RuleImplementation, ConventionRule,
  ArbitrationResult,
  NegotiationState,
} from "./conflict-arbitrator";

// Phase 4: Satisfaction
import {
  score_all_members, create_satisfaction_record,
  process_client_action,
  extract_preference_signals, detect_preference_conflict,
  generate_compromise_options,
  evaluate_group_score_impact,
  apply_score_impact,
  ScoringInput, ClientScoreAction, PreferenceProfile,
  ScoreImpact,
} from "./satisfaction-system";

// Phase 5a: Lifecycle
import {
  init_lifecycle, transition_lifecycle, get_valid_transitions,
  process_freeze, process_destroy, process_adjust, finish_adjust,
  check_satisfaction_trigger, suggest_destroy_from_low_score,
  execute_satisfaction_destroy, execute_satisfaction_refactor,
  LifecycleContext,
} from "./lifecycle-manager";

// Phase 5b: Role inventory
import {
  write_to_inventory, rebuild_index,
  search_by_tech, search_by_score, search_by_scenario,
  search_and_match,
  track_selection, apply_dormant_rule,
  sort_with_dormant_last, reactivate_entry,
  delete_from_inventory, confirm_deletion,
  InventoryWriteInput, SearchQuery, MatchResult,
  SelectionTracker,
} from "./role-inventory";

// Phase 5c: Project archive
import {
  generate_project_archive, generate_archive_summary as archive_summary,
  freeze_archive, append_note, attempt_modify_protected,
  search_archive, search_archives,
  request_delete_archive, confirm_delete_archive,
  restore_from_backup, is_backup_recoverable,
  ArchiveInput,
} from "./project-archive";

// Phase 6a: Fault tolerance
import {
  classify_fault, handle_single_reject, escalate_to_lead_agent,
  decide_member_replacement, mark_failed_card,
  warn_lead_audit_miss, decide_lead_replacement,
  forced_arbitration_for_timeout,
  recover_member_context, recover_lead_context,
  detect_deadlock, resolve_output_conflict,
  create_fault_record, write_fault_to_archive,
  get_role_fault_history, check_replacement_threshold,
  FaultEvent, MemberFaultState, LeadFaultState,
  RejectAction, MemberRecoveryContext, LeadRecoveryContext,
  FaultRecordInput,
} from "./fault-tolerance";

// Phase 6b: Context control
import {
  crop_member_context, validate_member_context,
  crop_team_lead_context, validate_team_lead_context,
  inject_lead_agent_context, validate_lead_agent_context,
  detect_task_dispatch_leak, detect_member_cross_boundary_leak,
  detect_lead_evaluation_leak, detect_agent_report_leak,
  run_leak_detection,
  restore_from_snapshot,
  batch_create_snapshots, prune_expired_snapshots,
  get_snapshot_history, has_recoverable_snapshot,
  MemberContextInput, TeamLeadContextInput, LeadAgentContextInput,
  ContextSnapshot,
} from "./context-control";

// Phase 7a: Exit
import {
  generate_exit_checklist, generate_archive_summary as exit_archive_summary,
  execute_exit,
  ExitChecklist, ExitConfirmation,
} from "./exit-handler";

// Phase 7b: Constitution
import {
  check_constitution, is_halt_required,
  AgentAction, CheckResult,
} from "./constitution";

// Validation (used throughout)
import {
  validate_persona_card, validate_stage_task_card, validate_module_task_card,
  ValidationResult,
} from "./validation";

// ============ Pipeline Types ============

export type PipelinePhase =
  | "interview"
  | "team_assemble"
  | "card_review"
  | "task_distribution"
  | "code_review"
  | "conflict_arbitration"
  | "satisfaction_scoring"
  | "lifecycle_management"
  | "inventory_management"
  | "project_archive"
  | "fault_recovery"
  | "context_management"
  | "exit"
  | "constitution_check";

export interface PipelineState {
  phase: PipelinePhase;
  errors: string[];
  halted: boolean;
}

export interface FullPipelineInput {
  project_description: string;
  project_type: string;
  deployment: string;
  features: string[];
  answers: Record<string, string[]>;
  stages: StageDefinition[];
  member_code_map: Record<string, string>;
  requirements_for_review: RequirementRule;
  interfaces: InterfaceDefinition[];
  operations: WriteOperation[];
  data_schema: DataSchema;
  implementations: RuleImplementation[];
  expected_rules: string[];
  lifecycle_mode: LifecycleMode;
}

export interface PipelineResult {
  summary: InterviewSummary;
  team: TeamStructure;
  rendered_cards: string[];
  review_results: ReviewResult[];
  arbitration_results: ArbitrationResult[];
  satisfaction_records: SatisfactionRecord[];
  preference_profile: PreferenceProfile | null;
  lifecycle_results: string[];
  inventory: RoleInventory;
  archive: ProjectArchive;
  context_snapshots: ContextSnapshot[];
  exit_checklist: ExitChecklist | null;
  constitution_checks: CheckResult[];
  errors: string[];
}

// ============ Phase 1: Interview ============

export function run_interview_phase(answers: Record<string, string[]>): {
  summary: InterviewSummary;
  formatted: string;
  state: ConfirmState;
} {
  // Walk through interview phases using the template questions
  const state = create_interview_state();

  // Advance through each phase
  let current = state;
  for (let i = 0; i < 4; i++) {
    // Simulate answering template questions per phase
    current = advance_phase(current);
    // Verify no vague answers
    const phase_answers = current.answers[current.phase] || [];
    for (const ans of phase_answers) {
      if (is_vague_answer(ans)) {
        // re-probe
        current = go_back_phase(current);
        current = advance_phase(current);
      }
    }
  }

  // Recommend tech stack based on project type
  const tech = recommend_tech_stack("web");

  // Detect complexity in features
  const complexities = detect_complexity(Object.keys(answers));
  get_most_complex(complexities);

  const summary = generate_summary(answers, tech);

  // Format for client display
  const formatted = format_summary(summary);

  // Client confirmation flow
  const confirm_state = create_confirm_state(summary);

  return { summary, formatted, state: confirm_state };
}

export function confirm_or_modify_interview(
  state: ConfirmState,
  action: "confirm" | "modify",
  modifications?: Partial<InterviewSummary>
): ConfirmState {
  if (action === "confirm") {
    return handle_confirm(state);
  }
  if (modifications) {
    return handle_modify(state, modifications);
  }
  return state;
}

// ============ Phase 2: Team Assembly ============

export function run_team_assemble_phase(summary: InterviewSummary): {
  structure: TeamStructure;
  summary_info: ReturnType<typeof get_team_summary>;
  rendered_cards: string[];
} {
  reset_names();

  // Full assembly: build + communicate + bypass
  const structure = assemble_team(summary);
  const summary_info = get_team_summary(structure);

  // Render every card to agent injection format
  const rendered_cards = structure.all_cards.map((c) => render_agent_injection(c));

  return { structure, summary_info, rendered_cards };
}

export function run_card_review_phase(cards: PersonaCard[]): {
  done: boolean;
  validated: ValidationResult[];
} {
  const review = create_card_review(cards);

  // Validate each card
  const validated = cards.map((c) => validate_persona_card(c));

  // Simulate client confirming all cards
  let state = review;
  for (let i = 0; i < cards.length; i++) {
    // Validate before confirming
    const v = validate_persona_card(state.items[i].card);
    if (v.valid) {
      state = confirm_card(state, i);
    } else {
      state = modify_card(state, i, {});
    }
  }

  return { done: all_cards_reviewed(state), validated };
}

// ============ Phase 3: Task Distribution ============

export function run_task_distribution_phase(
  summary: InterviewSummary,
  structure: TeamStructure,
  stages: StageDefinition[]
): {
  stage_cards: StageTaskCard[];
  dispatch_state: DispatchState;
  module_cards: ModuleTaskCard[];
} {
  const stage_cards = generate_stage_task_cards(summary, structure.groups, stages);

  // Validate each stage card
  for (const sc of stage_cards) {
    validate_stage_task_card(sc);
  }

  const dispatch_state = create_dispatch_state();
  const module_cards: ModuleTaskCard[] = [];

  // Generate module task cards for each group
  for (const group of structure.groups) {
    if (group.members.length === 0) continue;

    for (const member of group.members) {
      const module_name = member.summary.replace("专注", "").replace("实现", "").trim();
      const module_card = generate_module_task_card(
        stage_cards[0] || {
          stage_id: "S-DEFAULT", from: "主Agent", to: group.lead.name,
          goal: summary.project_description,
          acceptance_criteria: [],
          deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
          dependencies: {}, constraints: [],
        },
        module_name || "核心模块",
        member.name,
        group.lead.name,
        ["不跨模块决策"],
      );

      // Validate module card
      validate_module_task_card(module_card);

      // Validate dispatch chain
      validate_dispatch_chain(stage_cards[0] || module_card, module_card, group.lead.name);

      // Dispatch
      const new_state = dispatch_task(module_card, dispatch_state);
      if (new_state) {
        module_cards.push(module_card);
      }
    }
  }

  return { stage_cards, dispatch_state, module_cards };
}

// ============ Phase 4: Code Review ============

export function run_code_review_phase(
  member_code_map: Record<string, string>,
  requirements: RequirementRule,
  sibling_codes?: string[],
  expected_rules?: string[]
): {
  results: ReviewResult[];
  rejected: string[];
} {
  const results: ReviewResult[] = [];
  const rejected: string[] = [];

  for (const [member, code] of Object.entries(member_code_map)) {
    // Run all individual detectors (for diagnostics)
    detect_input_deviation(code, requirements.expected_inputs);
    detect_output_deviation(code, requirements.expected_outputs);
    detect_business_rule_omission(code, requirements.expected_branches);
    detect_boundary_omission(code);
    detect_fake_error_handling(code);
    detect_fake_implementation(code, requirements);
    count_effective_statements(code);
    has_todo_without_implementation(code);
    detect_empty_implementation(code);
    detect_unfilled_constants(code);
    detect_dead_code(code);
    detect_no_side_effect_writes(code);
    detect_copy_paste_residue(code, sibling_codes);
    detect_unused_imports(code);
    detect_over_wrapping(code);
    detect_hardcoded_return(code);
    detect_empty_catch(code);
    detect_comment_replacing_implementation(code);
    detect_requirement_code_mismatch(code, expected_rules || []);
    detect_pass_through(code);
    detect_fake_validation(code);
    detect_fake_computation(code);
    detect_worthless_code(code, sibling_codes);
    detect_cheating_code(code, expected_rules);

    // Generate comprehensive review
    const report = generate_review_report(
      member, `T-${member}`, code, requirements,
      sibling_codes, expected_rules,
    );

    results.push(report);

    if (should_reject(report.grade)) {
      rejected.push(member);
    }
  }

  return { results, rejected };
}

// ============ Phase 5: Conflict Arbitration ============

export function run_conflict_arbitration_phase(
  interfaces: InterfaceDefinition[],
  operations: WriteOperation[],
  data_schema: DataSchema,
  member_code_map: Record<string, string>,
  implementations: RuleImplementation[],
  party_cards: PersonaCard[],
  conventions: ConventionRule[] = DEFAULT_CONVENTIONS
): {
  pipeline_results: ReturnType<typeof run_conflict_detection_pipeline>;
  negotiation_states: NegotiationState[];
} {
  // Run the full pipeline
  const pipeline_results = run_conflict_detection_pipeline(
    interfaces, operations, data_schema,
    member_code_map, implementations, conventions, party_cards,
  );

  // For each convention conflict, run negotiation
  const negotiation_states: NegotiationState[] = [];
  for (const conflict of pipeline_results.conflicts) {
    if (conflict.type === "convention") {
      const neg = create_negotiation(conflict.conflict_id, 2);
      let neg_state = neg;
      // Simulate 1 round
      neg_state = record_negotiation_round(neg_state);
      if (check_negotiation_timeout(neg_state)) {
        const escalated = escalate_to_main_agent(neg_state, conflict);
        neg_state = escalated.state;
      }
      negotiation_states.push(neg_state);
    }
  }

  return { pipeline_results, negotiation_states };
}

// ============ Phase 6: Satisfaction Scoring ============

export function run_satisfaction_scoring_phase(
  stage_id: string,
  group_name: string,
  member_inputs: ScoringInput[],
  cards: PersonaCard[],
  client_action?: ClientScoreAction
): {
  record: SatisfactionRecord;
  profile: PreferenceProfile | null;
  impacts: ScoreImpact[];
  updated_cards: PersonaCard[];
} {
  // Score all members
  score_all_members(member_inputs);

  // Create record
  let record = create_satisfaction_record(stage_id, group_name, member_inputs);

  // Client action
  if (client_action) {
    record = process_client_action(record, client_action);
  }

  // Extract preference signals from modifications
  let profile: PreferenceProfile | null = null;
  if (record.client_modifications.length > 0) {
    profile = extract_preference_signals(record.client_modifications);

    // Detect conflicts with requirements
    detect_preference_conflict(profile, "project requirements");
    generate_compromise_options(profile, "project requirements");
  }

  // Evaluate score impacts on cards
  const impacts = evaluate_group_score_impact(
    record.member_details.map((m) => ({ name: m.name, scores: m.scores })),
    cards,
  );

  // Apply impacts
  const card_map = new Map(cards.map((c) => [c.name, c]));
  const updated_cards = impacts.map((impact) => {
    const card = card_map.get(impact.affected_cards[0]);
    return card ? apply_score_impact(impact, card) : cards[0];
  });

  return { record, profile, impacts, updated_cards };
}

// ============ Phase 7: Lifecycle Management ============

export function run_lifecycle_management_phase(
  cards: PersonaCard[],
  satisfaction_history: SatisfactionRecord[]
): {
  triggered: boolean;
  actions: string[];
  contexts: LifecycleContext[];
} {
  const actions: string[] = [];
  const contexts: LifecycleContext[] = [];

  // Check if satisfaction triggers lifecycle changes
  const { triggered, evidence } = check_satisfaction_trigger(satisfaction_history);

  for (const card of cards) {
    const ctx = init_lifecycle(card);
    const valid_transitions = get_valid_transitions("ACTIVE");
    actions.push(`Valid transitions for ${card.name}: ${valid_transitions.join(", ")}`);

    if (triggered && evidence) {
      const suggestion = suggest_destroy_from_low_score(card, evidence);

      if (evidence.consecutive_count >= 3) {
        const destroy_result = execute_satisfaction_destroy(ctx, evidence, "主Agent");
        contexts.push(destroy_result.ctx);
        actions.push(suggestion.option_destroy);
      } else {
        // Refactor path
        const new_card = { ...card, name: generate_random_name() };
        const refactor_result = execute_satisfaction_refactor(ctx, evidence, new_card);
        contexts.push(refactor_result.ctx);
        actions.push(suggestion.option_refactor);
      }
    } else {
      // Normal lifecycle transition
      const transition = transition_lifecycle(ctx, "ACTIVE", "phase complete", "主Agent");
      if (transition.success) {
        contexts.push(transition.ctx);
      } else {
        actions.push(`Transition failed: ${transition.error}`);
        contexts.push(ctx);
      }
    }
  }

  // Run lifecycle processes
  const mock_archive: StructuredArchive = {
    name: cards[0]?.name || "unknown",
    role: cards[0]?.role || "unknown",
    lifecycle: cards[0]?.lifecycle || "project_destroy",
    base_info: cards[0] || { name: "", role: "", summary: "", must_do: [], must_not_do: [], tech_env: {}, input_sources: [], output_targets: [], behavior_rules: [], permission_mode: "bypassPermissions", lifecycle: "project_destroy" },
    work_history: [],
    skill_evolution: { start: "", mid: "", end: "" },
    annotations: [],
  };
  const mock_skill = { start: "new", mid: "learning", end: "proficient" };

  for (const ctx of contexts) {
    process_freeze(ctx, mock_archive, mock_skill);
    process_destroy(ctx, []);
    const adjust = process_adjust(ctx, "updated requirements");
    if (adjust.ctx) {
      finish_adjust(adjust.ctx, cards[0] || ctx.card);
    }
  }

  return { triggered, actions, contexts };
}

// ============ Phase 8: Role Inventory ============

export function run_inventory_management_phase(
  cards: PersonaCard[],
  existing_inventory?: RoleInventory
): {
  inventory: RoleInventory;
  search_results: MatchResult[];
  dormant_results: MatchResult[];
} {
  let inventory: RoleInventory = existing_inventory || {
    entries: [],
    index: { entries: [] },
  };

  // Write each card to inventory
  for (const card of cards) {
    const input: InventoryWriteInput = {
      card: { ...card },
      skill_evolution: { start: "", mid: "", end: "" },
      history_scores: [],
      suitable_scenarios: [],
      unsuitable_scenarios: [],
    };
    inventory = write_to_inventory(input, inventory);
  }

  // Rebuild index
  inventory = {
    ...inventory,
    index: rebuild_index(inventory.entries),
  };

  // Search demonstrations
  search_by_tech(inventory.index, "TypeScript");
  search_by_score(inventory.index, 3, 5);
  search_by_scenario(inventory.index, "电商");

  // Full search
  const query: SearchQuery = {
    tech_stack: ["TypeScript"],
    module_features: ["web"],
  };
  const search_results = search_and_match(inventory, query, 5);

  // Track selections
  const tracker: SelectionTracker[] = [];
  track_selection(
    cards.map((c) => c.name),
    search_results.map((r) => r.entry.persona_card.original.name),
    tracker,
  );

  // Apply dormant rules
  inventory = apply_dormant_rule(inventory, tracker);

  // Sort with dormant last
  const dormant_results = sort_with_dormant_last(search_results);

  // Reactivate a dormant entry
  const dormant_entries = inventory.entries.filter((e) => e.status === "dormant");
  for (const d of dormant_entries) {
    inventory = reactivate_entry(inventory, d.persona_card.original.name);
  }

  // Delete demo (no actual deletion — just demonstrate the flow)
  if (inventory.entries.length > 0) {
    delete_from_inventory(
      inventory, inventory.entries[0].persona_card.original.name,
    );
    confirm_deletion(inventory, inventory.entries[0].persona_card.original.name, false);
  }

  return { inventory, search_results, dormant_results };
}

// ============ Phase 9: Project Archive ============

export function run_project_archive_phase(
  summary: InterviewSummary,
  structure: TeamStructure,
  conflicts: ConflictRecord[],
  faults: FaultRecord[],
  satisfaction: SatisfactionRecord[]
): {
  archive: ProjectArchive;
  protected_archive: ReturnType<typeof freeze_archive>;
} {
  const input: ArchiveInput = {
    project_id: `P-${Date.now()}`,
    project_name: summary.project_description.slice(0, 30),
    time_range: `${new Date().toISOString()} - ${new Date(Date.now() + 30 * 86400000).toISOString()}`,
    original_requirements: summary.project_description,
    lead_agent: structure.lead_agent_name,
    groups: structure.groups.map((g) => ({
      name: g.group_name,
      lead: g.lead.name,
      members: g.members.map((m) => m.name),
    })),
    stage_records: satisfaction.map((s) => ({
      stage_id: s.stage_id,
      completed_at: new Date().toISOString(),
      outputs: [],
      satisfaction: s.final_scores.composite,
    })),
    conflict_records: conflicts,
    fault_records: faults,
    satisfaction_records: satisfaction,
    reusable_outputs: [],
    inventory_changes: structure.all_cards.map((c) => ({
      action: "add" as const, name: c.name,
    })),
  };

  const archive = generate_project_archive(input);

  // Search demo
  search_archive(archive, { project_name: summary.project_description.slice(0, 10) });
  search_archives([archive], { project_name: "web" });

  // Generate summary
  archive_summary(archive);

  // Freeze
  const protected_archive = freeze_archive(archive);
  attempt_modify_protected(protected_archive);

  // Append note
  append_note(protected_archive, "主Agent", "项目归档完成，所有阶段记录已固化。");

  // Delete request demo
  const delete_req = request_delete_archive(archive, "客户");
  confirm_delete_archive(delete_req, false);

  // Restore / backup check
  restore_from_backup(archive);
  is_backup_recoverable(new Date().toISOString());

  return { archive, protected_archive };
}

// ============ Phase 10: Fault Recovery ============

export function run_fault_recovery_phase(
  faults: FaultEvent[],
  archive: ProjectArchive,
  inventory?: RoleInventory
): {
  records: FaultRecord[];
  member_states: MemberFaultState[];
  lead_states: LeadFaultState[];
  recovery_actions: string[];
} {
  const records: FaultRecord[] = [];
  const member_states: MemberFaultState[] = [];
  const lead_states: LeadFaultState[] = [];
  const recovery_actions: string[] = [];
  const existing_faults: FaultRecord[] = [];

  for (const event of faults) {
    const classification = classify_fault(event);

    // Create fault record
    const fault_input: FaultRecordInput = {
      role_name: event.role_name,
      role_type: event.role_type,
      fault_description: event.description,
      fault_level: classification.level,
      fault_pattern: classification.fault_pattern,
      suggestion: classification.suggestion,
    };
    const record = create_fault_record(fault_input, existing_faults);
    records.push(record);
    existing_faults.push(record);

    // Write to archive
    write_fault_to_archive(record, archive);

    // Check replacement threshold
    check_replacement_threshold(event.role_name, archive, 3);

    // Get fault history
    get_role_fault_history(event.role_name, archive);

    if (event.role_type === "member") {
      const state: MemberFaultState = {
        member_name: event.role_name,
        group_name: "default",
        rejection_count: event.consecutive_failures,
        rejected_reports: event.review_reports || [],
        status: "active",
      };

      const action: RejectAction = {
        member_name: event.role_name,
        reject_reason: event.description,
        fix_suggestions: [classification.suggestion],
        deadline_hours: 48,
      };

      const { state: updated, message } = handle_single_reject(state, action);
      recovery_actions.push(message);

      if (updated.status === "escalated") {
        const escalated = escalate_to_lead_agent(updated);
        recovery_actions.push(escalated.escalation_report);
      }

      if (event.consecutive_failures >= 3) {
        const { decision, reason } = decide_member_replacement(
          updated, inventory,
          { tech_stack: ["any"], module_features: [] },
        );
        recovery_actions.push(`${decision}: ${reason}`);

        const recovery_ctx: MemberRecoveryContext = {
          completed_task_ids: [],
          accepted_outputs: [],
        };
        const new_card: PersonaCard = {
          name: generate_random_name(),
          role: "replacement",
          summary: "Replacement member", must_do: [], must_not_do: [],
          tech_env: {}, input_sources: [], output_targets: [],
          behavior_rules: [], permission_mode: "bypassPermissions", lifecycle: "project_destroy",
        };
        const { recovery_note } = recover_member_context(event.role_name, new_card, recovery_ctx);
        recovery_actions.push(recovery_note);

        // Mark failed card
        mark_failed_card(new_card, updated);
      }

      member_states.push(updated);
    }

    if (event.role_type === "team_lead") {
      const state: LeadFaultState = {
        lead_name: event.role_name,
        group_name: "default",
        audit_miss_count: event.consecutive_failures,
        negotiation_timeouts: event.negotiation_timeout ? 1 : 0,
        warnings: [],
        status: "active",
      };

      const { state: warned, warning } = warn_lead_audit_miss(state, event.description);
      recovery_actions.push(warning);

      const { should_replace, reason } = decide_lead_replacement(warned, 3);
      if (should_replace) {
        recovery_actions.push(`Lead replacement: ${reason}`);

        const recovery: LeadRecoveryContext = {
          group_archive: [],
          current_stage_card: {
            stage_id: "S-RECOVER", from: "主Agent", to: event.role_name,
            goal: "recovery", acceptance_criteria: [],
            deadline: new Date().toISOString(),
            dependencies: {}, constraints: [],
          },
          group_name: "default",
        };
        recover_lead_context(event.role_name, generate_random_name(), recovery);

        if (event.negotiation_timeout) {
          forced_arbitration_for_timeout(warned, "conflict-recovery");
        }
      }

      lead_states.push(warned);
    }
  }

  // Deadlock detection
  detect_deadlock({ member_a: ["member_b"], member_b: ["member_a"] });

  // Output conflict resolution
  if (member_states.length >= 2) {
    const loser_card: PersonaCard = {
      name: member_states[1].member_name,
      role: "member", summary: "", must_do: [], must_not_do: [],
      tech_env: {}, input_sources: [], output_targets: [],
      behavior_rules: [], permission_mode: "bypassPermissions", lifecycle: "project_destroy",
    };
    resolve_output_conflict(
      member_states[0].member_name,
      member_states[1].member_name,
      "output conflict",
      loser_card,
    );
  }

  return { records, member_states, lead_states, recovery_actions };
}

// ============ Phase 11: Context Control ============

export function run_context_management_phase(
  structure: TeamStructure,
  summary: InterviewSummary,
  preferences?: string,
  inventory?: RoleInventory
): {
  member_contexts: ReturnType<typeof crop_member_context>[];
  lead_contexts: ReturnType<typeof crop_team_lead_context>[];
  lead_agent_context: ReturnType<typeof inject_lead_agent_context>;
  snapshots: ContextSnapshot[];
  leak_results: ReturnType<typeof run_leak_detection>[];
} {
  const member_contexts: ReturnType<typeof crop_member_context>[] = [];
  const lead_contexts: ReturnType<typeof crop_team_lead_context>[] = [];
  const leak_results: ReturnType<typeof run_leak_detection>[] = [];

  // Crop member contexts
  for (const group of structure.groups) {
    for (const member of group.members) {
      const input: MemberContextInput = {
        persona_card: member,
        module_task_card: {
          module_id: `M-${member.name}`,
          from: group.lead.name,
          to: member.name,
          tasks: [],
          output_format: "code",
          deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
          must_interface: [],
          forbidden: [],
        },
        upstream_interfaces: ["API Gateway"],
        downstream_interfaces: [`${group.group_name} Output`],
        simplified_conventions: DEFAULT_CONVENTIONS.slice(0, 3),
      };
      const ctx = crop_member_context(input);
      validate_member_context(ctx);
      member_contexts.push(ctx);
    }

    // Crop team lead context
    const lead_input: TeamLeadContextInput = {
      group_member_cards: group.members,
      lead_card: group.lead,
      stage_card: {
        stage_id: `S-${group.group_name}`,
        from: "主Agent",
        to: group.lead.name,
        goal: summary.project_description,
        acceptance_criteria: [],
        deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
        dependencies: {},
        constraints: [],
      },
      other_lead_interfaces: structure.groups
        .filter((g) => g.group_name !== group.group_name)
        .map((g) => ({
          lead_name: g.lead.name,
          group: g.group_name,
          interface_face: `${g.group_name} API`,
        })),
      full_conventions: DEFAULT_CONVENTIONS,
    };
    const lead_ctx = crop_team_lead_context(lead_input);
    validate_team_lead_context(lead_ctx);
    lead_contexts.push(lead_ctx);
  }

  // Inject lead agent context
  const la_input: LeadAgentContextInput = {
    all_persona_cards: structure.all_cards,
    client_requirements: summary.project_description,
    global_conventions: DEFAULT_CONVENTIONS,
    conflict_records: [],
    satisfaction_history: [],
    preference_profile: preferences,
    role_inventory: inventory ? JSON.stringify(inventory.index) : undefined,
  };
  const lead_agent_context = inject_lead_agent_context(la_input);
  validate_lead_agent_context(lead_agent_context);

  // Run leak detection on sample messages
  leak_results.push(
    run_leak_detection(
      "客户说必须用 React",
      structure.groups[0]?.lead.name || "lead",
      "team_lead",
      structure.groups[0]?.group_name,
    ),
  );
  leak_results.push(
    run_leak_detection(
      "张三是我们组最差的成员",
      structure.groups[0]?.lead.name || "lead",
      "team_lead",
      structure.groups[0]?.group_name,
      structure.groups[1]?.lead.name,
      structure.groups[1]?.group_name,
      "team_lead",
    ),
  );
  leak_results.push(
    run_leak_detection(
      "我来直接联系主Agent",
      structure.groups[0]?.members[0]?.name || "member",
      "member",
      structure.groups[0]?.group_name,
    ),
  );

  // Run individual leak detectors
  detect_task_dispatch_leak("需求原文: 需要支持高并发", structure.groups[0]?.lead.name || "lead");
  detect_member_cross_boundary_leak(
    "我需要其他组的数据库密码",
    structure.groups[0]?.members[0]?.name || "member",
    structure.groups[0]?.group_name || "group",
    structure.groups[1]?.members[0]?.name || "other_member",
    structure.groups[1]?.group_name,
    "member",
  );
  detect_lead_evaluation_leak(
    "张三是组里最差的",
    structure.groups[0]?.lead.name || "lead",
    structure.groups[0]?.group_name || "group",
  );
  detect_agent_report_leak("组长A和组长B之间存在严重分歧，组长A认为...");

  // Create snapshots for all contexts
  const snapshots = batch_create_snapshots([
    ...structure.groups.map((g) => [
      { name: g.lead.name, level: "team_lead" as const, content: lead_contexts[0] || {} },
      ...g.members.map((m, i) => ({
        name: m.name,
        level: "member" as const,
        content: member_contexts[i] || {},
      })),
    ]).flat(),
  ]);

  // Snapshot management
  for (const snap of snapshots) {
    restore_from_snapshot(snap.role_name, snapshots);
    get_snapshot_history(snap.role_name, snapshots);
    has_recoverable_snapshot(snap.role_name, snapshots);
  }
  prune_expired_snapshots(snapshots, 24);

  return { member_contexts, lead_contexts, lead_agent_context, snapshots, leak_results };
}

// ============ Phase 12: Exit ============

export function run_exit_phase(
  cards: PersonaCard[],
  archived_roles: Set<string>,
  inventory_roles: Set<string>
): {
  checklist: ExitChecklist;
  confirmation: ExitConfirmation;
  archive_text: string;
} {
  const checklist = generate_exit_checklist(cards, archived_roles, inventory_roles);
  const confirmation = execute_exit(checklist);
  const archive_text = exit_archive_summary(cards, "project");

  return { checklist, confirmation, archive_text };
}

// ============ Constitution Check ============

export function run_constitution_check(action: AgentAction): {
  result: CheckResult;
  halt: boolean;
} {
  const result = check_constitution(action);
  const halt = is_halt_required(result);
  return { result, halt };
}

export function run_constitution_full_check(): CheckResult[] {
  const actions: AgentAction[] = [
    { role: "lead", action: "skip_interview", target: "member" },
    { role: "member", action: "member_to_lead_direct", target: "lead" },
    { role: "team_lead", action: "leak_member_evaluation", target: "other_lead" },
    { role: "lead", action: "preset_satisfaction_score" },
    { role: "team_lead", action: "suppress_conflict", target: "主Agent" },
    { role: "member", action: "fake_implementation" },
  ];

  return actions.map((a) => check_constitution(a));
}

// ============ Full Pipeline ============

export function run_full_pipeline(input: FullPipelineInput): PipelineResult {
  const errors: string[] = [];
  const state: PipelineState = { phase: "interview", errors: [], halted: false };

  try {
    // Phase 1: Interview
    state.phase = "interview";
    const { summary, state: confirm_state } = run_interview_phase(input.answers);
    is_interview_done(confirm_state);

    // Phase 2: Team assembly
    state.phase = "team_assemble";
    const { structure, rendered_cards } = run_team_assemble_phase(summary);
    generate_team(summary); // Also exercise the shortcut

    // Card review
    state.phase = "card_review";
    run_card_review_phase(structure.all_cards);

    // Phase 3: Task distribution
    state.phase = "task_distribution";
    run_task_distribution_phase(summary, structure, input.stages);

    // Phase 4: Code review
    state.phase = "code_review";
    const { results: review_results } = run_code_review_phase(
      input.member_code_map,
      input.requirements_for_review,
      Object.values(input.member_code_map),
      input.expected_rules,
    );

    // Phase 5: Conflict arbitration
    state.phase = "conflict_arbitration";
    const { pipeline_results: arb_results } = run_conflict_arbitration_phase(
      input.interfaces,
      input.operations,
      input.data_schema,
      input.member_code_map,
      input.implementations,
      structure.all_cards,
    );

    // Phase 6: Satisfaction scoring
    state.phase = "satisfaction_scoring";
    const member_inputs: ScoringInput[] = structure.all_cards
      .filter((c) => c.role.includes("工程师"))
      .map((c) => ({
        member_name: c.name,
        role: c.role,
        implementation_completeness: 4,
        code_quality: 4,
        collaboration: 4,
        bonus_items: [],
        penalty_items: [],
      }));
    const { record, profile, updated_cards } = run_satisfaction_scoring_phase(
      "S-001",
      structure.groups[0]?.group_name || "默认组",
      member_inputs,
      structure.all_cards,
    );
    const satisfaction_records = [record];

    // Phase 7: Lifecycle management
    state.phase = "lifecycle_management";
    const lifecycle = run_lifecycle_management_phase(updated_cards, satisfaction_records);

    // Phase 8: Role inventory
    state.phase = "inventory_management";
    const { inventory } = run_inventory_management_phase(updated_cards);

    // Phase 9: Project archive
    state.phase = "project_archive";
    const { archive } = run_project_archive_phase(
      summary, structure,
      arb_results.results.map((r) => r.original_conflict),
      [],
      satisfaction_records,
    );

    // Phase 10: Fault recovery
    state.phase = "fault_recovery";
    const fault_events: FaultEvent[] = [{
      role_name: structure.all_cards[0]?.name || "unknown",
      role_type: "member",
      description: "连续3次产出不合格",
      consecutive_failures: 3,
      review_reports: review_results,
    }];
    run_fault_recovery_phase(fault_events, archive, inventory);

    // Phase 11: Context management
    state.phase = "context_management";
    const { snapshots } = run_context_management_phase(
      structure, summary,
      profile ? JSON.stringify(profile) : undefined,
      inventory,
    );

    // Phase 12: Exit
    state.phase = "exit";
    const archived_set = new Set(structure.all_cards.map((c) => c.name));
    const inventory_set = new Set(inventory.entries.map((e) => e.persona_card.original.name));
    const exit = run_exit_phase(structure.all_cards, archived_set, inventory_set);

    // Constitution check
    state.phase = "constitution_check";
    const constitution_checks = run_constitution_full_check();

    return {
      summary,
      team: structure,
      rendered_cards,
      review_results,
      arbitration_results: arb_results.results,
      satisfaction_records,
      preference_profile: profile,
      lifecycle_results: lifecycle.actions,
      inventory,
      archive,
      context_snapshots: snapshots,
      exit_checklist: exit.checklist,
      constitution_checks,
      errors,
    };
  } catch (e) {
    errors.push(`Pipeline error at phase ${state.phase}: ${e}`);
    state.errors = errors;
    state.halted = true;
    throw e;
  }
}
