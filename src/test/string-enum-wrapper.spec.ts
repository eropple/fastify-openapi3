import "../extensions.js";

import { type Static, type StringOptions, Type } from "@sinclair/typebox";
import Fastify, {
  type FastifyServerOptions,
  type FastifyInstance,
} from "fastify";
import { describe, expect, test } from "vitest";

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

export function StringEnum<T extends string[]>(
  values: [...T],
  options?: StringOptions
) {
  return Type.Unsafe<T[number]>({ ...Type.String(options), enum: values });
}

const AsdfModel = StringEnum(["a", "s", "d", "f"]);

const AsdfChoiceModel = schemaType(
  "AsdfChoiceModel",
  Type.Object({
    choice: AsdfModel,
  })
);

const AsdfChoiceWrapperModel = schemaType(
  "AsdfChoiceWrapperModel",
  Type.Object({
    wrapper: AsdfChoiceModel,
  })
);

describe("StringEnum", () => {
  test("correctly represents enum choices in OAS documents", async () => {
    const fastify = Fastify(fastifyOpts);
    await fastify.register(oas3Plugin, { ...pluginOpts });

    await fastify.register(async (fastify: FastifyInstance) => {
      fastify.post("/choice", {
        schema: {
          body: AsdfChoiceModel,
          response: {
            200: PingResponse,
          },
        },
        oas: {},
        handler: async (req, reply) => {
          const body = req.body as Static<typeof AsdfChoiceModel>;
          return { pong: ["a", "s", "d", "f"].includes(body.choice) };
        },
      });
    });
    await fastify.ready();

    const jsonResponse = await fastify.inject({
      method: "GET",
      path: "/openapi.json",
    });

    const jsonDoc = JSON.parse(jsonResponse.body);
    const schema = jsonDoc.components?.schemas?.AsdfChoiceModel;
    expect(schema).toBeDefined();
    expect(schema).toMatchObject({
      type: "object",
      properties: {
        choice: {
          type: "string",
          enum: ["a", "s", "d", "f"],
        },
      },
      required: ["choice"],
    });

    // Test valid choice
    const validResponse = await fastify.inject({
      method: "POST",
      path: "/choice",
      payload: { choice: "a" },
    });

    expect(validResponse.statusCode).toBe(200);
    expect(JSON.parse(validResponse.body)).toEqual({ pong: true });

    // Test invalid choice
    const invalidResponse = await fastify.inject({
      method: "POST",
      path: "/choice",
      payload: { choice: "z" },
    });

    expect(invalidResponse.statusCode).toBe(400);
    expect(JSON.parse(invalidResponse.body)).toHaveProperty("message");
  });

  test("correctly handles string properties in nested objects", async () => {
    const fastify = Fastify(fastifyOpts);
    await fastify.register(oas3Plugin, { ...pluginOpts });

    // Create simple string model (not enum)
    const StringModel = Type.String();

    const StringChoiceModel = schemaType(
      "StringChoiceModel",
      Type.Object({
        choice: StringModel,
      })
    );

    const StringChoiceWrapperModel = schemaType(
      "StringChoiceWrapperModel",
      Type.Object({
        wrapper: StringChoiceModel,
      })
    );

    await fastify.register(async (fastify: FastifyInstance) => {
      fastify.post("/string-choice", {
        schema: {
          body: StringChoiceWrapperModel,
          response: {
            200: PingResponse,
          },
        },
        handler: async (req, reply) => {
          const body = req.body as Static<typeof StringChoiceWrapperModel>;
          return { pong: typeof body.wrapper.choice === "string" };
        },
      });
    });
    await fastify.ready();

    // Validate OpenAPI document
    const jsonResponse = await fastify.inject({
      method: "GET",
      path: "/openapi.json",
    });

    const jsonDoc = JSON.parse(jsonResponse.body);
    const schema = jsonDoc.components?.schemas?.StringChoiceWrapperModel;
    expect(schema).toBeDefined();
    expect(schema).toMatchObject({
      type: "object",
      properties: {
        wrapper: {
          $ref: "#/components/schemas/StringChoiceModel",
        },
      },
      required: ["wrapper"],
    });

    // Check that StringChoiceModel was also included in the schema
    const stringChoiceModel = jsonDoc.components?.schemas?.StringChoiceModel;
    expect(stringChoiceModel).toBeDefined();
    expect(stringChoiceModel).toMatchObject({
      type: "object",
      properties: {
        choice: {
          type: "string",
        },
      },
      required: ["choice"],
    });

    // Validate successful request with any string
    const successResponse = await fastify.inject({
      method: "POST",
      path: "/string-choice",
      payload: { wrapper: { choice: "hello" } },
    });

    expect(successResponse.statusCode).toBe(200);
    expect(JSON.parse(successResponse.body)).toEqual({ pong: true });
  });

  test("correctly validates StringEnum objects inside nested objects", async () => {
    const fastify = Fastify(fastifyOpts);
    await fastify.register(oas3Plugin, { ...pluginOpts });

    await fastify.register(async (fastify: FastifyInstance) => {
      fastify.post("/asdf", {
        schema: {
          body: AsdfChoiceWrapperModel,
          response: {
            200: PingResponse,
          },
        },
        handler: async (req, reply) => {
          const body = req.body as Static<typeof AsdfChoiceWrapperModel>;
          return { pong: body.wrapper.choice === "a" };
        },
      });
    });
    await fastify.ready();

    // Validate OpenAPI document
    const jsonResponse = await fastify.inject({
      method: "GET",
      path: "/openapi.json",
    });

    const jsonDoc = JSON.parse(jsonResponse.body);
    const schema = jsonDoc.components?.schemas?.AsdfChoiceWrapperModel;
    expect(schema).toBeDefined();
    expect(schema).toMatchObject({
      type: "object",
      properties: {
        wrapper: {
          $ref: "#/components/schemas/AsdfChoiceModel",
        },
      },
      required: ["wrapper"],
    });

    // Check that AsdfChoiceModel was also included in the schema
    const asdfChoiceModel = jsonDoc.components?.schemas?.AsdfChoiceModel;
    expect(asdfChoiceModel).toBeDefined();
    expect(asdfChoiceModel).toMatchObject({
      type: "object",
      properties: {
        choice: {
          type: "string",
          enum: ["a", "s", "d", "f"],
        },
      },
      required: ["choice"],
    });

    // Validate successful request
    const successResponse = await fastify.inject({
      method: "POST",
      path: "/asdf",
      payload: { wrapper: { choice: "a" } },
    });

    expect(successResponse.statusCode).toBe(200);
    expect(JSON.parse(successResponse.body)).toEqual({ pong: true });

    // Should fail validation - 'z' is not in enum
    const errResponse = await fastify.inject({
      method: "POST",
      path: "/asdf",
      payload: { wrapper: { choice: "z" } },
    });

    expect(errResponse.statusCode).toBe(400);
    const body = JSON.parse(errResponse.body);
    expect(body.message).toMatch(/must be equal to one of the allowed values/);
  });

  test("correctly validates StringEnum with simple nested objects (without schemaType)", async () => {
    const fastify = Fastify(fastifyOpts);
    await fastify.register(oas3Plugin, { ...pluginOpts });

    // Define models without schemaType
    const simpleAsdfModel = StringEnum(["a", "s", "d", "f"]);

    const simpleChoiceObject = Type.Object({
      choice: simpleAsdfModel,
    });

    const simpleWrapperObject = Type.Object({
      wrapper: simpleChoiceObject,
    });

    await fastify.register(async (fastify: FastifyInstance) => {
      fastify.post("/simple-nested", {
        schema: {
          body: simpleWrapperObject,
          response: {
            200: PingResponse,
          },
        },
        handler: async (req, reply) => {
          const body = req.body as Static<typeof simpleWrapperObject>;
          return { pong: ["a", "s", "d", "f"].includes(body.wrapper.choice) };
        },
      });
    });
    await fastify.ready();

    // Validate request with valid enum value
    const validResponse = await fastify.inject({
      method: "POST",
      path: "/simple-nested",
      payload: { wrapper: { choice: "d" } },
    });

    expect(validResponse.statusCode).toBe(200);
    expect(JSON.parse(validResponse.body)).toEqual({ pong: true });

    // Validate request with invalid enum value
    const invalidResponse = await fastify.inject({
      method: "POST",
      path: "/simple-nested",
      payload: { wrapper: { choice: "x" } },
    });

    expect(invalidResponse.statusCode).toBe(400);
    const errorBody = JSON.parse(invalidResponse.body);
    expect(errorBody.message).toMatch(
      /must be equal to one of the allowed values/
    );

    // Validate OpenAPI schema generation
    const jsonResponse = await fastify.inject({
      method: "GET",
      path: "/openapi.json",
    });

    const jsonDoc = JSON.parse(jsonResponse.body);
    // Since we're not using schemaType, check the actual schema in the endpoint
    const requestBody = jsonDoc.paths["/simple-nested"].post.requestBody;
    expect(requestBody).toBeDefined();

    const schema = requestBody.content["application/json"].schema;
    expect(schema).toBeDefined();
    expect(schema.properties.wrapper.properties.choice.enum).toEqual([
      "a",
      "s",
      "d",
      "f",
    ]);
  });
});
