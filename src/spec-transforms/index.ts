import { type OpenAPIObject } from "openapi3-ts";

import { isTaggedSchema } from "../util.js";

import { canonicalizeSchemas } from "./canonicalize.js";
import { findTaggedSchemas } from "./find.js";
import { fixupSpecSchemaRefs } from "./fixup.js";

/**
 * Functions that represent a transformation to be applied to a specification
 * after the plugin has generated it.
 *
 * These may be destructive (and then return the `oas` object
 * passed in) or pass an entirely new schema object, at your discretion.
 */
export type OASTransformFunction = (
  oas: OpenAPIObject
) => OpenAPIObject | Promise<OpenAPIObject>;

/**
 * Walks the OAS spec to find the plugin's extension tag on all schemas that it can reach
 * and extracts them to the top level `components`. This is recursive, so it does have a
 * theoretical stack depth, and also it has rudimentary cycle detection (and doesn't know
 * how to deal with them, but then again neither do many OAS generators--PRs welcome!).
 *
 * This _will_ explode, and loudly, if it finds two schemas with the same annotated name
 * that do not match.
 */
export const canonicalizeAnnotatedSchemas: OASTransformFunction = (oas) => {
  oas.components = oas.components ?? {};
  oas.components.schemas = oas.components.schemas ?? {};
  oas.components.callbacks = oas.components.callbacks ?? {};
  oas.components.requestBodies = oas.components.requestBodies ?? {};
  oas.components.parameters = oas.components.parameters ?? {};
  oas.components.responses = oas.components.responses ?? {};

  // step 1:  find all places where a tagged schema can be hiding out.
  const rootSchemas = findTaggedSchemas(oas).filter(isTaggedSchema);

  // step 2:  build the canonical schema map from all those tagged schemas. this
  //          will end up in our top-level `#/components/schemas`.
  const canonicalized = canonicalizeSchemas(rootSchemas);
  oas.components.schemas = {
    ...oas.components.schemas,
    ...canonicalized,
  };

  // step 3:  walk the doc again, this time touching everything that _isn't_ a
  //          top level schema. if we find a tagged schema, replace it with a
  //          JSON reference to the entry in `#/components`.
  fixupSpecSchemaRefs(oas);

  // step 4:  clean up all the "not-JSON" stuff so users aren't confused later when
  //          they see a "JSON specification" with symbols, etc. in it.
  oas = JSON.parse(JSON.stringify(oas));

  return oas;
};
