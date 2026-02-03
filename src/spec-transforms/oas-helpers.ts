import type {
  OpenAPIObject,
  OperationObject,
  PathItemObject,
  ReferenceObject,
  SchemaObject,
} from "openapi3-ts";

import type { TaggedSchema } from "../schemas.js";
import { isNotReferenceObject, isTruthy } from "../util.js";

export type TaggedSchemaObject = SchemaObject & TaggedSchema;
export type MaybeSchemaHolder = { schema?: SchemaObject | ReferenceObject };
export type SchemaHolder = { schema: SchemaObject | ReferenceObject };

export function operations(path: PathItemObject): Array<OperationObject> {
  return [
    path.get,
    path.put,
    path.post,
    path.delete,
    path.options,
    path.head,
    path.patch,
    path.trace,
  ].filter(isTruthy);
}

export function mapPathItems<T>(
  oas: OpenAPIObject,
  fn: (path: PathItemObject) => T,
): Array<T> {
  return Object.values(oas.paths || {})
    .filter(isNotReferenceObject)
    .flatMap(fn);
}
