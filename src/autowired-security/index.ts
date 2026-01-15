import {
  type FastifyBaseLogger,
  type RouteOptions,
  type FastifyRequest,
} from "fastify";
import { type preValidationMetaHookHandler } from "fastify/types/hooks.js";
import { type OpenApiBuilder } from "openapi3-ts";

import { OAS3PluginError } from "../errors.js";

import { buildSecurityHookHandler } from "./hook-handler-builder.js";
import {
  type WrappedHandler,
  type HandlerRetval,
  buildApiKeyHandler,
  buildHttpBasicHandler,
  buildHttpBearerHandler,
} from "./types/handlers.js";
import {
  type OAS3RouteSecuritySchemeSpec,
  type OAS3AutowireSecurityOptions,
  type OAS3PluginSecurityScheme,
} from "./types/index.js";

export * from "./types/index.js";

export function validateOptions(
  logger: FastifyBaseLogger,
  options: OAS3AutowireSecurityOptions | undefined
) {
  if (!options || options.disabled) {
    logger.info("OAS plugin autowire is disabled.");
    return;
  }

  for (const [name, scheme] of Object.entries(options.securitySchemes)) {
    // TODO:  consider supporting "openIdConnect" and "oauth2"
    //        This is low-priority for me as I think these affordances don't work
    //        very well in the only place they really matter (try-it-out docs), and
    //        you can use HTTP bearer instead. PRs welcome.

    // @ts-expect-error this is basically a JS check
    if (scheme.type === "oauth2" || scheme.type === "openIdConnect") {
      // @ts-expect-error still a JS check
      const msg = `Security scheme type "${scheme.type}" is not supported. Consider using "bearer" or "apiKey" instead.`;

      if (options.allowUnrecognizedSecurity) {
        logger.warn({ securitySchemeName: name }, msg + " Ignoring.");
      } else {
        throw new OAS3PluginError(msg);
      }
    }

    // TODO:  support non-"header" locations for "apiKey"
    //        I just don't need it, so I haven't done it. PRs welcome.
    if (
      scheme.type === "apiKey" &&
      scheme.in !== "header" &&
      scheme.in !== "cookie"
    ) {
      const msg = `Security scheme type "${scheme.type}" requires "in" to be "header" or "cookie".`;
    }
  }
}

/**
 * Attaches all known security schemes to the OAS document.
 */
export function attachSecuritySchemesToDocument(
  logger: FastifyBaseLogger,
  doc: OpenApiBuilder,
  options: OAS3AutowireSecurityOptions
) {
  for (const [name, scheme] of Object.entries(options.securitySchemes)) {
    const sanitized: Omit<OAS3PluginSecurityScheme, "fn"> & { fn?: unknown } = {
      ...scheme,
    };
    delete sanitized.fn;
    delete sanitized.passNullIfNoneProvided;
    delete sanitized.requiresParsedBody;

    logger.debug(`Attaching security scheme: ${name} (type: ${scheme.type}).`);
    doc.addSecurityScheme(name, sanitized);
  }
}

/**
 * Investigates a provided route and attaches a `preValidation` handler that evaluates
 * the given security scheme(s) for the route according to the OAS specification.
 */
export function attachSecurityToRoute(
  rLog: FastifyBaseLogger,
  route: RouteOptions,
  options: OAS3AutowireSecurityOptions,
  hookCache: Record<string, preValidationMetaHookHandler>
) {
  if (options.disabled) {
    rLog.trace("Autowire disabled; skipping.");
    return;
  }

  const routeSecurity = route.oas?.security;

  // If security is explicitly set to empty array, skip all security
  if (Array.isArray(routeSecurity) && routeSecurity.length === 0) {
    rLog.debug("Route security explicitly disabled; skipping.");
    return;
  }

  // Use route security if defined, otherwise fall back to root security
  let security = routeSecurity ?? options.rootSecurity;

  // If no security defined at either level
  if (!security) {
    if (!options.allowEmptySecurityWithNoRoot) {
      throw new OAS3PluginError(
        `Route ${route.method} ${route.url} has no security defined, and rootSecurity is not defined. If this is intentional, set \`allowEmptySecurityWithNoRoot\` to true.`
      );
    }
    rLog.debug("No security defined at any level; skipping.");
    return;
  }

  // Normalize to array format
  if (!Array.isArray(security)) {
    security = [security];
  }

  // Create and cache the hook handler
  const cacheKey = JSON.stringify(security);
  let hookHandler = hookCache[cacheKey];
  if (!hookHandler) {
    hookHandler = buildSecurityHookHandler(rLog, security, options);
    hookCache[cacheKey] = hookHandler;
  }

  // Add the security hook
  const existingPreValidationHooks = route.preValidation;
  const newPreValidationHooks: Array<preValidationMetaHookHandler> = [
    hookHandler,
  ];
  if (Array.isArray(existingPreValidationHooks)) {
    newPreValidationHooks.push(
      ...existingPreValidationHooks.filter((f) => f !== hookHandler)
    );
  }

  rLog.debug(
    {
      routeHookCount: newPreValidationHooks.length,
      securitySchemes: security,
    },
    "Adding security hook to route."
  );

  route.preValidation = newPreValidationHooks;
}
