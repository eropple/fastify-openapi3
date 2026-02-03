import { type Static, Type } from "@sinclair/typebox";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";

import OAS3Plugin, {
  type OAS3PluginOptions,
  oas3PluginAjv,
  schemaType,
} from "../src/index.js";

const QwopModel = schemaType(
  "QwopRequestBody",
  Type.Object({ qwop: Type.Number() }),
);
type QwopModel = Static<typeof QwopModel>;
const PingResponse = schemaType(
  "PingResponse",
  Type.Object({ pong: Type.Boolean() }),
);
type PingResponse = Static<typeof PingResponse>;

const pluginOpts: OAS3PluginOptions = {
  openapiInfo: {
    title: "Test Document",
    version: "0.1.0",
  },
  publish: {
    ui: "scalar",
    scalarExtraOptions: {
      theme: "solarized",
    },
    json: true,
    yaml: true,
  },
};

console.log(pluginOpts);

const run = async () => {
  const fastifyOpts: FastifyServerOptions = {
    logger: { level: "error" },
    ajv: {
      plugins: [oas3PluginAjv],
    },
  };

  const fastify = Fastify(fastifyOpts);
  await fastify.register(OAS3Plugin, { ...pluginOpts });

  // we do this inside a prefixed scope to smoke out prefix append errors
  await fastify.register(
    async (fastify: FastifyInstance) => {
      fastify.route<{ Reply: PingResponse }>({
        url: "/ping",
        method: "GET",
        schema: {
          response: {
            200: PingResponse,
          },
        },
        oas: {
          operationId: "pingPingPingAndDefinitelyNotPong",
          summary: "a ping to the server",
          description:
            "This ping to the server lets you know that it has not been eaten by a grue.",
          deprecated: false,
          tags: ["meta"],
        },
        handler: async (req, reply) => {
          return { pong: true };
        },
      });

      fastify.route<{ Body: QwopModel; Reply: PingResponse }>({
        url: "/qwop",
        method: "POST",
        schema: {
          querystring: Type.Object({
            value: Type.Number({ minimum: 0, maximum: 1000 }),
            verbose: Type.Optional(Type.Boolean()),
          }),
          body: QwopModel,
          response: {
            201: PingResponse,
          },
        },
        oas: {},
        handler: async (req, reply) => {
          return { pong: true };
        },
      });
    },
    { prefix: "/api" },
  );

  // const port = Math.floor(Math.random() * 10000) + 10000;
  const port = 48484;

  console.log(`Test server going up at http://localhost:${port}.`);

  console.log(`JSON: http://localhost:${port}/openapi.json`);
  console.log(`YAML: http://localhost:${port}/openapi.yaml`);
  console.log(`UI:   http://localhost:${port}/docs`);

  fastify.listen({
    port,
  });
};

run();
