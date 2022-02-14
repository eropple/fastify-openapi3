import { camelCase } from "change-case";
import { RouteOptions } from "fastify";

export type OperationIdFn = (route: RouteOptions) => string;

// TODO:  this is a typescript crime
//        I know that `RouteOptions` has `prefix`. Why does TypeScript not?
export const defaultOperationIdFn: OperationIdFn = (route) =>
  camelCase(
    route.url
      .replace(new RegExp(`^${(route as any).prefix}`), "")
      .replace("/", " ") +
      " " +
      route.method
  );
