import { SCHEMA_NAME_PROPERTY } from "../constants.js";
import { TaggedSchemaObject } from "./oas-helpers.js";

/**
 * Recursive function to untangle all these schemas.
 *
 * Once a schema is visited, its symbol (NOT its string name) is put in
 * `seenSet`. This allows for bailing out if we get caught in a loop.
 *
 * Once a schema is canonicalized (for the first time), it should be placed
 * in `completed`.
 * @param current
 * @param completed
 * @param seenSet
 */
function canonicalizeSchema(
  current: TaggedSchemaObject,
  completed: Record<string, TaggedSchemaObject>,
  seenSet: Set<symbol>
) {
  const tag = current[SCHEMA_NAME_PROPERTY];
  if (!tag) {
    throw new Error(
      `Should never happen - tagged schema w/o tag? ${JSON.stringify(current)}`
    );
  }
  if (!tag.description || tag.description.length < 1) {
    throw new Error("all schemas must be tagged with a non-empty string name");
  }

  // must not be in the seen set or we're in a loop
  if (seenSet.has(tag)) {
    throw new Error(`Duplicate schema found with name '${tag.description}'.`);
  }

  // since now we're starting our operation, we add to the seen set
  seenSet.add(tag);

  // `completed` uses strings to catch ourselves if we create two tagged schemas
  // with the same human name. so let's check that.
  const existing = completed[tag.description];
  if (existing) {
    if (existing[SCHEMA_NAME_PROPERTY] !== tag) {
      throw new Error(
        `Duplicate schemas found with tag '${tag.description}':

        ${JSON.stringify(existing)}

        ${JSON.stringify(current)}`
      );
    }

    // it's already completed, and it's us, so we'll fall through to the end.
  } else {
    // it is NOT already completed, so let's add ourselves.

    completed[tag.description] = current;
  }

  // and now that we have completed our work, we remove ourselves from the seen set
  seenSet.delete(tag);
}

export function canonicalizeSchemas(
  schemas: Array<TaggedSchemaObject>
): Record<string, TaggedSchemaObject> {
  const canonicalizedSchemas: Record<string, TaggedSchemaObject> = {};
  const seenSet = new Set<symbol>();

  schemas.forEach((s) => canonicalizeSchema(s, canonicalizedSchemas, seenSet));
  return canonicalizedSchemas;
}
