import {
  CallbacksObject,
  ExternalDocumentationObject,
  InfoObject,
  OpenApiBuilder,
  OpenAPIObject,
  OperationObject,
} from "openapi3-ts";
import { OperationIdFn } from "./operation-helpers";

export type OASBuilderFn = (oas: OpenApiBuilder) => void;

export interface OAS3PluginPublishOptions {
  ui?: null | "rapidoc";
  json?: boolean;
  yaml?: boolean;
}

export interface OAS3PluginOptions {
  /**
   * The location where the API's documentation should be mounted.
   * Defaults to `/docs`.
   */
  prefix?: string;

  /**
   * The base OpenAPI document information. Will be added verbatim
   * to the OpenAPI document.
   */
  openapiInfo: InfoObject;

  /**
   * Invoked during plugin construction, before any routes are walked.
   */
  preParse?: OASBuilderFn;

  /**
   * Invoked just before server startup, when all routes have been established.
   */
  postParse?: OASBuilderFn;

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
  description: string;
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

  responses?: OAS3ResponseTable<OAS3RouteResponseFields>;
}
