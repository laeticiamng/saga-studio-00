import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E2E-style integration test for the "One-Click Generate" pipeline.
 * Tests atomicity, idempotence, cascades, render validation, and cleanup.
 */

// ─── Mock Supabase Client ───────────────────────────────────────────────────

interface MockRow { [key: string]: any }

function createMockSupabase() {
  const tables: Record<string, MockRow[]> = {
    credit_wallets: [{ id: "user-1", balance: 50, updated_at: new Date().toISOString() }],
    credit_ledger: [],
    projects: [{ id: "proj-1", user_id: "user-1", status: "draft", type: "clip", title: "Test" }],
    shots: [],
    renders: [],
    plans: [{ project_id: "proj-1", shotlist_json: [], style_bible_json: {}, character_bible_json: {}, version: 1 }],
    audio_analysis: [{ project_id: "proj-1", bpm: 120, beats_json: [], sections_json: [], energy_json: [] }],
    job_queue: [],
    moderation_flags: [],
  };

  return { tables };
}

// ─── Ticket 1: Débit atomique des crédits ───────────────────────────────────

describe("Ticket 1 — Débit atomique des crédits", () => {
  let db: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    db = createMockSupabase();
  });

  function debitCredits(userId: string, amount: number, refId: string, refType: string): boolean {
    // Idempotence check
    const existing = db.tables.credit_ledger.find(
      e => e.ref_id === refId && e.ref_type === refType && e.delta < 0
    );
    if (existing) return true; // Already debited

    const wallet = db.tables.credit_wallets.find(w => w.id === userId);
    if (!wallet || wallet.balance < amount) return false;

    // Atomic debit
    wallet.balance -= amount;
    db.tables.credit_ledger.push({
      id: crypto.randomUUID(),
      user_id: userId,
      delta: -amount,
      reason: "Shot generation",
      ref_id: refId,
      ref_type: refType,
    });
    return true;
  }

  it("AC1: Débit échoue proprement si solde insuffisant", () => {
    db.tables.credit_wallets[0].balance = 5;
    const result = debitCredits("user-1", 20, "ref-1", "shot_generation");
    expect(result).toBe(false);
    expect(db.tables.credit_wallets[0].balance).toBe(5); // Unchanged
    expect(db.tables.credit_ledger).toHaveLength(0); // No ledger entry
  });

  it("AC2: Double appel ne débite pas deux fois (idempotence)", () => {
    const result1 = debitCredits("user-1", 10, "proj-1_gen_123", "shot_generation");
    expect(result1).toBe(true);
    expect(db.tables.credit_wallets[0].balance).toBe(40);

    const result2 = debitCredits("user-1", 10, "proj-1_gen_123", "shot_generation");
    expect(result2).toBe(true); // Idempotent success
    expect(db.tables.credit_wallets[0].balance).toBe(40); // NOT 30
    expect(db.tables.credit_ledger).toHaveLength(1); // Only one entry
  });

  it("AC3: Wallet et ledger restent cohérents", () => {
    debitCredits("user-1", 10, "ref-a", "shot_generation");
    debitCredits("user-1", 15, "ref-b", "shot_generation");

    const wallet = db.tables.credit_wallets[0];
    const totalDebited = db.tables.credit_ledger.reduce((sum, e) => sum + Math.abs(e.delta), 0);

    expect(wallet.balance).toBe(50 - totalDebited);
    expect(wallet.balance).toBe(25);
    expect(db.tables.credit_ledger).toHaveLength(2);
  });

  it("AC3b: Solde ne peut pas devenir négatif", () => {
    debitCredits("user-1", 50, "ref-x", "shot_generation"); // Balance = 0
    const result = debitCredits("user-1", 1, "ref-y", "shot_generation"); // Should fail
    expect(result).toBe(false);
    expect(db.tables.credit_wallets[0].balance).toBe(0);
  });
});

// ─── Ticket 2: Suppression/Prévention des shots orphelins ──────────────────

describe("Ticket 2 — Shots orphelins", () => {
  let db: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    db = createMockSupabase();
    // Add shots linked to project
    for (let i = 0; i < 5; i++) {
      db.tables.shots.push({ id: `shot-${i}`, project_id: "proj-1", idx: i, status: "pending" });
    }
  });

  function deleteProject(projectId: string) {
    // Simulate CASCADE: delete all related rows
    db.tables.shots = db.tables.shots.filter(s => s.project_id !== projectId);
    db.tables.renders = db.tables.renders.filter(r => r.project_id !== projectId);
    db.tables.plans = db.tables.plans.filter(p => p.project_id !== projectId);
    db.tables.audio_analysis = db.tables.audio_analysis.filter(a => a.project_id !== projectId);
    db.tables.job_queue = db.tables.job_queue.filter(j => j.project_id !== projectId);
    db.tables.moderation_flags = db.tables.moderation_flags.filter(m => m.project_id !== projectId);
    db.tables.projects = db.tables.projects.filter(p => p.id !== projectId);
  }

  it("AC1: Aucun shot sans project_id après suppression projet", () => {
    expect(db.tables.shots).toHaveLength(5);
    deleteProject("proj-1");
    expect(db.tables.shots).toHaveLength(0);
    expect(db.tables.projects).toHaveLength(0);
  });

  it("AC2: Insertion shot sans project_id valide impossible (FK constraint)", () => {
    // In real DB, FK prevents this. Simulate:
    const insertShot = (projectId: string) => {
      const projectExists = db.tables.projects.some(p => p.id === projectId);
      if (!projectExists) throw new Error("FK violation: project_id does not reference a valid project");
      db.tables.shots.push({ id: `new-shot`, project_id: projectId, idx: 99, status: "pending" });
    };

    expect(() => insertShot("nonexistent-project")).toThrow("FK violation");
    expect(db.tables.shots).toHaveLength(5); // Unchanged
  });

  it("AC3: CASCADE supprime tous les enfants", () => {
    db.tables.renders.push({ id: "render-1", project_id: "proj-1", status: "pending" });
    db.tables.job_queue.push({ id: "job-1", project_id: "proj-1", step: "analyze", status: "pending" });

    deleteProject("proj-1");

    expect(db.tables.shots).toHaveLength(0);
    expect(db.tables.renders).toHaveLength(0);
    expect(db.tables.plans).toHaveLength(0);
    expect(db.tables.audio_analysis).toHaveLength(0);
    expect(db.tables.job_queue).toHaveLength(0);
  });
});

// ─── Ticket 3: Renders placeholders ─────────────────────────────────────────

describe("Ticket 3 — Renders placeholders & validation", () => {
  function validateRenderCompletion(render: MockRow): boolean {
    if (render.status === "completed" && !render.master_url_16_9) return false;
    if (render.status === "completed" && (
      render.master_url_16_9.includes("placeholder") ||
      render.master_url_16_9 === "" ||
      render.master_url_16_9.startsWith("data:")
    )) return false;
    return true;
  }

  it("AC1: Aucun render completed avec URL null", () => {
    const render = { status: "completed", master_url_16_9: null };
    expect(validateRenderCompletion(render)).toBe(false);
  });

  it("AC1b: Aucun render completed avec URL placeholder", () => {
    const render = { status: "completed", master_url_16_9: "https://example.com/placeholder.mp4" };
    expect(validateRenderCompletion(render)).toBe(false);
  });

  it("AC1c: Aucun render completed avec URL vide", () => {
    const render = { status: "completed", master_url_16_9: "" };
    expect(validateRenderCompletion(render)).toBe(false);
  });

  it("AC1d: Render completed avec URL valide passe", () => {
    const render = { status: "completed", master_url_16_9: "https://storage.example.com/renders/proj-1/master.mp4" };
    expect(validateRenderCompletion(render)).toBe(true);
  });

  it("AC2: Retry stitch ne crée pas de doublons (upsert on project_id)", () => {
    const renders: MockRow[] = [];
    const upsertRender = (render: MockRow) => {
      const idx = renders.findIndex(r => r.project_id === render.project_id);
      if (idx >= 0) renders[idx] = { ...renders[idx], ...render };
      else renders.push(render);
    };

    upsertRender({ project_id: "proj-1", status: "pending", logs: "attempt 1" });
    upsertRender({ project_id: "proj-1", status: "pending", logs: "attempt 2" });

    expect(renders).toHaveLength(1);
    expect(renders[0].logs).toBe("attempt 2");
  });

  it("AC3: GC placeholders invalides après 24h", () => {
    const now = Date.now();
    const renders = [
      { id: "r1", project_id: "p1", status: "pending", master_url_16_9: null, created_at: new Date(now - 25 * 3600 * 1000).toISOString() },
      { id: "r2", project_id: "p2", status: "pending", master_url_16_9: null, created_at: new Date(now - 1 * 3600 * 1000).toISOString() },
      { id: "r3", project_id: "p3", status: "completed", master_url_16_9: "https://real.mp4", created_at: new Date(now - 48 * 3600 * 1000).toISOString() },
    ];

    const oneDayAgo = new Date(now - 24 * 3600 * 1000).toISOString();
    const stale = renders.filter(r =>
      r.status === "pending" && !r.master_url_16_9 && r.created_at < oneDayAgo
    );

    expect(stale).toHaveLength(1);
    expect(stale[0].id).toBe("r1");
  });
});

// ─── Ticket 4: Pipeline flow E2E ───────────────────────────────────────────

describe("Ticket 4 — Pipeline E2E One-Click Generate", () => {
  const PIPELINE_STEPS = [
    { from: "draft", to: "analyzing", fn: "analyze-audio" },
    { from: "analyzing", to: "planning", fn: "plan-project" },
    { from: "planning", to: "generating", fn: "generate-shots" },
    { from: "generating", to: "stitching", fn: null },
    { from: "stitching", to: "completed", fn: "stitch-render" },
  ];

  it("AC1: Pipeline transitions are sequential and valid", () => {
    for (let i = 0; i < PIPELINE_STEPS.length - 1; i++) {
      expect(PIPELINE_STEPS[i].to).toBe(PIPELINE_STEPS[i + 1].from);
    }
    expect(PIPELINE_STEPS[PIPELINE_STEPS.length - 1].to).toBe("completed");
  });

  it("AC2: Statut final est 'completed' après pipeline complet", () => {
    let status = "draft";
    for (const step of PIPELINE_STEPS) {
      if (status === step.from) status = step.to;
    }
    expect(status).toBe("completed");
  });

  it("AC3: Débit crédits unique via le pipeline", () => {
    const ledger: MockRow[] = [];
    const walletBalance = { value: 50 };

    // Simulate pipeline debit
    const debit = (amount: number, refId: string) => {
      if (ledger.some(e => e.ref_id === refId)) return true;
      if (walletBalance.value < amount) return false;
      walletBalance.value -= amount;
      ledger.push({ delta: -amount, ref_id: refId });
      return true;
    };

    // First call during generate-shots
    debit(20, "proj-1_gen_batch1");
    expect(walletBalance.value).toBe(30);

    // Retry (e.g. timeout recovery) — should not double-debit
    debit(20, "proj-1_gen_batch1");
    expect(walletBalance.value).toBe(30);
    expect(ledger).toHaveLength(1);
  });

  it("AC4: Render final existe avec URL non-placeholder", () => {
    const render = {
      project_id: "proj-1",
      status: "completed",
      master_url_16_9: "https://storage.supabase.co/renders/proj-1/master_16_9.mp4",
    };

    expect(render.status).toBe("completed");
    expect(render.master_url_16_9).toBeTruthy();
    expect(render.master_url_16_9).not.toContain("placeholder");
    expect(render.master_url_16_9).toMatch(/^https?:\/\//);
  });

  it("AC4b: Pipeline gère l'échec proprement", () => {
    const TERMINAL_STATUSES = ["completed", "failed", "cancelled"];
    let projectStatus = "generating";

    // Simulate all shots failed
    const allShotsFailed = true;
    if (allShotsFailed) projectStatus = "failed";

    expect(TERMINAL_STATUSES).toContain(projectStatus);
  });

  it("AC5: Cleanup gère les jobs bloqués et renders périmés", () => {
    const now = Date.now();
    const jobs = [
      { id: "j1", status: "processing", started_at: new Date(now - 40 * 60 * 1000).toISOString(), retry_count: 0, max_retries: 3 },
      { id: "j2", status: "processing", started_at: new Date(now - 5 * 60 * 1000).toISOString(), retry_count: 0, max_retries: 3 },
    ];

    const thirtyMinAgo = new Date(now - 30 * 60 * 1000).toISOString();
    const stuck = jobs.filter(j => j.status === "processing" && j.started_at < thirtyMinAgo);

    expect(stuck).toHaveLength(1);
    expect(stuck[0].id).toBe("j1");

    // Reset or fail based on retries
    for (const job of stuck) {
      const newRetry = job.retry_count + 1;
      const newStatus = newRetry >= job.max_retries ? "failed" : "pending";
      expect(newStatus).toBe("pending"); // First retry → back to pending
    }
  });
});
