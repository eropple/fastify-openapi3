import { pascalCase } from "change-case";
import type { CustomOptions, TSchema } from "typebox";

import { SCHEMA_NAME_PROPERTY } from "./constants.js";

export interface TaggedSchema {
  /**
   * Added for internal use within `@eropple/fastify-openapi3`.  Don't touch this if you
   * don't know what you're doing!
   *
   * If you want to know what you're doing: well, this is the uniqueness key
   * for your schemas, because using `$id` in schemas means that you, personally, will have
   * to do the juggling rather than being able to use TypeScript objects via Typebox. And
   * part of using Typebox, and specifically using `schemaType` to wrap Typebox objects,
   * is that `@eropple/fastify-openapi3` is smart enough to yell at you if you used different
   * types pretending to be the same one.
   *
   * Whatever value you pass to this will end up `PascalCased` when you see it later.
   *
   * Most use cases should never need to use this, I expect. This is exposed, however, in
   * case you're pulling in JSON Schema schemas from outside sources and need to do some
   * doctoring.
   */
  [SCHEMA_NAME_PROPERTY]: symbol;
}

/**
 * Decorates a `@sinclair/typebox` schema with a name for use in
 * `@eropple/fastify-openapi3`.
 *
 * If you decorate two separate types with the same `name`, this
 * will explode at speed. You have been warned. I will laugh.
 */
export function schemaType<T extends TSchema & CustomOptions>(
  name: string,
  type: T,
): T & TaggedSchema {
  // TypeBox 1.0: Preserve non-enumerable properties ~kind, ~readonly, ~optional
  // The spread operator strips these, so we copy them explicitly
  const result = {
    ...type,
    [SCHEMA_NAME_PROPERTY]: Symbol(pascalCase(name)),
  } as T & TaggedSchema;

  // Copy TypeBox 1.0 non-enumerable metadata properties
  /* eslint-disable @typescript-eslint/no-explicit-any */
  if ("~kind" in type) {
    Object.defineProperty(result, "~kind", {
      value: (type as any)["~kind"],
      enumerable: false,
    });
  }
  if ("~readonly" in type) {
    Object.defineProperty(result, "~readonly", {
      value: (type as any)["~readonly"],
      enumerable: false,
    });
  }
  if ("~optional" in type) {
    Object.defineProperty(result, "~optional", {
      value: (type as any)["~optional"],
      enumerable: false,
    });
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return result;
}
