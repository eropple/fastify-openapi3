import type { FastifyReply, FastifyRequest } from "fastify";

import type { HandlerRetval } from "./handlers.js";
import type { OAS3PluginSecurityScheme } from "./security-schemes.js";

export * from "./security-schemes.js";

export type OAS3RouteSecuritySchemeSpec = Record<string, Array<string>>;

export type OAS3AutowireRequestFailedHandler = (
  result: HandlerRetval & { ok: false },
  request: FastifyRequest,
  reply: FastifyReply,
) => void | Promise<void>;

export interface OAS3AutowireSecurityOptions {
  /**
   * If `true`, disables the automatic mapping of security schemes to
   * security interceptors. Defaults to `false`.
   */
  disabled?: boolean;

  /**
   * if `false`, will fail during startup if routes use security schemes that aren't
   * provided explicit security handlers. Defaults to `false`.
   *
   * This library **will** attempt to evaluate ones it recognizes still, so handling
   * the ones it doesn't is up to you.
   */
  allowUnrecognizedSecurity?: boolean;

  /**
   * if `false`, will fail during startup if routes don't specify security schemes
   * and `rootSecurity` is unset. Defaults to `true`.
   */
  allowEmptySecurityWithNoRoot?: boolean;

  /**
   * The set of OAS securitySchemes to use for ALL routes that do not have their
   * own `security`. These WILL be applied to routes that are `omit`ted.
   */
  rootSecurity?:
    | OAS3RouteSecuritySchemeSpec
    | Array<OAS3RouteSecuritySchemeSpec>;

  /**
   * The set of security schemes that should be invoked, and how. These values,
   * modulo
   */
  securitySchemes: Record<string, OAS3PluginSecurityScheme>;

  /**
   * Invoked when a request either comes back Unauthorized or Forbidden.
   * Defaults to a basic JSON response.
   */
  onRequestFailed?: OAS3AutowireRequestFailedHandler;
}
