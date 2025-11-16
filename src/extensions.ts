import "fastify";
import "openapi3-ts";
import "typebox";

import { type FastifySchema } from "fastify";
import type { OpenAPIObject } from "openapi3-ts";
import { type TSchema } from "typebox";

import { type HandlerRetval } from "./autowired-security/types/handlers.js";
import type { OAS3ResponseTable, OAS3RouteOptions } from "./options.js";
import type { TaggedSchema } from "./schemas.js";

/* eslint-disable @typescript-eslint/no-empty-object-type */

export type OAS3SecurityEvaluation = {
  result: HandlerRetval;
};

declare module "fastify" {
  interface FastifyInstance {
    readonly openapiDocument: Readonly<OpenAPIObject>;
  }

  interface FastifyRequest {
    oasSecurity?: OAS3SecurityEvaluation;
  }

  interface FastifyReply {}

  interface RouteOptions {
    oas?: OAS3RouteOptions;

    schema?: FastifySchema & {
      body?: TSchema & TaggedSchema;
      response?: OAS3ResponseTable<TSchema & TaggedSchema>;
    };
  }

  interface RouteShorthandOptions {
    oas?: OAS3RouteOptions;
  }
}

declare module "openapi3-ts" {
  interface SchemaObject extends Partial<TaggedSchema> {}
}

declare module "typebox" {
  interface CustomOptions extends Partial<TaggedSchema> {}
}
