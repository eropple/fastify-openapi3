import {
  isReferenceObject,
  isSchemaObject,
  type ReferenceObject,
  type SchemaObject,
} from "openapi3-ts";
import {
  type Falsy,
  isFalsy,
  isPrimitive,
  type Primitive,
} from "utility-types";

import { SCHEMA_NAME_PROPERTY } from "./constants.js";
import { type TaggedSchema } from "./schemas.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isTruthy<T extends Exclude<any, Falsy>>(
  item: T | null | undefined
): item is Exclude<T, Falsy> {
  return !isFalsy(item);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isNotPrimitive(item: any): item is Exclude<any, Primitive> {
  return !isPrimitive(item);
}

export function isNotReferenceObject<
  T,
  U extends T | ReferenceObject = T | ReferenceObject,
>(item: U): item is Exclude<U, ReferenceObject> {
  return !isReferenceObject(item);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isTaggedSchema(t: any): t is SchemaObject & TaggedSchema {
  return isSchemaObject(t) && typeof t[SCHEMA_NAME_PROPERTY] === "symbol";
}

export function findMissingEntries<T extends object, U extends object>(
  mainObject: T,
  comparisonObject: U | null | undefined
): (keyof T)[] {
  return Object.keys(mainObject).filter(
    (key) => !(comparisonObject && key in comparisonObject)
  ) as (keyof T)[];
}
