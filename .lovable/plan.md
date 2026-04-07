
# Production Studio — Master Plan

## Phase 1–6: Core Platform ✅
- Project wizard, scene planning, timeline engine, review gates, finishing, export, auto-assembly, routing

## Phase 7: Production Robustness, QC & Cost Governance ✅
- Asset normalization, candidate ranking, QC layer, render robustness, cost governance, diagnostics, export presets

## Phase 8: Platform Governance Layer ✅

### Implemented:
- **Database**: governance_policies, governance_transitions, governance_violations, incidents tables
- **Column extensions**: governance_state on projects; version_ref/approved_by/gate_owner/stale/superseded_by on review_gates; approved_by/timeline_version_ref on export_versions; created_by/locked_by on timelines; created_by on project_assets
- **Seeded data**: 10 governance policies, 18 state transitions, 7 feature flags
- **Engine**: `src/lib/governance-engine.ts` — state transition checker, policy checker, violation logger, incident creator
- **Hooks**: `src/hooks/useGovernance.ts` — useGovernancePolicies, useGovernanceTransitions, useGovernanceViolations, useIncidents, useProjectGovernanceState, useGovernanceTransition, useProjectGovernanceDashboard
- **UI**: GovernanceDashboard page (`/project/:id/governance`) with 6 tabs (State, Reviews, Violations, Incidents, Cost, Exports)
- **Components**: IncidentFeed, PolicyViolationAlert
- **Route**: wired in App.tsx

### Governance domains covered:
1. Project Governance — 18-state lifecycle with explicit transitions
2. Review Governance — version-aware gates with stale detection fields
3. Cost Governance — budget ceilings, cost modes, spending tracking
4. Export Governance — version-linked exports with approval tracking
5. Provider Governance — payload logging, fallback rules
6. Data Governance — asset lifecycle states
7. Operational Governance — structured incidents with severity levels
8. Policy Engine — 10 non-negotiable rules enforced centrally
