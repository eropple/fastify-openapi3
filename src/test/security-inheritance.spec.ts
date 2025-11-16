import { inspect } from "util";

import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import { Type } from "typebox";
import { describe, expect, test } from "vitest";

import { oas3PluginAjv } from "../ajv.js";
import { type OAS3AutowireSecurityOptions } from "../autowired-security/index.js";
import { type OAS3PluginOptions } from "../options.js";
import { oas3Plugin } from "../plugin.js";

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
const autowiredOpts: OAS3AutowireSecurityOptions = {
  disabled: false,
  securitySchemes: {},
};

test("operation with security but no root security works", async () => {
  const fastify = Fastify(fastifyOpts);
  await fastify.register(oas3Plugin, {
    ...pluginOpts,
    autowiredSecurity: {
      securitySchemes: {
        TestApiKey: {
          type: "apiKey",
          in: "header",
          name: "X-Test-Key",
          fn: (key) =>
            key === "valid" ? { ok: true } : { ok: false, code: 401 },
        },
      },
    },
  });

  fastify.get(
    "/test",
    {
      oas: {
        security: { TestApiKey: [] },
      },
    },
    async () => "ok"
  );

  await fastify.ready();

  // Get and parse OAS doc
  const docResponse = await fastify.inject({
    method: "GET",
    path: "/openapi.json",
  });
  const docBody = docResponse.body;
  const parsedDoc = JSON.parse(docBody);

  // Verify OAS doc
  expect(parsedDoc.paths["/test"].get.security).toEqual([{ TestApiKey: [] }]);

  // Verify interceptor behavior
  const validReq = await fastify.inject({
    method: "GET",
    path: "/test",
    headers: { "X-Test-Key": "valid" },
  });
  expect(validReq.statusCode).toBe(200);

  const invalidReq = await fastify.inject({
    method: "GET",
    path: "/test",
  });
  expect(invalidReq.statusCode).toBe(401);
});

test("operation inherits root security when none specified", async () => {
  const fastify = Fastify(fastifyOpts);
  await fastify.register(oas3Plugin, {
    ...pluginOpts,
    autowiredSecurity: {
      rootSecurity: { RootApiKey: [] },
      securitySchemes: {
        RootApiKey: {
          type: "apiKey",
          in: "header",
          name: "X-Root-Key",
          fn: (key) =>
            key === "valid" ? { ok: true } : { ok: false, code: 401 },
        },
      },
    },
  });

  fastify.get(
    "/test",
    {
      oas: {}, // No security specified
    },
    async () => "ok"
  );

  await fastify.ready();

  // Get and parse OAS doc
  const docResponse = await fastify.inject({
    method: "GET",
    path: "/openapi.json",
  });
  const docBody = docResponse.body;
  const parsedDoc = JSON.parse(docBody);

  // Verify OAS doc
  expect(parsedDoc.security).toEqual([{ RootApiKey: [] }]);
  expect(parsedDoc.paths["/test"].get.security).toBeUndefined();

  // Verify interceptor
  const validReq = await fastify.inject({
    method: "GET",
    path: "/test",
    headers: { "X-Root-Key": "valid" },
  });
  expect(validReq.statusCode).toBe(200);
});

test("operation can disable inherited root security", async () => {
  const fastify = Fastify(fastifyOpts);
  await fastify.register(oas3Plugin, {
    ...pluginOpts,
    autowiredSecurity: {
      rootSecurity: { RootApiKey: [] },
      securitySchemes: {
        RootApiKey: {
          type: "apiKey",
          in: "header",
          name: "X-Root-Key",
          fn: (key) =>
            key === "valid" ? { ok: true } : { ok: false, code: 401 },
        },
      },
    },
  });

  fastify.get(
    "/test",
    {
      oas: {
        security: [], // Explicitly disable security
      },
    },
    async () => "ok"
  );

  await fastify.ready();

  // Get and parse OAS doc
  const docResponse = await fastify.inject({
    method: "GET",
    path: "/openapi.json",
  });
  const docBody = docResponse.body;
  const parsedDoc = JSON.parse(docBody);

  // Verify OAS doc
  expect(parsedDoc.paths["/test"].get.security).toEqual([]);

  // Verify no interceptor
  const req = await fastify.inject({
    method: "GET",
    path: "/test",
  });
  expect(req.statusCode).toBe(200);
});
