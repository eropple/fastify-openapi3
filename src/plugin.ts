import { FastifyPluginAsync, RouteOptions } from "fastify";
import fp from "fastify-plugin";

export * as OAS31 from "openapi3-ts";

import { OAS3PluginOptions } from "./options.js";
import { OAS3PluginOptionsError } from "./errors.js";
import { OpenApiBuilder, OperationObject, PathItemObject } from "openapi3-ts";
import { canonicalizeAnnotatedSchemas } from "./spec-transforms/index.js";
import { defaultOperationIdFn } from "./operation-helpers.js";
import { APPLICATION_JSON } from "./constants.js";
export { OAS3PluginOptions } from "./options.js";

// export interface RequestGenericInterface {
//   Body?: RequestBodyDefault;
//   Querystring?: RequestQuerystringDefault;
//   Params?: RequestParamsDefault;
//   Headers?: RequestHeadersDefault;
// }

// export interface ReplyGenericInterface {
//   Reply?: ReplyDefault;
// }

export const oas3Plugin: FastifyPluginAsync<OAS3PluginOptions> = fp(
  async (fastify, options) => {
    const pLog = fastify.log.child({ plugin: "OAS3Plugin" });

    if (!options.openapiInfo) {
      throw new OAS3PluginOptionsError("options.openapiInfo is required.");
    }

    pLog.debug({ options }, "Initializing OAS3 plugin.");

    const prefix = options.prefix ?? "/docs";
    const operationIdNameFn = options.operationIdNameFn ?? defaultOperationIdFn;

    // add our documentation routes here, safely ahead of the

    // we append routes to this, rather than doing transforms, to allow
    // other plugins to (potentially) modify them before we do all our filthy
    // object-munging business during `onReady`.
    const routes: Array<RouteOptions> = [];
    fastify.addHook("onRoute", async (route) => {
      routes.push(route);
    });

    fastify.addHook("onReady", async () => {
      try {
        pLog.debug("OAS3 onReady hit.");

        let builder = new OpenApiBuilder({
          openapi: "3.1.0",
          info: options.openapiInfo,
          paths: {},
        });

        // handy place for stuff like security schemas and the like
        if (options.preParse) {
          pLog.debug("Calling preParse.");
          options.preParse(builder);
        }

        let doc = builder.rootDoc;

        for (const route of routes) {
          const rLog = pLog.child({
            route: { url: route.url, method: route.method },
          });

          const oas = route.oas;
          if (!oas && options.includeUnconfiguredOperations) {
            rLog.debug("Route has no OAS config; skipping.");
            continue;
          }

          if (oas?.omit) {
            rLog.debug("Route has omit = true; skipping.");
          }

          const operation: OperationObject = {
            operationId: oas?.operationId ?? operationIdNameFn(route),
            summary: oas?.summary,
            description: oas?.description,
            deprecated: oas?.deprecated,
            tags: oas?.tags,
            responses: {},
          };
          // and now do some inference to build our operation object...
          if (route.schema) {
            const { body, params, querystring, response } = route.schema;

            // TODO: handle request body
            // TODO: handle params
            // TODO: handle query string

            if (response) {
              for (const responseCode of Object.keys(response)) {
                if (
                  responseCode !== "default" &&
                  !/^[1-5][0-9]{2}/.test(responseCode.toString())
                ) {
                  rLog.warn(
                    `Route has a response schema of code '${responseCode}', which OAS3Plugin does not support.`
                  );
                  continue;
                }

                operation.responses[responseCode] = {
                  description:
                    oas?.responses?.[responseCode]?.description ??
                    "No description given.",
                  content: {
                    [APPLICATION_JSON]: { schema: response[responseCode] },
                  },
                };
              }
            }
          }

          /// ...and now we wedge it into doc.paths
          const p: PathItemObject = doc.paths[route.url] ?? {};
          doc.paths[route.url] = p;
          // TODO: is this right? who actually uses 'all' for API reqs?
          [route.method]
            .flat()
            .forEach((method) => (p[method.toLowerCase()] = operation));

          console.log("path:", p);
          console.log("route:", route);
        }

        // and now let's normalize out all our schema, hold onto your butts
        doc = await canonicalizeAnnotatedSchemas(doc);

        builder = new OpenApiBuilder(doc);
        // and some wrap-up before we consider the builder-y bits done
        if (options.postParse) {
          pLog.debug("Calling postParse.");
          options.postParse(builder);
        }

        pLog.debug("Assigning completed OAS document to FastifyInstance.");
        (fastify as any).openapiDocument = builder.rootDoc;
      } catch (err) {
        pLog.error({ err }, "Error during plugin instantiation.");
        throw err;
      }
    });
  },
  "3.x"
);
