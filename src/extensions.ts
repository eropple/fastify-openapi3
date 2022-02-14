import "fastify";
import "openapi3-ts";
import "@sinclair/typebox";

import type { OpenAPIObject, SchemaObject } from 'openapi3-ts';

import type { TaggedSchema } from './schemas.js';
import type { OAS3ResponseTable, OAS3RouteOptions } from './options.js';
import { FastifySchema } from 'fastify';



declare module "fastify" {
  interface FastifyInstance {
    readonly openapiDocument: Readonly<OpenAPIObject>;
  }

  interface FastifyRequest {}

  interface FastifyReply {}

  interface RouteOptions {
    oas?: OAS3RouteOptions;

    schema?: FastifySchema & { response?: OAS3ResponseTable<SchemaObject> };
  }
}

declare module "openapi3-ts" {
  interface SchemaObject extends Partial<TaggedSchema> {

  }
}

declare module "@sinclair/typebox" {
  interface CustomOptions extends Partial<TaggedSchema> {
  }
}
