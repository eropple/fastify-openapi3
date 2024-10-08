import { type FastifyRequest, type FastifyInstance } from "fastify";

import { decodeBasicAuthHeader } from "../../util.js";

import {
  type BearerSecurityScheme,
  type ApiKeySecurityScheme,
  type BasicAuthSecurityScheme,
} from "./security-schemes.js";

export type HandlerRetval = { ok: true } | { ok: false; code: 401 | 403 };
export const HandlerRetvalReason = Object.freeze({
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
});

export type WrappedHandler = (
  request: FastifyRequest
) => HandlerRetval | Promise<HandlerRetval>;

export type ApiKeyHandlerFn = (
  value: string,
  request: FastifyRequest
) => HandlerRetval | Promise<HandlerRetval>;

export type HttpBearerFn = ApiKeyHandlerFn;

export type HttpBasicHandlerFn = (
  credentials: { username: string; password: string },
  request: FastifyRequest
) => HandlerRetval | Promise<HandlerRetval>;

export function buildApiKeyHandler(
  scheme: ApiKeySecurityScheme
): WrappedHandler {
  const schemeName = scheme.name.toLowerCase();

  switch (scheme.in) {
    case "header":
      return (request) => {
        request.log.trace("Entering API key handler.");
        try {
          const headers = request.headers[schemeName];
          const header = Array.isArray(headers) ? headers[0] : headers;

          if (!header) {
            return { ok: false, code: 401 };
          }

          return scheme.fn(header, request);
        } catch (err) {
          request.log.warn({ err }, "Uncaught error in API key handler.");
          return { ok: false, code: 401 };
        }
      };
    default:
      throw new Error(`Unsupported API key location: ${scheme.in}`);
  }
}

export function buildHttpBasicHandler(
  scheme: BasicAuthSecurityScheme
): WrappedHandler {
  return (request) => {
    try {
      const headers = request.headers.authorization;
      const header = Array.isArray(headers) ? headers[0] : headers;

      const credentials = decodeBasicAuthHeader(header);
      if (!credentials) {
        return { ok: false, code: 401 };
      }

      return scheme.fn(credentials, request);
    } catch (err) {
      request.log.warn({ err }, "Uncaught error in HTTP basic auth handler.");
      return { ok: false, code: 401 };
    }
  };
}

export function buildHttpBearerHandler(
  scheme: BearerSecurityScheme
): WrappedHandler {
  return (request) => {
    try {
      const headers = request.headers.authorization;
      const header = Array.isArray(headers) ? headers[0] : headers;

      // Check if the Authorization header starts with 'Bearer '
      if (!header.startsWith("Bearer ")) {
        return { ok: false, code: 401 };
      }

      // Strip off 'Bearer ' and get the token
      const token = header.slice(7);

      // Call the handler function provided in the BearerSecurityScheme
      return scheme.fn(token, request);
    } catch (err) {
      request.log.warn({ err }, "Uncaught error in HTTP bearer handler.");
      return { ok: false, code: 401 };
    }
  };
}
