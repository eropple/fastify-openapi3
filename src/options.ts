/* eslint-disable @typescript-eslint/no-explicit-any */
import { type RouteOptions } from "fastify";
import {
  type CallbacksObject,
  type ExternalDocumentationObject,
  type InfoObject,
  type OpenApiBuilder,
  OpenAPIObject,
  OperationObject,
  type ParameterStyle,
  type PathItemObject,
} from "openapi3-ts";

import {
  type OAS3RouteSecuritySchemeSpec,
  type OAS3AutowireSecurityOptions,
} from "./autowired-security/index.js";
import { type OperationIdFn } from "./operation-helpers.js";

export type OASBuilderFn = (oas: OpenApiBuilder) => void;
export type PathItemFn = (
  route: RouteOptions,
  pathItem: PathItemObject
) => void;

export interface OAS3PluginPublishOptions {
  /**
   * If `'rapidoc'`, serves a Rapidoc UI at `uiPath`.
   *
   * If `'scalar'`, serves a Scalar UI at `uiPath`.
   *
   * If `null`, does not serve any explorer UI at all.
   *
   * Defaults to `'rapidoc'`. This WILL change in the future.
   */
  ui?: "rapidoc" | "scalar" | null;

  /**
   * The path for the explorer UI. Defaults to `/docs`.
   */
  uiPath?: string;

  /**
   * Additional options to pass to the Scalar UI. Obviously doesn't
   * do anything if `ui` is not `'scalar'`.
   */
  scalarExtraOptions?: Record<string, any>;

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
   * Invoked after a route has been turned into a pathItem.
   */
  postPathItemBuild?: PathItemFn;

  /**
   * Invoked just before server startup, when all routes have been established.
   */
  postParse?: OASBuilderFn;

  /**
   * Controls automatically wiring up security schemes to `onRequest` hooks for
   * routes that specify `securityScheme`s.
   *
   * If this is unset, NO wireup will be done. You can still assign `securityScheme`s
   * to routes, but you'll need to hande security scheme implementation yourself.
   */
  autowiredSecurity?: OAS3AutowireSecurityOptions;

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
};

export type OAS3QueryParamExtras = {
  deprecated?: boolean;
  description?: string;
  example?: any;
  allowEmptyValue?: boolean;
  allowReserved?: boolean;
  style?: ParameterStyle;
  explode?: boolean;
  schemaOverride?: any;
};
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
   * The set of OAS securitySchemes to use for this route.
   * **NOTE:** security schemes **will** still be processed when `omit: true`.
   */
  security?: OAS3RouteSecuritySchemeSpec | Array<OAS3RouteSecuritySchemeSpec>;

  /**
   * If true, no data about this route will be collated for the OpenAPI document.
   * **NOTE:** security schemes **will** still be processed!
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
