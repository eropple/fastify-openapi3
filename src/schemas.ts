import { type CustomOptions, type TSchema } from "@sinclair/typebox";
import { pascalCase } from "change-case";

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
  type: T
): T & TaggedSchema {
  return { ...type, [SCHEMA_NAME_PROPERTY]: Symbol(pascalCase(name)) };
}
