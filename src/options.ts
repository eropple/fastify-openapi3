import {
  CallbacksObject,
  ExternalDocumentationObject,
  InfoObject,
  OpenApiBuilder,
  OpenAPIObject,
  OperationObject,
  ParameterStyle,
} from "openapi3-ts";

import { OperationIdFn } from "./operation-helpers.js";

export type OASBuilderFn = (oas: OpenApiBuilder) => void;

export interface OAS3PluginPublishOptions {
  /**
   * If `'rapidoc'`, serves a Rapidoc UI at `/docs`.
   *
   * If `null`, does not serve any explorer UI at all.
   *
   * Defaults to `'rapidoc'`.
   */
  ui?: "rapidoc" | null;
  /**
   * Serves a JSON version of your OpenAPI specification. If a string
   * is passed, that will be the path of the JSON file (otherwise, it
   * defaults to `openapi.json`).
   *
   * To skip, pass `false`.
   */
  json?: boolean | string;
  /**
   * Serves a YAML version of your OpenAPI specification. If a string
   * is passed, that will be the path of the YAML file (otherwise, it
   * defaults to `openapi.yaml`).
   *
   * To skip, pass `false`.
   */
  yaml?: boolean | string;
}

export interface OAS3PluginOptions {
  /**
   * The base OpenAPI document information. Will be added verbatim
   * to the OpenAPI document.
   */
  openapiInfo: InfoObject;

  /**
   * If set to true, will throw an error if started with an invalid OpenAPI3
   * document.
   */
  exitOnInvalidDocument?: boolean;

  /**
   * Invoked during plugin construction, before any routes are walked.
   */
  preParse?: OASBuilderFn;

  /**
   * Invoked just before server startup, when all routes have been established.
   */
  postParse?: OASBuilderFn;

  /**
   * Determines how the OpenAPI specification will be parsed and specified for
   * this package.
   */
  publish?: OAS3PluginPublishOptions;

  /**
   * If `false` (the default), the plugin will not include operations where
   * `oas` is undefined. This can be useful in cases where plugins add routes
   * that you'd like to avoid including, but cannot be practically placed
   * outside of the current scope.
   */
  includeUnconfiguredOperations?: boolean;

  /**
   * If you don't provide an operationId on a route, this function will be
   * invoked to try to figure it out. It's probably not great. Be explicit!
   */
  operationIdNameFn?: OperationIdFn;
}

export type OAS3ResponseTable<T> = {
  [k: string]: T;
};

export type OAS3RouteResponseFields = {
  description?: string;
  contentType?: string;
  schemaOverride?: any;
};

export type OAS3RequestBodyInfo = {
  description?: string;
  contentType?: string;
  schemaOverride?: any;
}

export type OAS3QueryParamExtras = {
  deprecated?: boolean;
  description?: string;
  example?: any;
  allowEmptyValue?: boolean;
  allowReserved?: boolean;
  style?: ParameterStyle;
  explode?: boolean;
  schemaOverride?: any;
}
export type OAS3PathParamExtras = {
  description?: string;
  example?: any;
  schemaOverride?: any;
};

export interface OAS3RouteOptions {
  operationId?: string;
  tags?: string[];
  summary?: string;
  description?: string;
  deprecated?: boolean;
  externalDocs?: ExternalDocumentationObject;
  callbacks?: CallbacksObject;

  /**
   * If true, no data about this route will be collated for the OpenAPI document.
   */
  omit?: boolean;

  /**
   * Any fields set here will be merged into the OpenAPI operation object.
   */
  custom?: Record<string, any>;


  body?: OAS3RequestBodyInfo;

  querystring?: Record<string, OAS3QueryParamExtras>;
  params?: Record<string, OAS3PathParamExtras>;

  responses?: OAS3ResponseTable<OAS3RouteResponseFields>;
}
