import { type FastifyRequest } from "fastify";

export type FastifyRequestWithCookies = FastifyRequest & {
  cookies?: {
    [key: string]: string;
  };
};
