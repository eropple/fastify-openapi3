import { camelCase } from "change-case";
import { type RouteOptions } from "fastify";

export type OperationIdFn = (route: RouteOptions) => string;

// TODO:  this is a typescript crime
//        I know that `RouteOptions` has `prefix`. Why does TypeScript not?
export const defaultOperationIdFn: OperationIdFn = (route) =>
  camelCase(
    route.url
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .replace(new RegExp(`^${(route as any).prefix}`), "")
      .replace("/", " ") +
      " " +
      route.method
  );
