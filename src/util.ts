import {
  isReferenceObject,
  isSchemaObject,
  ReferenceObject,
  SchemaObject,
} from "openapi3-ts";
import { Falsy, isFalsy, isPrimitive, Primitive } from "utility-types";

import { SCHEMA_NAME_PROPERTY } from "./constants.js";
import { TaggedSchema } from "./schemas.js";

export function isTruthy<T extends Exclude<any, Falsy>>(
  item: T | null | undefined
): item is Exclude<T, Falsy> {
  return !isFalsy(item);
}

export function isNotPrimitive(item: any): item is Exclude<any, Primitive> {
  return !isPrimitive(item);
}

export function isNotReferenceObject<
  T,
  U extends T | ReferenceObject = T | ReferenceObject,
>(item: U): item is Exclude<U, ReferenceObject> {
  return !isReferenceObject(item);
}

export function isTaggedSchema(t: any): t is SchemaObject & TaggedSchema {
  return isSchemaObject(t) && typeof t[SCHEMA_NAME_PROPERTY] === "symbol";
}

export function findMissingEntries<T extends object, U extends object>(
  mainObject: T,
  comparisonObject: U | null | undefined
): (keyof T)[] {
  return Object.keys(mainObject).filter(key =>
    !(comparisonObject && key in comparisonObject)
  ) as (keyof T)[];
}
