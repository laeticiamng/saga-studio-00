# Go-Live Criteria

## Purpose

This document defines the explicit gates that must be satisfied before the platform can be considered production-ready. No vague "it seems ready" — launch readiness is measurable.

## Gates

| # | Gate | Criteria | Status |
|---|------|----------|--------|
| 1 | **DOCX Parsing** | ZIP/XML parser succeeds on real corpus patterns (governance, bible, script, one-pager) | ✅ Implemented |
| 2 | **PDF Parsing** | Gemini Vision extraction succeeds on multi-page PDFs | ✅ Implemented |
| 3 | **Legacy Migration** | `reprocess` and `reprocess_legacy` actions work end-to-end | ✅ Implemented |
| 4 | **Active Truth** | No stale failed result shown as current truth — `latest_successful_run` drives UI | ✅ Implemented |
| 5 | **Ingestion Summary** | Entity counts, coverage scores, and missing field detection are trustworthy | ✅ Implemented |
| 6 | **Entity Extraction** | Title, synopsis, characters, scenes, locations extracted from real corpus | ✅ Implemented |
| 7 | **Parser Versioning** | `parser_version` column persisted per document, legacy detection via column check | ✅ Implemented |
| 8 | **Review Gates** | Auto-approve at confidence threshold + manual fallback in ApprovalInbox | ✅ Implemented |
| 9 | **Timeline Persistence** | Clips with `source_url`, `shot_id`, real media thumbnails in Studio | ✅ Implemented |
| 10 | **Export Pipeline** | `stitch-render` callable from Studio ExportPanel with progress tracking | ✅ Implemented |
| 11 | **Diagnostics Visible** | Parser version, failure reasons, extraction previews visible in UI | ✅ Implemented |
| 12 | **README Aligned** | Repository docs describe the actual multi-format platform | ✅ Implemented |
| 13 | **Runbooks** | 14 runbooks covering all major failure classes | ✅ Implemented |
| 14 | **Regression Tests** | Real corpus pattern fixtures in CI test suite | ✅ Implemented |
| 15 | **Governance Engine** | 18-state machine with policy enforcement and violation tracking | ✅ Implemented |
| 16 | **Cost Controls** | Credit system with idempotent debit/topup and budget ceiling | ✅ Implemented |
| 17 | **Anti-Aberration** | Multi-pass validation (technical, visual, semantic, continuity, delivery) | ✅ Implemented |
| 18 | **Auth & RLS** | JWT validation in all edge functions, RLS on all tables | ✅ Implemented |

## Pre-Launch Checklist

- [ ] All go-live gates pass
- [ ] Zero P0 issues open
- [ ] Core runbooks reviewed by team
- [ ] Stripe webhook tested in production
- [ ] Provider API keys verified (Runway, Luma, OpenAI, Google)
- [ ] Storage buckets configured (source-documents, shot-outputs, renders)
- [ ] Email delivery tested (Resend)
- [ ] Feature flags reviewed (disable experimental features)

## Post-Launch Monitoring

- Monitor `diagnostic_events` for `severity = 'error'` or `'critical'`
- Monitor `agent_runs` for `status = 'failed'` with `retry_count >= max_retries`
- Monitor `provider_failures` for provider-wide outages
- Monitor `credit_wallets` for balance anomalies
- Check `audit_logs` for unusual patterns
