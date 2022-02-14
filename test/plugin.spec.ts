import '../src/extensions.js';
import Fastify from 'fastify';
import { Static, Type } from '@sinclair/typebox';
import { inspect } from 'util';

import { oas3Plugin, OAS3PluginOptions } from '../src/plugin.js';
import { schemaType } from '../src/schemas.js';
import { APPLICATION_JSON } from '../src/constants.js';

const PingResponse = schemaType('PingResponse', Type.Object({ pong: Type.Boolean() }));
type PingResponse = Static<typeof PingResponse>;

const pluginOpts: OAS3PluginOptions = {
  openapiInfo: {
    title: "test",
    version: "0.1.0",
  }
};

describe('plugin', () => {
  test('can add a base GET route', async () => {
    const fastify = Fastify({ logger: { level: 'debug' } });
    fastify.register(oas3Plugin, { ...pluginOpts });

    // we do this inside a prefixed scope to smoke out prefix append errors
    fastify.register(async (fastify) => {
      // TODO: once fastify 4.x hits and type providers are a thing, this should be refactored
      fastify.route<{ Reply: PingResponse }>({
        url: '/ping',
        method: 'GET',
        schema: {
          response: {
            200: PingResponse,
          },
        },
        oas: {

        },
        handler: async (req, reply) => {
          return { pong: true };
        }
      });
    }, { prefix: '/api' });

    await fastify.ready();

    const oas = fastify.openapiDocument;
    const op = oas.paths?.['/api/ping']?.get;

    expect(oas.components?.schemas?.PingResponse).toBeTruthy();
    expect(op?.operationId).toEqual("pingGet");
    expect(op?.responses?.['200']?.content?.[APPLICATION_JSON]?.schema)
      .toEqual({ $ref: '#/components/schemas/PingResponse' });
  })
});
