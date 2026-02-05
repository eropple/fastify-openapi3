import type {
  CallbackObject,
  CallbacksObject,
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  ResponsesObject,
  SchemaObject,
} from "openapi3-ts";
import { isFalsy } from "utility-types";

import {
  isNotPrimitive,
  isNotReferenceObject,
  isTaggedSchema,
} from "../util.js";

import {
  mapPathItems,
  operations,
  type TaggedSchemaObject,
} from "./oas-helpers.js";

function findTaggedSchemasInSchemas(
  s: SchemaObject,
): Array<TaggedSchemaObject> {
  // TODO:  remove duplication
  //        This method isn't optimal. It returns the same schemas multiple times
  //        if they're nested. This isn't the worst thing in the world, because
  //        they get deduplicated later and we are not dealing with large N here,
  //        but it does add time to plugin startup.

  // Empty schemas {} are valid in OAS 3.1 (JSON Schema 2020-12) and mean "any value".
  // TypeBox's Type.Any() and Type.Unknown() both produce {}.
  // These schemas have no nested content to search, so return early.
  if (isFalsy(s.type) && !s.allOf && !s.anyOf && !s.oneOf && !s.properties) {
    return isTaggedSchema(s) ? [s] : [];
  }

  // Note: We check s.type === 'array' directly instead of using Type.IsArray(s)
  // because Fastify's schema processing strips TypeBox's internal ~kind property,
  // which Type.IsArray relies on. By checking the JSON Schema type directly,
  // we ensure this works even after Fastify processes the schema.
  const isArraySchema = s.type === "array" && s.items !== undefined;

  const ret = [
    s.allOf ?? [],
    s.anyOf ?? [],
    s.oneOf ?? [],
    Object.values(s.properties ?? {}),
    s.additionalProperties,
    isArraySchema && [s.items],
  ]
    .flat()
    .filter(isNotPrimitive)
    .flatMap(findTaggedSchemasInSchemas);

  if (isTaggedSchema(s)) {
    ret.push(s);
  }

  return ret;
}

function findTaggedSchemasInResponse(
  r: ResponseObject,
): Array<TaggedSchemaObject> {
  const ret: Array<TaggedSchemaObject> = [];

  const content = r?.content ?? {};

  for (const [_mediaType, responseContent] of Object.entries(content)) {
    if (responseContent.schema && isTaggedSchema(responseContent.schema)) {
      ret.push(responseContent.schema);
    }
  }

  return ret;
}

function findTaggedSchemasInResponses(
  r: ResponsesObject,
): Array<TaggedSchemaObject> {
  return Object.keys(r)
    .map((k) => r[k] as ResponseObject | ReferenceObject)
    .filter(isNotReferenceObject)
    .flatMap(findTaggedSchemasInResponse);
}

function findTaggedSchemasInCallbacks(
  c: CallbacksObject,
): Array<TaggedSchemaObject> {
  return (
    Object.keys(c)
      .map((k) => c[k] as CallbackObject | ReferenceObject)
      .filter(isNotReferenceObject)
      .flatMap((cb) => Object.values(cb) as Array<PathItemObject>)
      .flatMap((p) => operations(p))
      // oh yeah, btw, this is _recursive_, ugh
      .flatMap((o) => findTaggedSchemasInOperation(o))
  );
}

function findTaggedSchemasInRequestBody(
  rb: RequestBodyObject,
): Array<TaggedSchemaObject> {
  const ret: Array<TaggedSchemaObject> = [];

  for (const [k, v] of Object.entries(rb.content ?? {})) {
    const bodySchema = v.schema;

    if (bodySchema && isTaggedSchema(bodySchema)) {
      ret.push(bodySchema);
    }
  }

  return ret;
}

function findTaggedSchemasInParameter(
  parameter: ParameterObject,
): Array<TaggedSchemaObject> {
  return [parameter]
    .filter(isNotReferenceObject)
    .map((param) => param.schema)
    .filter(isTaggedSchema);
}

function findTaggedSchemasInOperation(
  operation: OperationObject,
): Array<TaggedSchemaObject> {
  const ret: Array<TaggedSchemaObject> = [];

  // any operation parameter with a tag should be collected
  ret.push(
    ...(operation.parameters ?? [])
      .filter(isNotReferenceObject)
      .flatMap(findTaggedSchemasInParameter),
  );

  // request body (but only for JSON, everything else is outta scope)
  const { requestBody } = operation;
  if (requestBody && isNotReferenceObject(requestBody)) {
    ret.push(...findTaggedSchemasInRequestBody(requestBody));
  }

  // The type for responses is a little weird, but we'll get any JSON responses from it too.
  ret.push(...findTaggedSchemasInResponses(operation.responses ?? {}));

  // I have never used an OAS callback but by jove I'm not leaving you out in the cold
  ret.push(...findTaggedSchemasInCallbacks(operation.callbacks ?? {}));

  return ret;
}

function findTaggedSchemasInPathItem(
  path: PathItemObject,
): Array<TaggedSchemaObject> {
  const ret = operations(path).flatMap(findTaggedSchemasInOperation);

  if (path.parameters) {
    ret.push(
      ...path.parameters
        .filter(isNotReferenceObject)
        .flatMap(findTaggedSchemasInParameter),
    );
  }

  return ret;
}

export function findTaggedSchemas(
  oas: OpenAPIObject,
): Array<TaggedSchemaObject> {
  oas.components = oas.components ?? {};
  oas.components.schemas = oas.components.schemas ?? {};
  oas.components.callbacks = oas.components.callbacks ?? {};
  oas.components.requestBodies = oas.components.requestBodies ?? {};
  oas.components.parameters = oas.components.parameters ?? {};
  oas.components.responses = oas.components.responses ?? {};

  const rootSchemas: Array<TaggedSchemaObject> = [
    ...Object.values(oas.components.schemas).flatMap(
      findTaggedSchemasInSchemas,
    ),
  ];

  // walk all paths
  rootSchemas.push(...mapPathItems(oas, findTaggedSchemasInPathItem).flat());

  // now let's handle our other components
  rootSchemas.push(
    ...Object.values(oas.components.callbacks).flatMap(
      findTaggedSchemasInCallbacks,
    ),
    ...Object.values(oas.components.requestBodies)
      .filter(isNotReferenceObject)
      .flatMap(findTaggedSchemasInRequestBody),
    ...Object.values(oas.components.responses)
      .filter(isNotReferenceObject)
      .flatMap(findTaggedSchemasInResponse),
    ...Object.values(oas.components.parameters)
      .filter(isNotReferenceObject)
      .flatMap(findTaggedSchemasInParameter),
  );

  return rootSchemas.flatMap(findTaggedSchemasInSchemas);
}
