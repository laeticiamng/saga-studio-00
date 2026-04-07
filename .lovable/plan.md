
# Phase 8 — Platform Governance Layer

## Scope Assessment
The 17-section request maps to these concrete implementation groups:

### Group A: Database Schema (Migration)
1. **`governance_policies`** — Central policy registry (policy_key, domain, rule_json, enforcement_mode, is_active)
2. **`governance_transitions`** — Allowed state transitions per domain (from_state, to_state, required_approvals, guard_conditions)
3. **`governance_violations`** — Policy violation log (policy_key, entity_type, entity_id, actor_type, actor_id, reason, severity)
4. **`incidents`** — Structured incident tracking (scope, scope_id, severity, root_cause_class, status, resolution_notes, auto_retry_count)
5. **Add columns**: `created_by`, `last_modified_by`, `locked_by` on key tables (projects, timelines, export_versions, review_gates)
6. **Add columns**: `version_ref` on review_gates and export_versions for version-aware approvals
7. **Seed feature flags** for: unified_wizard, timeline_studio, finishing_presets, export_engine, hybrid_video, candidate_ranking, qc_blocking_mode
8. **Seed governance policies** for the non-negotiable rules (no export without QC, no generation before identity approval, etc.)
9. **Seed governance transitions** for the 18-state project lifecycle state machine

### Group B: Backend Logic
1. **`src/lib/governance-engine.ts`** — Central policy checker: `canTransition(projectId, toState)`, `checkPolicy(domain, action, context)`, `logViolation()`
2. **`src/lib/state-machine-governance.ts`** — Extend existing pipeline state machine with the full 18-state lifecycle + guard enforcement
3. **`supabase/functions/governance-check/index.ts`** — Edge function for server-side policy enforcement on critical mutations

### Group C: Hooks & Data Access
1. **`useGovernancePolicies`** — Read active policies
2. **`useGovernanceViolations`** — Read violations for a project
3. **`useIncidents`** — CRUD for incidents scoped to project
4. **`useProjectGovernance`** — Composite hook: current state, blocked transitions, pending reviews, cost status, QC status, incidents

### Group D: UI Components
1. **`GovernanceDashboard.tsx`** (new page) — Unified view: project state, pending reviews, violations, cost, provider health, QC, incidents, export readiness
2. **`ProjectGovernancePanel.tsx`** (component) — Per-project governance settings (budget, cost mode, providers, QC strictness, etc.)
3. **`IncidentFeed.tsx`** (component) — Structured incident list with severity badges
4. **`PolicyViolationAlert.tsx`** (component) — Inline policy violation display
5. **Wire route** `/project/:id/governance` in App.tsx

### Group E: Feature Flags Seeding
- Insert 7 feature flags into `feature_flags` table

### What is NOT in scope (documentation/future)
- Full SLA timers on review gates (future enhancement)
- Automated incident grouping/deduplication (future ML layer)
- Multi-user ownership model (currently single-user per project)
- Provider health auto-suspension (requires external monitoring)

## Implementation Order
1. Database migration (Groups A + E)
2. Backend logic (Group B)
3. Hooks (Group C)  
4. UI (Group D)
5. Update plan.md
