import { describe, it, expect } from "vitest";

/**
 * Unit tests for continuity memory logic.
 */

type MemoryNode = {
  id: string;
  node_type: string;
  label: string;
  properties: Record<string, unknown>;
  is_active: boolean;
};

type MemoryEdge = {
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
};

describe("Continuity Memory Graph", () => {
  const nodes: MemoryNode[] = [
    { id: "n1", node_type: "character", label: "Alice", properties: { hair: "blonde" }, is_active: true },
    { id: "n2", node_type: "character", label: "Bob", properties: { hair: "brown" }, is_active: true },
    { id: "n3", node_type: "location", label: "Cafe", properties: { city: "Paris" }, is_active: true },
    { id: "n4", node_type: "costume", label: "Alice red dress", properties: { color: "red" }, is_active: true },
  ];

  const edges: MemoryEdge[] = [
    { source_node_id: "n1", target_node_id: "n4", edge_type: "wears" },
    { source_node_id: "n1", target_node_id: "n2", edge_type: "interacts_with" },
    { source_node_id: "n1", target_node_id: "n3", edge_type: "located_at" },
  ];

  it("can find nodes by type", () => {
    const characters = nodes.filter(n => n.node_type === "character");
    expect(characters).toHaveLength(2);
  });

  it("can find edges for a node", () => {
    const aliceEdges = edges.filter(e => e.source_node_id === "n1" || e.target_node_id === "n1");
    expect(aliceEdges).toHaveLength(3);
  });

  it("can detect costume for character", () => {
    const aliceCostume = edges.filter(e => e.source_node_id === "n1" && e.edge_type === "wears");
    expect(aliceCostume).toHaveLength(1);
    const costumeNode = nodes.find(n => n.id === aliceCostume[0].target_node_id);
    expect(costumeNode?.label).toBe("Alice red dress");
  });
});

describe("Conflict Detection", () => {
  type ConflictType = "character_appearance" | "costume_change" | "prop_inconsistency" | "location_error" | "timeline_error" | "dialogue_contradiction" | "visual_mismatch";

  function detectConflicts(
    currentEpisode: { characters: Array<{ name: string; hair?: string; costume?: string }> },
    memory: Map<string, { hair?: string; costume?: string }>
  ): Array<{ type: ConflictType; description: string }> {
    const conflicts: Array<{ type: ConflictType; description: string }> = [];

    for (const char of currentEpisode.characters) {
      const memChar = memory.get(char.name);
      if (!memChar) continue;

      if (char.hair && memChar.hair && char.hair !== memChar.hair) {
        conflicts.push({
          type: "character_appearance",
          description: `${char.name} hair changed from ${memChar.hair} to ${char.hair}`,
        });
      }

      if (char.costume && memChar.costume && char.costume !== memChar.costume) {
        conflicts.push({
          type: "costume_change",
          description: `${char.name} costume changed from ${memChar.costume} to ${char.costume}`,
        });
      }
    }

    return conflicts;
  }

  it("detects hair color change", () => {
    const memory = new Map([["Alice", { hair: "blonde", costume: "red dress" }]]);
    const episode = { characters: [{ name: "Alice", hair: "brunette" }] };
    const conflicts = detectConflicts(episode, memory);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe("character_appearance");
  });

  it("detects costume change", () => {
    const memory = new Map([["Alice", { hair: "blonde", costume: "red dress" }]]);
    const episode = { characters: [{ name: "Alice", costume: "blue suit" }] };
    const conflicts = detectConflicts(episode, memory);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe("costume_change");
  });

  it("no conflict when consistent", () => {
    const memory = new Map([["Alice", { hair: "blonde", costume: "red dress" }]]);
    const episode = { characters: [{ name: "Alice", hair: "blonde", costume: "red dress" }] };
    expect(detectConflicts(episode, memory)).toHaveLength(0);
  });

  it("ignores unknown characters", () => {
    const memory = new Map([["Alice", { hair: "blonde" }]]);
    const episode = { characters: [{ name: "Charlie", hair: "red" }] };
    expect(detectConflicts(episode, memory)).toHaveLength(0);
  });
});

describe("Placeholder Detection", () => {
  function detectPlaceholders(content: string): string[] {
    const patterns = [
      /\[TODO[:\s].*?\]/gi,
      /\[PLACEHOLDER\]/gi,
      /\[INSERT.*?\]/gi,
      /\[TBD\]/gi,
      /lorem ipsum/gi,
      /\{\{.*?\}\}/g,
    ];

    const found: string[] = [];
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) found.push(...matches);
    }
    return found;
  }

  it("detects TODO placeholders", () => {
    expect(detectPlaceholders("Alice says [TODO: write dialogue]")).toHaveLength(1);
  });

  it("detects PLACEHOLDER markers", () => {
    expect(detectPlaceholders("Scene takes place at [PLACEHOLDER]")).toHaveLength(1);
  });

  it("detects INSERT markers", () => {
    expect(detectPlaceholders("[INSERT LOCATION NAME]")).toHaveLength(1);
  });

  it("detects lorem ipsum", () => {
    expect(detectPlaceholders("Lorem ipsum dolor sit amet")).toHaveLength(1);
  });

  it("detects template variables", () => {
    expect(detectPlaceholders("Hello {{character_name}}")).toHaveLength(1);
  });

  it("returns empty for clean content", () => {
    expect(detectPlaceholders("Alice walks into the cafe and orders coffee.")).toHaveLength(0);
  });
});
