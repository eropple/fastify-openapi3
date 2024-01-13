import '../src/extensions.js';
import Fastify, { FastifyInstance } from 'fastify';
import { Static, Type } from '@sinclair/typebox';

import { oas3Plugin, OAS3PluginOptions } from '../src/plugin.js';
import { schemaType } from '../src/schemas.js';
import { APPLICATION_JSON } from '../src/constants.js';
import { SchemaObject } from "openapi3-ts";

const pluginOpts: OAS3PluginOptions = {
  openapiInfo: {
    title: "test",
    version: "0.1.0",
  },
};

describe('bug 006', () => {
  test('supports a response type with a nested object', async () => {
    const TestResponseInner = schemaType('TestResponseInner', Type.Object({ foo: Type.String() }));
    type TestResponseInner = Static<typeof TestResponseInner>;

    const TestResponse = schemaType('TestResponse', Type.Object({ bar: TestResponseInner }));
    type TestResponse = Static<typeof TestResponse>;

    const fastify = Fastify({ logger: { level: 'error' } });
    await fastify.register(oas3Plugin, { ...pluginOpts });

    const ret = {
      bar: {
        foo: 'baz',
      },
    };

    await fastify.register(async (fastify: FastifyInstance) => {
      fastify.route<{ Reply: TestResponse }>({
        url: '/nested',
        method: 'GET',
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
    const op = oas.paths?.['/nested']?.get;

    expect(oas.components?.schemas?.TestResponse).toBeTruthy();
    expect(oas.components?.schemas?.TestResponseInner).toBeTruthy();
    expect((oas.components?.schemas?.TestResponse as SchemaObject)?.properties?.bar?.$ref)
      .toEqual('#/components/schemas/TestResponseInner');
    expect(op?.responses?.['200']?.content?.[APPLICATION_JSON]?.schema)
      .toEqual({ $ref: '#/components/schemas/TestResponse' });

    const response = await fastify.inject({
      method: 'GET',
      url: '/nested',
    });
    const responseBody = response.json();

    expect(response.statusCode).toEqual(200);
    expect(responseBody).toMatchObject(ret);
  });
});
