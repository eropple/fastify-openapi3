import { FastifyPluginAsync, RouteOptions } from "fastify";
import fp from "fastify-plugin";
import { OpenApiBuilder, OperationObject, PathItemObject } from "openapi3-ts";
import { Validator as OpenAPISchemaValidator } from "@seriousme/openapi-schema-validator";
import * as YAML from "js-yaml";

// TODO: switch this to openapi-types; it's slightly more rigorous, but has some gremlins
export * as OAS31 from "openapi3-ts";

import "./extensions.js";
import { OAS3PluginOptions, OAS3PluginPublishOptions } from "./options.js";
import { OAS3PluginOptionsError, OAS3SpecValidationError } from "./errors.js";
import { canonicalizeAnnotatedSchemas } from "./spec-transforms/index.js";
import { defaultOperationIdFn } from "./operation-helpers.js";
import { APPLICATION_JSON } from "./constants.js";
import { rapidocSkeleton } from "./ui/rapidoc.js";
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

const validator = new OpenAPISchemaValidator();

export const oas3Plugin: FastifyPluginAsync<OAS3PluginOptions> = fp(
  async (fastify, options) => {
    const pLog = fastify.log.child({ plugin: "OAS3Plugin" });

    if (!options.openapiInfo) {
      throw new OAS3PluginOptionsError("options.openapiInfo is required.");
    }

    pLog.debug({ options }, "Initializing OAS3 plugin.");

    const operationIdNameFn = options.operationIdNameFn ?? defaultOperationIdFn;

    // add our documentation routes here, safely ahead of the

    // we append routes to this, rather than doing transforms, to allow
    // other plugins to (potentially) modify them before we do all our filthy
    // object-munging business during `onReady`.
    const routes: Array<RouteOptions> = [];
    fastify.addHook("onRoute", async (route) => {
      if (route?.oas?.omit !== true) {
        routes.push(route);
      }
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
        }

        // and now let's normalize out all our schema, hold onto your butts
        doc = await canonicalizeAnnotatedSchemas(doc);

        builder = new OpenApiBuilder(doc);
        // and some wrap-up before we consider the builder-y bits done
        if (options.postParse) {
          pLog.debug("Calling postParse.");
          options.postParse(builder);
        }

        doc = builder.rootDoc;

        const result = await validator.validate(doc);
        if (!result.valid) {
          if (options.exitOnInvalidDocument) {
            pLog.error(
              { openApiErrors: result.errors },
              "Errors in OpenAPI validation."
            );
            throw new OAS3SpecValidationError();
          }

          pLog.warn(
            { openApiErrors: result.errors },
            "Errors in OpenAPI validation."
          );
        }

        pLog.debug("Assigning completed OAS document to FastifyInstance.");
        (fastify as any).openapiDocument = doc;
      } catch (err) {
        pLog.error({ err }, "Error during plugin instantiation.");
        throw err;
      }
    });

    const publish: OAS3PluginPublishOptions = {
      ui: options.publish?.ui !== undefined ? "rapidoc" : options.publish?.ui,
      json: options.publish?.json ?? true,
      yaml: options.publish?.yaml ?? true,
    };

    if (publish.json) {
      const path =
        typeof publish.json === "string" ? publish.json : "openapi.json";
      let jsonContent: string | null = null;
      fastify.get(
        `/${path}`,
        {
          oas: { omit: true },
        },
        (req, rep) => {
          jsonContent =
            jsonContent ?? JSON.stringify(fastify.openapiDocument, null, 2);

          rep
            .code(200)
            .header("Content-Type", "application/json; charset=utf-8")
            .header("Content-Disposition", "inline")
            .send(jsonContent);
        }
      );
    }

    if (publish.yaml) {
      const path =
        typeof publish.yaml === "string" ? publish.yaml : "openapi.yaml";
      let yamlContent: string | null = null;
      fastify.get(
        `/${path}`,
        {
          oas: { omit: true },
        },
        (req, rep) => {
          yamlContent = yamlContent ?? YAML.dump(fastify.openapiDocument);

          rep
            .code(200)
            .header("Content-Type", "application/x-yaml; charset=utf-8")
            .header("Content-Disposition", "inline")
            .send(yamlContent);
        }
      );
    }

    if (publish.ui) {
      switch (publish.ui) {
        case "rapidoc":
          let rapidocContent: string | null = null;
          fastify.get(
            "/docs",
            {
              oas: { omit: true },
            },
            (req, rep) => {
              rapidocContent =
                rapidocContent ?? rapidocSkeleton(fastify.openapiDocument);
              rep
                .code(200)
                .header("Content-Type", "text/html")
                .send(rapidocContent);
            }
          );
          break;
      }
    }
  },
  "4.x"
);
