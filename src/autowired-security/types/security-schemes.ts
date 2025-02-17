import { type FastifyRequest } from "fastify";

import { type HandlerRetval } from "./handlers.js";

/**
 * Primary handler type aliases.
 */
export type ApiKeyHandlerFn = (
  value: string,
  request: FastifyRequest
) => HandlerRetval | Promise<HandlerRetval>;
export type HttpBasicHandlerFn = (
  credentials: { username: string; password: string },
  request: FastifyRequest
) => HandlerRetval | Promise<HandlerRetval>;
export type HttpBearerFn = ApiKeyHandlerFn;

/**
 * Secondary (nullable) handler type aliases.
 */
export type NullableApiKeyHandlerFn = (
  value: string | null,
  request: FastifyRequest
) => HandlerRetval | Promise<HandlerRetval>;
export type NullableHttpBasicHandlerFn = (
  credentials: { username: string; password: string } | null,
  request: FastifyRequest
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
  fn: ApiKeyHandlerFn;
};

export type ApiKeySecuritySchemeNullable = ApiKeySecuritySchemeBase & {
  passNullIfNoneProvided: true;
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
  fn: HttpBasicHandlerFn;
};

export type BasicAuthSecuritySchemeNullable = BasicAuthSecuritySchemeBase & {
  passNullIfNoneProvided: true;
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
  fn: HttpBearerFn;
};

export type BearerSecuritySchemeNullable = BearerSecuritySchemeBase & {
  passNullIfNoneProvided: true;
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
