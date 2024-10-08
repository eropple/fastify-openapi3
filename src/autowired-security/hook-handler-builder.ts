import { type FastifyBaseLogger } from "fastify";
import {
  type onRequestAsyncHookHandler,
  type onRequestMetaHookHandler,
} from "fastify/types/hooks.js";

import {
  OAS3PluginError,
  OAS3RequestBadRequestError,
  OAS3RequestForbiddenError,
  OAS3RequestUnauthorizedError,
} from "../errors.js";

import {
  type HandlerRetval,
  type WrappedHandler,
  buildApiKeyHandler,
  buildHttpBasicHandler,
  buildHttpBearerHandler,
} from "./types/handlers.js";
import {
  type OAS3RouteSecuritySchemeSpec,
  type OAS3AutowireSecurityOptions,
  type OAS3AutowireRequestFailedHandler,
} from "./types/index.js";

type AndedHandlers = Array<[string, WrappedHandler]>;
type OrredHandlers = Array<AndedHandlers>;

export function buildSecurityHookHandler(
  rLog: FastifyBaseLogger,
  security: Array<OAS3RouteSecuritySchemeSpec>,
  options: OAS3AutowireSecurityOptions
): onRequestMetaHookHandler {
  // `security` is an array of objects. the keys of the sub-object are security scheme names.
  // the values of the sub-object are arrays of security scopes. until we implement OIDC/OAuth2,
  // we'll ignore the scopes; we just need to loop up the security scheme name in the
  // `securitySchemes` object.
  //
  // schemes in the same object are "and"ed together. all separate objects are "or"ed together.

  const orHandlers: OrredHandlers = [];

  for (const andedSchemes of security) {
    const andedHandlers: AndedHandlers = [];
    for (const [name, _scopes] of Object.entries(andedSchemes)) {
      const scheme = options.securitySchemes[name];

      if (!scheme) {
        rLog.warn(
          { securitySchemeName: name },
          "Unrecognized security scheme."
        );
        if (!options.allowUnrecognizedSecurity) {
          throw new OAS3PluginError(`Security scheme "${name}" not defined.`);
        } else {
          rLog.warn(
            "Ignoring unrecognized security scheme; it is on you to implement it."
          );
          continue;
        }
      }

      let handler: WrappedHandler;
      switch (scheme.type) {
        case "apiKey":
          handler = buildApiKeyHandler(scheme);
          break;
        case "http":
          switch (scheme.scheme) {
            case "basic":
              handler = buildHttpBasicHandler(scheme);
              break;
            case "bearer":
              handler = buildHttpBearerHandler(scheme);
              break;
            default:
              // @ts-expect-error JS catch
              throw new Error(`Unsupported HTTP scheme: ${scheme.scheme}`);
          }
          break;
        default:
          // @ts-expect-error JS catch
          throw new Error(`Unsupported security scheme: ${scheme.type}`);
      }

      andedHandlers.push([name, handler]);
    }

    orHandlers.push(andedHandlers);
  }

  return buildSecurityHandlerFunction(rLog, orHandlers, options);
}

const defaultFailHandler: OAS3AutowireRequestFailedHandler = (
  result,
  request,
  reply
) => {
  if (result.code === 401) {
    reply.code(401).send({ error: "Unauthorized" });
  } else if (result.code === 403) {
    reply.code(403).send({ error: "Forbidden" });
  } else {
    request.log.error(
      { handlerRetval: result },
      "Out-of-domain value from security handlers."
    );
    reply.code(500).send({ error: "Internal server error" });
  }
};

function buildSecurityHandlerFunction(
  rLog: FastifyBaseLogger,
  orredHandlers: OrredHandlers,
  options: OAS3AutowireSecurityOptions
): onRequestAsyncHookHandler {
  const failHandler: OAS3AutowireRequestFailedHandler =
    options.onRequestFailed ?? defaultFailHandler;

  // this function needs to loop over the "or" handlers. this yields the "and"
  // handlers, as per the OpenAPI spec. If any "and" handlers fail, we can
  // short-circuit return that layer. If all "and" handlers of a single group
  // succeed, we can short-circuit return the whole function.
  //
  // we need to collect all of them, however, because "forbidden" trumps "unauthorized"
  // and we want to return the most clear error to the client.

  return async (request, reply) => {
    const andRetvals: Array<HandlerRetval> = [];
    let orSucceeded = false;

    let handlerGroupIndex = 0;
    // Loop over "or" handlers (array of "and" handler groups)
    for (const andedHandlers of orredHandlers) {
      const gLog = request.log.child({ handlerGroupIndex });
      gLog.debug("Checking security handler group.");
      handlerGroupIndex++;

      let allSucceeded = true;

      let handlerIndex = 0;
      // Loop over "and" handlers within the current "or" group
      for (const [name, handler] of andedHandlers) {
        const hLog = gLog.child({ handlerIndex });
        hLog.debug("Checking security handler in group.");
        handlerIndex++;

        try {
          hLog.debug("Calling security handler.");
          const result = await handler(request);

          hLog.debug({ handlerRetval: result }, "Security handler returned.");

          if (!result.ok) {
            hLog.debug(
              {
                handlerIndex,
                handlerGroupIndex,
                securitySchemeName: name,
              },
              "Security scheme denied request."
            );
            andRetvals.push(result);
            allSucceeded = false;
            break;
          }
        } catch (err) {
          hLog.error(
            { err },
            `Security handler '${name}' threw an error: ${err}`
          );
          allSucceeded = false;
          break;
        }
      }

      // If all handlers in this "and" group succeeded, allow the request
      if (allSucceeded) {
        orSucceeded = true;
        break;
      }
    }

    if (orSucceeded) {
      request.log.debug("At least one set of security handlers succeeded.");
      return;
    } else {
      request.log.debug("All security handlers failed for route.");
      const isForbidden = andRetvals.some(
        (r) => r.ok === false && r.code === 403
      );

      return failHandler(
        { ok: false, code: isForbidden ? 403 : 401 },
        request,
        reply
      );
    }
  };
}
