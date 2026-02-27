import { z } from "zod";

/**
 * Converts a Zod schema to JSON Schema compatible with the MCP SDK.
 * Handles the common Zod types used in our tool definitions.
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodValue = value as z.ZodType;
      properties[key] = zodToJsonSchema(zodValue);

      // Check if the field is required (not optional, not with default)
      if (!(zodValue instanceof z.ZodOptional) && !(zodValue instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  if (schema instanceof z.ZodString) {
    return { type: "string", description: schema.description };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: "number", description: schema.description };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean", description: schema.description };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodToJsonSchema(schema.element),
      description: schema.description,
    };
  }

  if (schema instanceof z.ZodOptional) {
    const inner = zodToJsonSchema(schema.unwrap());
    return { ...inner, description: inner.description || schema.description };
  }

  if (schema instanceof z.ZodDefault) {
    const inner = zodToJsonSchema(schema.removeDefault());
    return { ...inner, default: schema._def.defaultValue(), description: inner.description || schema.description };
  }

  if (schema instanceof z.ZodEnum) {
    return { type: "string", enum: schema.options, description: schema.description };
  }

  // Fallback
  return { type: "string", description: schema.description };
}
