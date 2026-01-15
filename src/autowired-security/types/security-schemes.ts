import { type FastifyRequest } from "fastify";

import { type HandlerRetval } from "./handlers.js";

/**
 * Context passed to security handlers that have `requiresParsedBody: true`.
 * Contains the parsed request body, available because security handlers
 * now run in the `preValidation` hook (after body parsing).
 */
export type SecurityHandlerContext = {
  body: unknown;
};

/**
 * Primary handler type aliases.
 * The optional third parameter `context` is provided when `requiresParsedBody: true`.
 */
export type ApiKeyHandlerFn = (
  value: string,
  request: FastifyRequest,
  context?: SecurityHandlerContext
) => HandlerRetval | Promise<HandlerRetval>;
export type HttpBasicHandlerFn = (
  credentials: { username: string; password: string },
  request: FastifyRequest,
  context?: SecurityHandlerContext
) => HandlerRetval | Promise<HandlerRetval>;
export type HttpBearerFn = ApiKeyHandlerFn;

/**
 * Secondary (nullable) handler type aliases.
 * The optional third parameter `context` is provided when `requiresParsedBody: true`.
 */
export type NullableApiKeyHandlerFn = (
  value: string | null,
  request: FastifyRequest,
  context?: SecurityHandlerContext
) => HandlerRetval | Promise<HandlerRetval>;
export type NullableHttpBasicHandlerFn = (
  credentials: { username: string; password: string } | null,
  request: FastifyRequest,
  context?: SecurityHandlerContext
) => HandlerRetval | Promise<HandlerRetval>;
export type NullableHttpBearerFn = NullableApiKeyHandlerFn;

/**
 * ----- API Key Security Scheme -----
 */
export type ApiKeySecuritySchemeBase = {
  type: "apiKey";
  name: string;
  description?: string;
  in: "header" | "query" | "cookie";
};

export type ApiKeySecuritySchemeStrict = ApiKeySecuritySchemeBase & {
  passNullIfNoneProvided?: false;
  requiresParsedBody?: boolean;
  fn: ApiKeyHandlerFn;
};

export type ApiKeySecuritySchemeNullable = ApiKeySecuritySchemeBase & {
  passNullIfNoneProvided: true;
  requiresParsedBody?: boolean;
  fn: NullableApiKeyHandlerFn;
};

export type ApiKeySecurityScheme =
  | ApiKeySecuritySchemeStrict
  | ApiKeySecuritySchemeNullable;

/**
 * ----- HTTP Basic Security Scheme -----
 */
export type BasicAuthSecuritySchemeBase = {
  type: "http";
  scheme: "basic";
  description?: string;
};

export type BasicAuthSecuritySchemeStrict = BasicAuthSecuritySchemeBase & {
  passNullIfNoneProvided?: false;
  requiresParsedBody?: boolean;
  fn: HttpBasicHandlerFn;
};

export type BasicAuthSecuritySchemeNullable = BasicAuthSecuritySchemeBase & {
  passNullIfNoneProvided: true;
  requiresParsedBody?: boolean;
  fn: NullableHttpBasicHandlerFn;
};

export type BasicAuthSecurityScheme =
  | BasicAuthSecuritySchemeStrict
  | BasicAuthSecuritySchemeNullable;

/**
 * ----- HTTP Bearer Security Scheme -----
 */
export type BearerSecuritySchemeBase = {
  type: "http";
  scheme: "bearer";
  description?: string;
};

export type BearerSecuritySchemeStrict = BearerSecuritySchemeBase & {
  passNullIfNoneProvided?: false;
  requiresParsedBody?: boolean;
  fn: HttpBearerFn;
};

export type BearerSecuritySchemeNullable = BearerSecuritySchemeBase & {
  passNullIfNoneProvided: true;
  requiresParsedBody?: boolean;
  fn: NullableHttpBearerFn;
};

export type BearerSecurityScheme =
  | BearerSecuritySchemeStrict
  | BearerSecuritySchemeNullable;

/**
 * Exported union type for all supported schemes.
 */
export type OAS3PluginSecurityScheme =
  | ApiKeySecurityScheme
  | BasicAuthSecurityScheme
  | BearerSecurityScheme;
