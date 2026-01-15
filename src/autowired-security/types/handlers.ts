import { type FastifyRequest } from "fastify";

import { decodeBasicAuthHeader } from "../../util.js";

import {
  type ApiKeySecurityScheme,
  type BasicAuthSecurityScheme,
  type BearerSecurityScheme,
  type SecurityHandlerContext,
} from "./security-schemes.js";

/**
 * The returned value from a security handler.
 */
export type HandlerRetval = { ok: true } | { ok: false; code: 401 | 403 };
export const HandlerRetvalReason = Object.freeze({
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
});

/**
 * A wrapped handler to be used as a Fastify preValidation hook.
 */
export type WrappedHandler = (
  request: FastifyRequest
) => HandlerRetval | Promise<HandlerRetval>;

/**
 * ----- API Key Handler Builder -----
 */
export function buildApiKeyHandler(
  scheme: ApiKeySecurityScheme
): WrappedHandler {
  const schemeName = scheme.name.toLowerCase();

  return (request: FastifyRequest) => {
    request.log.trace("Entering API key handler.");
    try {
      const context: SecurityHandlerContext | undefined =
        scheme.requiresParsedBody ? { body: request.body } : undefined;

      let value: string | undefined;
      switch (scheme.in) {
        case "header": {
          const headers = request.headers[schemeName];
          value = Array.isArray(headers) ? headers[0] : headers;
          break;
        }
        case "cookie": {
          const cookies = request.cookies; // May be undefined if cookie plugin is not registered.
          value = cookies ? cookies[schemeName] : undefined;
          break;
        }
        default:
          throw new Error(`Unsupported API key location: ${scheme.in}`);
      }

      if (value === undefined || value === null) {
        if (scheme.passNullIfNoneProvided) {
          return scheme.fn(null, request, context);
        } else {
          return { ok: false, code: 401 };
        }
      }
      return scheme.fn(value, request, context);
    } catch (err) {
      request.log.warn({ err }, "Uncaught error in API key handler.");
      return { ok: false, code: 401 };
    }
  };
}

/**
 * ----- HTTP Basic Handler Builder -----
 */
export function buildHttpBasicHandler(
  scheme: BasicAuthSecurityScheme
): WrappedHandler {
  return (request) => {
    try {
      const context: SecurityHandlerContext | undefined =
        scheme.requiresParsedBody ? { body: request.body } : undefined;

      const headers = request.headers.authorization;
      const header = Array.isArray(headers) ? headers[0] : headers;

      // If no Authorization header exists
      if (!header) {
        if (scheme.passNullIfNoneProvided) {
          return scheme.fn(null, request, context);
        } else {
          return { ok: false, code: 401 };
        }
      }

      // At this point we have a header, so try to decode it
      const credentials = decodeBasicAuthHeader(header);
      if (!credentials) {
        // Malformed header - always return 401
        return { ok: false, code: 401 };
      }

      // Valid header format, let handler validate the credentials
      return scheme.fn(credentials, request, context);
    } catch (err) {
      request.log.warn({ err }, "Uncaught error in HTTP basic auth handler.");
      return { ok: false, code: 401 };
    }
  };
}

/**
 * ----- HTTP Bearer Handler Builder -----
 */
export function buildHttpBearerHandler(
  scheme: BearerSecurityScheme
): WrappedHandler {
  return (request: FastifyRequest) => {
    try {
      const context: SecurityHandlerContext | undefined =
        scheme.requiresParsedBody ? { body: request.body } : undefined;

      const headers = request.headers.authorization;
      const header = Array.isArray(headers) ? headers[0] : headers;
      if (!header || !header.startsWith("Bearer ")) {
        if (scheme.passNullIfNoneProvided) {
          return scheme.fn(null, request, context);
        } else {
          return { ok: false, code: 401 };
        }
      }
      const token = header.slice(7);
      return scheme.fn(token, request, context);
    } catch (err) {
      request.log.warn({ err }, "Uncaught error in HTTP bearer handler.");
      return { ok: false, code: 401 };
    }
  };
}
