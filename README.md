# `@eropple/fastify-openapi3` #
_Because I just can't stop making OpenAPI libraries, I guess._

[![NPM version](https://img.shields.io/npm/v/@eropple/fastify-openapi3)](https://www.npmjs.com/package/@eropple/fastify-openapi3) [![CI](https://github.com/eropple/fastify-openapi3/actions/workflows/ci.yaml/badge.svg)](https://github.com/eropple/fastify-openapi3/actions/workflows/ci.yaml)

## What is it? ##
This is a library to help you generate [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0)-compliant (or 3.0.3 if you do a little work on your own) specs from your [Fastify](https://www.fastify.io/) app. Others exist, but to my mind don't scratch the itch that the best OAS tooling does: making it faster and easier to create correct specs and valid API clients from those specs. Because of my [own](https://github.com/modern-project/modern-ruby) [background](https://github.com/eropple/nestjs-openapi3) in building OpenAPI libraries, and my growing appreciation for Fastify, I decided to take a crack at it.

This library presupposes that you use [`@sinclair/typebox`](https://github.com/sinclairzx81/typebox) to define the JSON schema used in your requests, and from that JSON Schema derives types. (Ergonomics for non-TypeScript users is specifically out-of-scope.) It will walk all your routes, determine your schema, and extract and deduplicate those schemas to present a relatively clean and easy-to-use OpenAPI document. It'll then also serve JSON and YAML versions of your specification, as well as host an interactive API explorer with try-it-out features courtesy of [Rapidoc](https://mrin9.github.io/RapiDoc/) or [Scalar](https://scalar.com).

**Fair warning:** This library is in Early Access(tm) and while the functionality that's here does work, there's some functionality that _doesn't_ exist. The stuff that stands out to me personally can be found in [TODO.md](https://github.com/eropple/fastify-openapi3/blob/main/TODO.md), including a short list of things this plugin _won't_ do.

## Usage ##

First, install it, etc. etc.:

```bash
npm install @eropple/fastify-openapi3
pnpm add @eropple/fastify-openapi3
yarn add @eropple/fastify-openapi3
```

Once you've installed it--well, you'd best go do some things to set it up, huh? There's a manual test (originally added to smoke out issues with Rapidoc serving) in [`examples/start-server.ts`], which can also be directly invoked from the repository with `npm run demo`. Below are the important bits from that demo:

```ts
import Fastify, { FastifyInstance } from 'fastify';
import { Static, Type } from '@sinclair/typebox';

import OAS3Plugin, { OAS3PluginOptions, schemaType, oas3PluginAjv } from '../src/index.js';
```

Your imports. (Obviously, in your project, the last import will be from `"@eropple/fastify-openapi3"`.)

```ts
const fastifyOpts: FastifyServerOptions = {
  logger: { level: 'error' },
  ajv: {
    plugins: [oas3PluginAjv],
  }
}

const fastify = Fastify(fastifyOpts);
await fastify.register(OAS3Plugin, { ...pluginOpts });
```

Register the OAS3 plugin. This plugin uses the Fastify logger and can be pretty chatty on `debug`, so bear that in mind. `pluginOpts` is visible in that file for an example, but it's also commented exhaustively for your IntellSensing pleasure while you're writing it.

```ts
const PingResponse = schemaType('PingResponse', Type.Object({ pong: Type.Boolean() }));
type PingResponse = Static<typeof PingResponse>;
```

Your schema. `schemaType` takes a string as a name, which _must be unique for your entire project_, as well as a `@sinclair/typebox` `Type` (which you can then use as a TypeScript type by doing `Static<typeof T>`, it's awesome). This is now a `TaggedSchema`, which can be used anywhere a normal JSON Schema object can be used within Fastify and will handle validation as you would expect.

If you use a `TaggedSchema` within another schema, the OAS3 plugin is smart enough to extract it into its own OpenAPI `#/components/schemas/YourTypeHere` entry, so your generated clients will also only have the minimal set of model classes, etc. to worry about. Ditto having them in arrays and so on. I've tried to make this as simple to deal with as possible; if it acts in ways you don't expect, _please file an issue_.

And now let's make a route:

```ts
  await fastify.register(async (fastify: FastifyInstance) => {
    fastify.route<{ Reply: PingResponse }>({
      url: '/ping',
      method: 'GET',
      schema: {
        response: {
          200: PingResponse,
        },
      },
      oas: {
        operationId: 'pingPingPingAndDefinitelyNotPong',
        summary: "a ping to the server",
        description: "This ping to the server lets you know that it has not been eaten by a grue.",
        deprecated: false,
        tags: ['meta'],
      },
      handler: async (req, reply) => {
        return { pong: true };
      }
    });
  }, { prefix: '/api' });
```

You don't have to put yours inside a prefixed route, but I like to, so, well, there you go.

If you do a `npm run demo`, you'll get a UI that looks like the following:

![a docs screenshot](https://i.imgur.com/iOPApmq.png)

And there you go.

## Contributing ##
Issues and PRs welcome! Constructive criticism on how to improve the library would be awesome, even as I use it in my own stuff and figure out where to go from there, too.

**Before you start in on a PR, however**, please do me a solid and drop an issue so we can discuss the approach. Thanks!
