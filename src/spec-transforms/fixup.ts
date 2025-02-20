import {
  type CallbackObject,
  isSchemaObject,
  type OpenAPIObject,
  type PathItemObject,
  type ReferenceObject,
  type ResponseObject,
  type SchemaObject,
} from "openapi3-ts";

import { APPLICATION_JSON, SCHEMA_NAME_PROPERTY } from "../constants.js";
import { type TaggedSchema } from "../schemas.js";
import { isNotReferenceObject, isTaggedSchema } from "../util.js";

import {
  mapPathItems,
  type MaybeSchemaHolder,
  operations,
} from "./oas-helpers.js";

function refFromTaggedSchema(s: TaggedSchema): ReferenceObject {
  return {
    $ref: `#/components/schemas/${s[SCHEMA_NAME_PROPERTY].description}`,
  };
}

function fixupSchemaHolder(s: MaybeSchemaHolder): void {
  if (s.schema) {
    if (isSchemaObject(s.schema)) {
      fixupReferencesInSchema(s.schema);
    }

    if (isTaggedSchema(s.schema)) {
      s.schema = refFromTaggedSchema(s.schema);
    }
  }
}

function fixupReferencesInSchema(s: SchemaObject) {
  if (s.allOf) {
    s.allOf = s.allOf.map((s2) => {
      if (isSchemaObject(s2)) {
        fixupReferencesInSchema(s2);
      }

      return isTaggedSchema(s2) ? refFromTaggedSchema(s2) : s2;
    });
  }

  if (s.anyOf) {
    s.anyOf = s.anyOf.map((s2) => {
      if (isSchemaObject(s2)) {
        fixupReferencesInSchema(s2);
      }
      return isTaggedSchema(s2) ? refFromTaggedSchema(s2) : s2;
    });
  }

  if (
    typeof s.additionalProperties === "object" &&
    isSchemaObject(s.additionalProperties)
  ) {
    fixupReferencesInSchema(s.additionalProperties);

    if (isTaggedSchema(s.additionalProperties)) {
      s.additionalProperties = refFromTaggedSchema(s.additionalProperties);
    }
  }

  if (typeof s.items === "object" && isSchemaObject(s.items)) {
    fixupReferencesInSchema(s.items);

    if (isTaggedSchema(s.items)) {
      s.items = refFromTaggedSchema(s.items);
    }
  }

  if (s.properties) {
    for (const propKey in s.properties) {
      const s2 = s.properties[propKey];
      if (isSchemaObject(s2)) {
        fixupReferencesInSchema(s2);
      }
      s.properties[propKey] = isTaggedSchema(s2) ? refFromTaggedSchema(s2) : s2;
    }
  }
}

function fixupPathItems(p: PathItemObject) {
  p?.parameters?.filter(isNotReferenceObject)?.forEach(fixupSchemaHolder);

  operations(p).forEach((oper) => {
    oper?.parameters?.filter(isNotReferenceObject)?.forEach(fixupSchemaHolder);

    if (oper.requestBody && isNotReferenceObject(oper.requestBody)) {
      const content = oper.requestBody.content ?? {};
      for (const [_mediaType, responseContent] of Object.entries(content)) {
        if (responseContent) {
          fixupSchemaHolder(responseContent);
        }
      }
    }

    const r = oper.responses;
    if (r) {
      Object.keys(r)
        .map((k) => r[k] as ResponseObject | ReferenceObject)
        .filter(isNotReferenceObject)
        .forEach((resp) => {
          const content = resp?.content ?? {};

          for (const [_mediaType, responseContent] of Object.entries(
            content ?? {}
          )) {
            if (responseContent) {
              fixupSchemaHolder(responseContent);
            }
          }
        });
    }

    const c = oper.callbacks ?? {};
    Object.keys(c)
      .map((k) => c[k] as CallbackObject | ReferenceObject)
      .filter(isNotReferenceObject)
      .forEach((cbs) =>
        // again with the gross reentrancy
        (Object.values(cbs) as Array<PathItemObject>).forEach(fixupPathItems)
      );
  });
}

export function fixupSpecSchemaRefs(oas: OpenAPIObject): void {
  // first, top level schemas
  Object.values(oas.components!.schemas!)
    .filter(isSchemaObject)
    .forEach(fixupReferencesInSchema);

  // then, everything else
  mapPathItems(oas, fixupPathItems);
}
