import OpenAPISchemaValidator from "@seriousme/openapi-schema-validator";
import { TypeGuard } from "@sinclair/typebox";
import { type RouteOptions } from "fastify";
import { type onRequestMetaHookHandler } from "fastify/types/hooks.js";
import { fastifyPlugin } from "fastify-plugin";
import * as YAML from "js-yaml";
import {
  OpenApiBuilder,
  type SecurityRequirementObject,
  type OperationObject,
  type PathItemObject,
} from "openapi3-ts";

import "./extensions.js";
import {
  attachSecuritySchemesToDocument,
  attachSecurityToRoute,
} from "./autowired-security/index.js";
import { APPLICATION_JSON } from "./constants.js";
import { OAS3PluginOptionsError, OAS3SpecValidationError } from "./errors.js";
import { defaultOperationIdFn } from "./operation-helpers.js";
import {
  type OAS3PluginOptions,
  type OAS3PluginPublishOptions,
} from "./options.js";
import { convertFastifyToOpenAPIPath } from "./path-converter.js";
import { canonicalizeAnnotatedSchemas } from "./spec-transforms/index.js";
import { rapidocSkeleton } from "./ui/rapidoc.js";
import { findMissingEntries } from "./util.js";

// TODO: switch this to openapi-types; it's slightly more rigorous, but has some gremlins
export * as OAS31 from "openapi3-ts";
export { OAS3PluginOptions } from "./options.js";

const validator = new OpenAPISchemaValidator();

export const oas3Plugin = fastifyPlugin<OAS3PluginOptions>(
  async (fastify, options) => {
    const pLog = fastify.log.child({ plugin: "OAS3Plugin" });

    if (!options.openapiInfo) {
      throw new OAS3PluginOptionsError("options.openapiInfo is required.");
    }

    pLog.debug({ options }, "Initializing OAS3 plugin.");

    const publish: OAS3PluginPublishOptions = options.publish ?? {
      ui: "rapidoc",
      json: true,
      yaml: true,
    };

    const uiPath = publish.uiPath ?? "/docs";

    const isSkippablePath = (path: string) => {
      return (
        path.startsWith(uiPath) ||
        path === "/openapi.json" ||
        path === "/openapi.yaml"
      );
    };

    const operationIdNameFn = options.operationIdNameFn ?? defaultOperationIdFn;

    // we append routes to this, rather than doing transforms, to allow
    // other plugins to (potentially) modify them before we do all our filthy
    // object-munging business during `onReady`.
    const routes: Array<RouteOptions> = [];
    fastify.addHook("onRoute", async (route) => {
      const hookCache: Record<string, onRequestMetaHookHandler> = {};

      const rLog = pLog.child({
        route: { url: route.url, method: route.method },
      });

      if (isSkippablePath(route.url)) {
        rLog.debug("Skipping OpenAPI route.");
        return;
      }

      if (route?.oas?.omit !== true) {
        routes.push(route);
      }

      if (options.autowiredSecurity && !options.autowiredSecurity.disabled) {
        rLog.debug("Attaching security to route.");
        attachSecurityToRoute(
          rLog,
          route,
          options.autowiredSecurity,
          hookCache
        );
      }
    });

    const postBuildDebounce: Record<string, boolean> = {};
    fastify.addHook("onReady", async () => {
      try {
        pLog.debug("OAS3 onReady hit.");
        let documentSecurity: SecurityRequirementObject[] | undefined;
        if (options.autowiredSecurity?.rootSecurity) {
          documentSecurity = Array.isArray(
            options.autowiredSecurity.rootSecurity
          )
            ? options.autowiredSecurity.rootSecurity
            : [options.autowiredSecurity.rootSecurity];
        }

        let builder = new OpenApiBuilder({
          openapi: "3.1.0",
          info: options.openapiInfo,
          paths: {},
          security: documentSecurity,
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

          if (isSkippablePath(route.url)) {
            rLog.debug("Skipping UI route.");
            continue;
          }

          const oasConvertedUrl = convertFastifyToOpenAPIPath(route.url);
          rLog.info(
            { oasUrl: oasConvertedUrl.url },
            "Building operation for route."
          );

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
            summary: oas?.summary ?? route.url,
            description:
              oas?.description ?? "No operation description specified.",
            deprecated: oas?.deprecated,
            tags: oas?.tags,
            responses: {},
          };

          // Only add security to operation when explicitly set (including empty array to disable)
          if (oas?.security !== undefined) {
            const securities = Array.isArray(oas.security)
              ? oas.security
              : [oas.security];
            operation.security = securities;
          }

          // and now do some inference to build our operation object...
          if (route.schema) {
            rLog.debug("Beginning to build operation object from schema.");
            const { body, params, querystring, response } = route.schema;

            if (body || oas?.body) {
              rLog.debug("Adding request body to operation.");
              if (!TypeGuard.IsSchema(body)) {
                rLog.warn(
                  "Route has a request body that is not a schema. Skipping."
                );
              } else {
                const oasRequestBody = oas?.body;
                const requestBodyContentType =
                  oasRequestBody?.contentType ?? APPLICATION_JSON;
                operation.requestBody = {
                  description:
                    oas?.body?.description ??
                    "No request body description specified.",
                  content: {
                    [requestBodyContentType]: {
                      schema: oas?.body?.schemaOverride ?? body,
                    },
                  },
                };
              }
            }

            if (querystring) {
              rLog.debug("Adding query string to operation.");

              if (!TypeGuard.IsObject(querystring)) {
                rLog.warn(
                  "Route has a querystring that is not a schema. Skipping."
                );
              } else {
                operation.parameters = operation.parameters ?? [];

                if (querystring.additionalProperties) {
                  rLog.warn(
                    "Route's querystring has additionalProperties. This will be ignored."
                  );
                }

                const routeQsExtras = route.oas?.querystring ?? {};
                const qsEntries = Object.entries(querystring.properties ?? {});

                const unmatchedExtras = findMissingEntries(
                  routeQsExtras,
                  qsEntries
                );
                if (unmatchedExtras.length > 0) {
                  rLog.warn(
                    { unmatchedExtras },
                    `Route's querystring has extra properties. These will be ignored: ${unmatchedExtras.join(", ")}`
                  );
                }

                for (const [qsKey, qsValue] of qsEntries) {
                  const qsExtra = routeQsExtras[qsKey] ?? {};

                  operation.parameters.push({
                    name: qsKey,
                    in: "query",
                    deprecated: qsExtra.deprecated,
                    description:
                      qsExtra.description ??
                      qsValue.description ??
                      "No querystring parameter description specified.",
                    example: qsExtra.example ?? qsValue.example,
                    required: querystring.required?.includes(qsKey) ?? false,
                    schema: qsExtra.schemaOverride ?? qsValue,
                    style: qsExtra.style,
                    allowEmptyValue: qsExtra.allowEmptyValue,
                    allowReserved: qsExtra.allowReserved,
                    explode: qsExtra.explode,
                  });
                }
              }
            }

            if (params) {
              rLog.debug("Adding params to operation.");

              if (!TypeGuard.IsObject(params)) {
                rLog.warn("Route has a params that is not a schema. Skipping.");
              } else {
                operation.parameters = operation.parameters ?? [];

                if (params.additionalProperties) {
                  rLog.warn(
                    "Route's params has additionalProperties. This will be ignored."
                  );
                }

                const routeParamsExtras = route.oas?.params ?? {};
                const paramsEntries = Object.entries(params.properties ?? {});

                const unmatchedExtras = findMissingEntries(
                  routeParamsExtras,
                  paramsEntries
                );
                if (unmatchedExtras.length > 0) {
                  rLog.warn(
                    { unmatchedExtras },
                    `Route's params has extra properties. These will be ignored: ${unmatchedExtras.join(", ")}`
                  );
                }

                for (const [paramKey, paramValue] of paramsEntries) {
                  const paramExtra = routeParamsExtras[paramKey] ?? {};

                  if (!params.required?.includes(paramKey)) {
                    rLog.warn(
                      { paramKey },
                      `Route's param is marked as not required. This will be ignored.`
                    );
                  }

                  operation.parameters.push({
                    name: paramKey,
                    in: "path",
                    description:
                      paramExtra.description ??
                      paramValue.description ??
                      "No path parameter description specified.",
                    required: true,
                    example: paramExtra.example ?? paramValue.example,
                    schema: paramExtra.schemaOverride ?? paramValue,
                  });
                }
              }
            }

            if (response) {
              // TODO: expand this to use full fastify multi-response-type support, if desired (I don't, PRs welcome)
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

                const oasResponses = oas?.responses?.[responseCode];
                const responseContentType =
                  oasResponses?.contentType ?? APPLICATION_JSON;
                operation.responses[responseCode] = {
                  description:
                    oasResponses?.description ??
                    "No response description specified.",
                  content: {
                    [responseContentType]: {
                      schema:
                        oasResponses?.schemaOverride ?? response[responseCode],
                    },
                  },
                };
              }
            }
          }

          /// ...and now we wedge it into doc.paths
          const oasUrl = oasConvertedUrl.url;
          const p: PathItemObject = doc.paths[oasUrl] ?? {};

          const postBuildDebounceKey = route.method + ":" + route.url;
          if (
            options.postPathItemBuild &&
            !postBuildDebounce[postBuildDebounceKey]
          ) {
            options.postPathItemBuild(route, p);
            postBuildDebounce[postBuildDebounceKey] = true;
          }

          doc.paths[oasUrl] = p;
          // TODO: is this right? who actually uses 'all' for API reqs?
          [route.method]
            .flat()
            .forEach((method) => (p[method.toLowerCase()] = operation));
        }

        // and now let's normalize out all our schema, hold onto your butts
        doc = await canonicalizeAnnotatedSchemas(doc);
        doc.components = doc.components ?? {};
        doc.components.securitySchemes = doc.components.securitySchemes ?? {};

        builder = OpenApiBuilder.create(doc);

        // we need to attach our security schemes to the doc
        if (options.autowiredSecurity && !options.autowiredSecurity.disabled) {
          attachSecuritySchemesToDocument(
            pLog,
            builder,
            options.autowiredSecurity
          );
        }

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
              { openApiErrors: result.errors, doc },
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (fastify as any).openapiDocument = doc;
      } catch (err) {
        pLog.error({ err }, "Error during plugin instantiation.");
        throw err;
      }
    });

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
        case "rapidoc": {
          pLog.info("Enabling Rapidoc UI.");
          let rapidocContent: string | null = null;
          fastify.get(
            uiPath,
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
        case "scalar": {
          pLog.info("Enabling Scalar UI.");
          const scalar = (await import("@scalar/fastify-api-reference"))
            .default;
          await fastify.register(scalar, {
            // TODO:  tighten this up
            //        later versions of typescript have made this more specific
            routePrefix: uiPath as `/${string}`,
            configuration: {
              ...(publish.scalarExtraOptions ?? {}),
              spec: {
                content: () => fastify.openapiDocument,
              },
            },
          });
        }
      }
    }
  },
  "4.x"
);
