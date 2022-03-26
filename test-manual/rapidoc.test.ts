import Fastify, { FastifyInstance } from 'fastify';
import { Static, Type } from '@sinclair/typebox';

import { schemaType } from '../src/schemas.js';
import { oas3Plugin, OAS3PluginOptions } from '../src/plugin.js';

const PingResponse = schemaType('PingResponse', Type.Object({ pong: Type.Boolean() }));
type PingResponse = Static<typeof PingResponse>;

const pluginOpts: OAS3PluginOptions = {
  openapiInfo: {
    title: "Test Document",
    version: "0.1.0",
  },
  publish: {
    ui: 'rapidoc',
    json: true,
    yaml: true,
  },
};

const run = async () => {
  const fastify = Fastify({ logger: { level: 'error' } });
  await fastify.register(oas3Plugin, { ...pluginOpts });

  // we do this inside a prefixed scope to smoke out prefix append errors
  await fastify.register(async (fastify: FastifyInstance) => {
    fastify.route<{ Reply: PingResponse }>({
      url: '/ping',
      method: 'GET',
      schema: {
        response: {
          200: PingResponse,
        },
      },
      oas: {},
      handler: async (req, reply) => {
        return { pong: true };
      }
    });
  }, { prefix: '/api' });

  const port = Math.floor(Math.random() * 10000) + 10000;

  console.log(`Test server going up at http://localhost:${port}.`);

  console.log(`JSON: http://localhost:${port}/openapi.json`);
  console.log(`YAML: http://localhost:${port}/openapi.yaml`);
  console.log(`UI:   http://localhost:${port}/docs`);

  fastify.listen(port), (err: any) => {
    if (err) {
      fastify.log.error({ err });
      process.exit(2);
    }
  }
};

run();
