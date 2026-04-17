// Lightweight JSON Schema validator (subset) for canonical field validation.
// Supports: type (string|number|integer|boolean|array|object|null), required,
// minLength/maxLength, minimum/maximum, enum, pattern, items, properties.
// Sufficient for governing canonical_field_schemas without pulling Ajv into Deno.

type Schema = Record<string, unknown>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAgainstSchema(value: unknown, schema: Schema, path = "$"): ValidationResult {
  const errors: string[] = [];

  const expectedType = schema.type as string | string[] | undefined;
  if (expectedType) {
    const types = Array.isArray(expectedType) ? expectedType : [expectedType];
    const actual = jsType(value);
    if (!types.includes(actual)) {
      errors.push(`${path}: expected ${types.join("|")}, got ${actual}`);
      return { valid: false, errors };
    }
  }

  if (schema.enum && Array.isArray(schema.enum)) {
    if (!schema.enum.some((v) => deepEqual(v, value))) {
      errors.push(`${path}: value not in enum`);
    }
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push(`${path}: shorter than minLength ${schema.minLength}`);
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      errors.push(`${path}: longer than maxLength ${schema.maxLength}`);
    }
    if (typeof schema.pattern === "string") {
      try {
        if (!new RegExp(schema.pattern).test(value)) {
          errors.push(`${path}: does not match pattern`);
        }
      } catch {
        // ignore bad regex
      }
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push(`${path}: below minimum ${schema.minimum}`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push(`${path}: above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, idx) => {
      const sub = validateAgainstSchema(item, schema.items as Schema, `${path}[${idx}]`);
      errors.push(...sub.errors);
    });
  }

  if (value && typeof value === "object" && !Array.isArray(value) && schema.properties) {
    const obj = value as Record<string, unknown>;
    const props = schema.properties as Record<string, Schema>;
    if (Array.isArray(schema.required)) {
      for (const req of schema.required as string[]) {
        if (!(req in obj)) errors.push(`${path}.${req}: required`);
      }
    }
    for (const [k, sub] of Object.entries(props)) {
      if (k in obj) {
        const r = validateAgainstSchema(obj[k], sub, `${path}.${k}`);
        errors.push(...r.errors);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function jsType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") return JSON.stringify(a) === JSON.stringify(b);
  return false;
}
