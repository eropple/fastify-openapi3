import '../src/extensions.js';
import Fastify, { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Static, Type } from '@sinclair/typebox';

import { oas3Plugin, OAS3PluginOptions } from '../src/plugin.js';
import { schemaType } from '../src/schemas.js';
import { APPLICATION_JSON } from '../src/constants.js';

const pluginOpts: OAS3PluginOptions = {
  openapiInfo: {
    title: "test",
    version: "0.1.0",
  },
};

describe('plugin', () => {
  test('can add a base GET route', async () => {
    // TODO: fastify acts oddly when you pass the same schema objects to multiple Fastify servers?
    const PingResponse = schemaType('PingResponse', Type.Object({ pong: Type.Boolean() }));
    type PingResponse = Static<typeof PingResponse>;

    const fastify = Fastify({ logger: { level: 'error' } });
    await fastify.register(oas3Plugin, { ...pluginOpts });

    // we do this inside a prefixed scope to smoke out prefix append errors
    await fastify.register(async (fastify: FastifyInstance) => {
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
  });

  test('will error on an invalid spec', async () => {
    const fastify = Fastify({ logger: { level: 'silent' } });
    await fastify.register(oas3Plugin, {
      ...pluginOpts,
      postParse: (oas) => {
        (oas.rootDoc.openapi as any) = 42;
      },
      exitOnInvalidDocument: true,
    });

    try {
      await fastify.ready();
      expect("this should have failed").toEqual(false);
    } catch (err) { /* this is ok */ }
  });

  test('will serve an OAS json doc', async () => {
    // TODO: fastify acts oddly when you pass the same schema objects to multiple Fastify servers?
    const PingResponse = schemaType('PingResponse', Type.Object({ pong: Type.Boolean() }));
    type PingResponse = Static<typeof PingResponse>;

    const fastify = Fastify({ logger: { level: 'error' } });
    await fastify.register(oas3Plugin, { ...pluginOpts });

    // we do this inside a prefixed scope to smoke out prefix append errors
    await fastify.register(async (fastify: FastifyInstance) => {
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

    const response = await fastify.inject({
      method: 'GET',
      path: '/openapi.json',
    });

    const doc = JSON.parse(response.body);

    expect(doc).toMatchObject(fastify.openapiDocument);
  });
});
