import "../extensions.js";
import Fastify, { type FastifyInstance } from "fastify";
import type { SchemaObject } from "openapi3-ts";
import { type Static, Type } from "typebox";
import { describe, expect, test } from "vitest";

import { APPLICATION_JSON } from "../constants.js";
import { type OAS3PluginOptions, oas3Plugin } from "../plugin.js";
import { schemaType } from "../schemas.js";

const pluginOpts: OAS3PluginOptions = {
  openapiInfo: {
    title: "test",
    version: "0.1.0",
  },
};

describe("bug 006", () => {
  test("supports a response type with a nested object", async () => {
    const TestResponseInner = schemaType(
      "TestResponseInner",
      Type.Object({ foo: Type.String() }),
    );
    type TestResponseInner = Static<typeof TestResponseInner>;

    const TestResponse = schemaType(
      "TestResponse",
      Type.Object({ bar: TestResponseInner }),
    );
    type TestResponse = Static<typeof TestResponse>;

    const fastify = Fastify({ logger: { level: "error" } });
    await fastify.register(oas3Plugin, { ...pluginOpts });

    const ret = {
      bar: {
        foo: "baz",
      },
    };

    await fastify.register(async (fastify: FastifyInstance) => {
      fastify.route<{ Reply: TestResponse }>({
        url: "/nested",
        method: "GET",
        schema: {
          response: {
            200: TestResponse,
          },
        },
        oas: {},
        handler: () => ret,
      });
    });
    await fastify.ready();

    const oas = fastify.openapiDocument;
    const op = oas.paths?.["/nested"]?.get;

    expect(oas.components?.schemas?.TestResponse).toBeTruthy();
    expect(oas.components?.schemas?.TestResponseInner).toBeTruthy();
    expect(
      (oas.components?.schemas?.TestResponse as SchemaObject)?.properties?.bar
        ?.$ref,
    ).toEqual("#/components/schemas/TestResponseInner");
    expect(op?.responses?.["200"]?.content?.[APPLICATION_JSON]?.schema).toEqual(
      { $ref: "#/components/schemas/TestResponse" },
    );

    const response = await fastify.inject({
      method: "GET",
      url: "/nested",
    });
    const responseBody = response.json();

    expect(response.statusCode).toEqual(200);
    expect(responseBody).toMatchObject(ret);
  });
});
