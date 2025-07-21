import "../extensions.js";

import { inspect } from "util";

import { fastifyFormbody } from "@fastify/formbody";
import { type Static, type StringOptions, Type } from "@sinclair/typebox";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import jsYaml from "js-yaml";
import { describe, expect, test } from "vitest";

import { APPLICATION_JSON } from "../constants.js";
import { oas3PluginAjv, schemaType } from "../index.js";
import { oas3Plugin, type OAS3PluginOptions } from "../plugin.js";

const fastifyOpts: FastifyServerOptions = {
  logger: { level: "error" },
  ajv: {
    customOptions: {
      coerceTypes: true,
    },
    plugins: [oas3PluginAjv],
  },
};
const pluginOpts: OAS3PluginOptions = {
  openapiInfo: {
    title: "test",
    version: "0.1.0",
  },
};

const PingResponse = schemaType(
  "PingResponse",
  Type.Object({ pong: Type.Boolean() })
);
type PingResponse = Static<typeof PingResponse>;

const QwopModel = schemaType(
  "QwopRequestBody",
  Type.Object({ qwop: Type.Number() })
);
type QwopModel = Static<typeof QwopModel>;

describe("plugin", () => {
  describe("basic functionality", () => {
    test("can add a base GET route", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, { ...pluginOpts });

      // we do this inside a prefixed scope to smoke out prefix append errors
      await fastify.register(
        async (fastify: FastifyInstance) => {
          // TODO: once fastify 4.x hits and type providers are a thing, this should be refactored
          fastify.route<{ Reply: PingResponse }>({
            url: "/ping",
            method: "GET",
            schema: {
              response: {
                200: PingResponse,
              },
            },
            oas: {},
            handler: async (req, reply) => {
              return { pong: true };
            },
          });
        },
        { prefix: "/api" }
      );
      await fastify.ready();

      const oas = fastify.openapiDocument;
      const op = oas.paths?.["/api/ping"]?.get;

      expect(oas.components?.schemas?.PingResponse).toBeTruthy();
      expect(op?.operationId).toEqual("pingGet");
      expect(
        op?.responses?.["200"]?.content?.[APPLICATION_JSON]?.schema
      ).toEqual({ $ref: "#/components/schemas/PingResponse" });
    });

    test("will error on an invalid spec", async () => {
      const fastify = Fastify({ ...fastifyOpts, logger: { level: "silent" } });
      await fastify.register(oas3Plugin, {
        // this WILL cause a failure to sput out logging values.
        ...pluginOpts,
        postParse: (oas) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (oas.rootDoc.openapi as any) = 42;
        },
        exitOnInvalidDocument: true,
      });

      try {
        await fastify.ready();
        expect("this should have failed").toEqual(false);
      } catch (err) {
        /* this is ok */
      }
    });

    test("will serve an OAS json doc and YAML doc", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, { ...pluginOpts });

      // we do this inside a prefixed scope to smoke out prefix append errors
      await fastify.register(
        async (fastify: FastifyInstance) => {
          fastify.get("/ping", {
            schema: {
              response: {
                200: PingResponse,
              },
            },
            oas: {},
            handler: async (req, reply) => {
              return { pong: true };
            },
          });
        },
        { prefix: "/api" }
      );
      await fastify.ready();

      const jsonResponse = await fastify.inject({
        method: "GET",
        path: "/openapi.json",
      });

      const jsonDoc = JSON.parse(jsonResponse.body);
      expect(jsonDoc).toMatchObject(fastify.openapiDocument);

      const yamlResponse = await fastify.inject({
        method: "GET",
        path: "/openapi.yaml",
      });

      const yamlDoc = jsYaml.load(yamlResponse.body);
      expect(yamlDoc).toMatchObject(fastify.openapiDocument);
    });
  });

  describe("response handling", () => {
    test("correctly represents responses in OAS documents", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, { ...pluginOpts });

      await fastify.register(
        async (fastify: FastifyInstance) => {
          fastify.get("/ping", {
            schema: {
              response: {
                200: PingResponse,
              },
            },
            oas: {},
            handler: async (req, reply) => {
              return { pong: true };
            },
          });
        },
        { prefix: "/api" }
      );

      await fastify.ready();

      const jsonResponse = await fastify.inject({
        method: "GET",
        path: "/openapi.json",
      });

      const jsonDoc = JSON.parse(jsonResponse.body);

      const operation = jsonDoc.paths?.["/api/ping"]?.get;
      const response = operation?.responses?.["200"];
      expect(response).toMatchObject({
        description: "No response description specified.",
        content: {
          [APPLICATION_JSON]: {
            schema: { $ref: "#/components/schemas/PingResponse" },
          },
        },
      });

      const pingResponse = jsonDoc.components?.schemas?.PingResponse;

      expect(pingResponse).toBeDefined();
      expect(pingResponse).toMatchObject({
        type: "object",
        properties: { pong: { type: "boolean" } },
        required: ["pong"],
      });
    });

    test("correctly represents non-JSON responses in OAS documents", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, { ...pluginOpts });

      await fastify.register(
        async (fastify: FastifyInstance) => {
          fastify.get("/ping", {
            schema: {
              response: {
                200: PingResponse,
              },
            },
            oas: {
              responses: {
                200: {
                  description: "No response description specified.",
                  contentType: "application/x-www-form-urlencoded",
                },
              },
            },
            handler: async (req, reply) => {
              reply.header("Content-Type", "application/x-www-form-urlencoded");
              return "pong=true";
            },
          });
        },
        { prefix: "/api" }
      );

      await fastify.ready();

      const jsonResponse = await fastify.inject({
        method: "GET",
        path: "/openapi.json",
      });

      const jsonDoc = JSON.parse(jsonResponse.body);

      const operation = jsonDoc.paths?.["/api/ping"]?.get;
      const response = operation?.responses?.["200"];
      expect(response).toMatchObject({
        description: "No response description specified.",
        content: {
          "application/x-www-form-urlencoded": {
            schema: { $ref: "#/components/schemas/PingResponse" },
          },
        },
      });

      const pingResponse = jsonDoc.components?.schemas?.PingResponse;

      expect(pingResponse).toBeDefined();
      expect(pingResponse).toMatchObject({
        type: "object",
        properties: { pong: { type: "boolean" } },
        required: ["pong"],
      });

      // and now inject the request

      const response2 = await fastify.inject({
        method: "GET",
        path: "/api/ping",
      });

      expect(response2.headers["content-type"]).toEqual(
        "application/x-www-form-urlencoded"
      );
      expect(response2.body).toEqual("pong=true");
    });
  });

  describe("request body handling", () => {
    test("correctly represents request bodies in OAS documents", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, { ...pluginOpts });

      await fastify.register(
        async (fastify: FastifyInstance) => {
          fastify.post("/qwop", {
            schema: {
              body: QwopModel,
              response: {
                200: PingResponse,
              },
            },
            oas: {},
            handler: async (req, reply) => {
              return { pong: true };
            },
          });
        },
        { prefix: "/api" }
      );
      await fastify.ready();

      const jsonResponse = await fastify.inject({
        method: "GET",
        path: "/openapi.json",
      });

      const jsonDoc = JSON.parse(jsonResponse.body);
      const operation = jsonDoc.paths?.["/api/qwop"]?.post;

      const requestBody = operation?.requestBody;
      expect(requestBody).toMatchObject({
        content: {
          [APPLICATION_JSON]: {
            schema: { $ref: "#/components/schemas/QwopRequestBody" },
          },
        },
      });

      const qwopRequestBody = jsonDoc.components?.schemas?.QwopRequestBody;
      expect(qwopRequestBody).toMatchObject({
        type: "object",
        properties: { qwop: { type: "number" } },
        required: ["qwop"],
      });
    });

    test("correctly represents request bodies with custom content type in OAS documents", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, { ...pluginOpts });

      await fastify.register(
        async (fastify: FastifyInstance) => {
          fastify.post("/qwop", {
            schema: {
              body: QwopModel,
              response: {
                200: PingResponse,
              },
            },
            oas: {
              body: {
                contentType: "application/x-www-form-urlencoded",
              },
            },
            handler: async (req, reply) => {
              return { pong: true };
            },
          });
        },
        { prefix: "/api" }
      );
      await fastify.ready();

      const jsonResponse = await fastify.inject({
        method: "GET",
        path: "/openapi.json",
      });

      const jsonDoc = JSON.parse(jsonResponse.body);
      const operation = jsonDoc.paths?.["/api/qwop"]?.post;

      const requestBody = operation?.requestBody;
      expect(requestBody).toMatchObject({
        content: {
          "application/x-www-form-urlencoded": {
            schema: { $ref: "#/components/schemas/QwopRequestBody" },
          },
        },
      });
    });

    test("handles form-encoded request bodies correctly (testing non-JSON request bodies)", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, { ...pluginOpts });

      await fastify.register(
        async (fastify: FastifyInstance) => {
          fastify.register(fastifyFormbody);
          fastify.post("/qwop", {
            schema: {
              body: QwopModel,
              response: {
                200: PingResponse,
              },
            },
            oas: {
              body: {
                contentType: "application/x-www-form-urlencoded",
              },
            },
            handler: async (req, reply) => {
              const body = req.body as QwopModel;
              return { pong: body.qwop === 42 };
            },
          });
        },
        { prefix: "/api" }
      );
      await fastify.ready();

      const response = await fastify.inject({
        method: "POST",
        path: "/api/qwop",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        payload: "qwop=42",
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ pong: true });
    });
  });

  describe("parameters", () => {
    test("correctly represents query parameters in OAS documents", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, { ...pluginOpts });

      await fastify.register(async (fastify: FastifyInstance) => {
        fastify.get("/boop", {
          schema: {
            querystring: Type.Object({
              boopIndex: Type.Number({ description: "Boop index." }),
              verbose: Type.Optional(Type.Boolean()),
            }),
            response: {
              200: PingResponse,
            },
          },
          oas: {
            querystring: {
              verbose: { deprecated: true },
            },
          },
          handler: async (req, reply) => {
            return { pong: true };
          },
        });
      });
      await fastify.ready();

      const jsonResponse = await fastify.inject({
        method: "GET",
        path: "/openapi.json",
      });

      const jsonDoc = JSON.parse(jsonResponse.body);
      const operation = jsonDoc.paths?.["/boop"]?.get;

      const parameters = operation?.parameters;
      expect(parameters).toMatchObject([
        {
          in: "query",
          name: "boopIndex",
          description: "Boop index.",
          schema: { type: "number" },
          required: true,
        },
        {
          in: "query",
          name: "verbose",
          schema: { type: "boolean" },
          required: false,
          deprecated: true,
        },
      ]);
    });

    test("correctly represents path parameters in OAS documents", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, { ...pluginOpts });

      await fastify.register(async (fastify: FastifyInstance) => {
        fastify.get("/clank/:primary/:secondary", {
          schema: {
            params: Type.Object({
              primary: Type.String(),
              secondary: Type.Number(),
            }),
            response: {
              200: PingResponse,
            },
          },
          oas: {},
          handler: async (req, reply) => {
            return { pong: true };
          },
        });
      });
      await fastify.ready();

      const jsonResponse = await fastify.inject({
        method: "GET",
        path: "/openapi.json",
      });

      const jsonDoc = JSON.parse(jsonResponse.body);
      const operation = jsonDoc.paths?.["/clank/{primary}/{secondary}"]?.get;

      const parameters = operation?.parameters;
      // remember: `required` is implied (and forced true) for path params
      expect(parameters).toMatchObject([
        {
          in: "path",
          name: "primary",
          schema: { type: "string" },
          required: true,
        },
        {
          in: "path",
          name: "secondary",
          schema: { type: "number" },
          required: true,
        },
      ]);
    });
  });

  describe("hooks and callbacks", () => {
    test("fires postPathItemBuild on each route", async () => {
      const fastify = Fastify(fastifyOpts);
      const routeDetails: Set<string> = new Set();

      await fastify.register(oas3Plugin, {
        ...pluginOpts,
        postOperationBuild: (route, pathItem) => {
          routeDetails.add(route.url);
        },
      });

      await fastify.register(async (fastify: FastifyInstance) => {
        fastify.get("/boop", {
          schema: {
            querystring: Type.Object({
              boopIndex: Type.Number({ description: "Boop index." }),
              verbose: Type.Optional(Type.Boolean()),
            }),
            response: {
              200: PingResponse,
            },
          },
          oas: {
            querystring: {
              verbose: { deprecated: true },
            },
          },
          handler: async (req, reply) => {
            return { pong: true };
          },
        });

        fastify.get("/boop2", {
          schema: {
            querystring: Type.Object({
              boopIndex: Type.Number({ description: "Boop index." }),
              verbose: Type.Optional(Type.Boolean()),
            }),
            response: {
              200: PingResponse,
            },
          },
          oas: {
            querystring: {
              verbose: { deprecated: true },
            },
          },
          handler: async (req, reply) => {
            return { pong: true };
          },
        });
      });

      await fastify.ready();

      expect(routeDetails).toEqual(new Set(["/boop", "/boop2"]));
    });
  });

  describe("vendor extensions", () => {
    test("correctly handles vendorPrefixedFields in operations", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, { ...pluginOpts });

      await fastify.register(async (fastify: FastifyInstance) => {
        fastify.get("/vendor-test", {
          schema: {
            response: {
              200: PingResponse,
            },
          },
          oas: {
            operationId: "vendorTest",
            summary: "Test vendor extensions",
            vendorPrefixedFields: {
              "x-custom-field": "custom-value",
              "x-rate-limit": 100,
              "x-internal": true,
              "x-complex-object": {
                nested: "value",
                array: [1, 2, 3],
                bool: false,
              },
            },
          },
          handler: async (req, reply) => {
            return { pong: true };
          },
        });

        fastify.post("/vendor-test-post", {
          schema: {
            body: QwopModel,
            response: {
              201: PingResponse,
            },
          },
          oas: {
            operationId: "vendorTestPost",
            vendorPrefixedFields: {
              "x-example-only": "post-specific",
              "x-validation-rules": ["required", "numeric"],
            },
          },
          handler: async (req, reply) => {
            return { pong: true };
          },
        });
      });

      await fastify.ready();

      const jsonResponse = await fastify.inject({
        method: "GET",
        path: "/openapi.json",
      });

      const jsonDoc = JSON.parse(jsonResponse.body);

      // Test GET operation vendor fields
      const getOperation = jsonDoc.paths?.["/vendor-test"]?.get;
      expect(getOperation).toBeTruthy();
      expect(getOperation["x-custom-field"]).toEqual("custom-value");
      expect(getOperation["x-rate-limit"]).toEqual(100);
      expect(getOperation["x-internal"]).toEqual(true);
      expect(getOperation["x-complex-object"]).toEqual({
        nested: "value",
        array: [1, 2, 3],
        bool: false,
      });

      // Test POST operation vendor fields
      const postOperation = jsonDoc.paths?.["/vendor-test-post"]?.post;
      expect(postOperation).toBeTruthy();
      expect(postOperation["x-example-only"]).toEqual("post-specific");
      expect(postOperation["x-validation-rules"]).toEqual([
        "required",
        "numeric",
      ]);

      // Ensure regular operation fields are still present
      expect(getOperation.operationId).toEqual("vendorTest");
      expect(getOperation.summary).toEqual("Test vendor extensions");
      expect(postOperation.operationId).toEqual("vendorTestPost");
    });

    test("handles operations without vendorPrefixedFields", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, { ...pluginOpts });

      await fastify.register(async (fastify: FastifyInstance) => {
        fastify.get("/no-vendor-fields", {
          schema: {
            response: {
              200: PingResponse,
            },
          },
          oas: {
            operationId: "noVendorFields",
            summary: "No vendor extensions",
          },
          handler: async (req, reply) => {
            return { pong: true };
          },
        });
      });

      await fastify.ready();

      const jsonResponse = await fastify.inject({
        method: "GET",
        path: "/openapi.json",
      });

      const jsonDoc = JSON.parse(jsonResponse.body);
      const operation = jsonDoc.paths?.["/no-vendor-fields"]?.get;

      expect(operation).toBeTruthy();
      expect(operation.operationId).toEqual("noVendorFields");
      expect(operation.summary).toEqual("No vendor extensions");

      // Ensure no x- prefixed fields are present
      const vendorFields = Object.keys(operation).filter((key) =>
        key.startsWith("x-")
      );
      expect(vendorFields).toEqual([]);
    });

    test("vendorPrefixedFields work with empty object", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, { ...pluginOpts });

      await fastify.register(async (fastify: FastifyInstance) => {
        fastify.get("/empty-vendor-fields", {
          schema: {
            response: {
              200: PingResponse,
            },
          },
          oas: {
            operationId: "emptyVendorFields",
            vendorPrefixedFields: {},
          },
          handler: async (req, reply) => {
            return { pong: true };
          },
        });
      });

      await fastify.ready();

      const jsonResponse = await fastify.inject({
        method: "GET",
        path: "/openapi.json",
      });

      const jsonDoc = JSON.parse(jsonResponse.body);
      const operation = jsonDoc.paths?.["/empty-vendor-fields"]?.get;

      expect(operation).toBeTruthy();
      expect(operation.operationId).toEqual("emptyVendorFields");

      // Ensure no x- prefixed fields are present when empty object is provided
      const vendorFields = Object.keys(operation).filter((key) =>
        key.startsWith("x-")
      );
      expect(vendorFields).toEqual([]);
    });
  });
});
