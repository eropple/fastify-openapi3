import { type OAuthFlowObject, type SecuritySchemeObject } from "openapi3-ts";

import {
  type HttpBasicHandlerFn,
  type ApiKeyHandlerFn,
  type HttpBearerFn,
} from "./handlers.js";

export type ApiKeySecurityScheme = {
  type: "apiKey";
  name: string;
  description?: string;
  in: "header" | "query" | "cookie";
  /**
   * Invoked with the contents of the appropriate field. No pre-validation is performed; may be empty.
   */
  fn: ApiKeyHandlerFn;
};

export type BasicAuthSecurityScheme = {
  type: "http";
  description?: string;
  scheme: "basic";
  /**
   * Invoked with the username and password. No pre-validation is performed; either may be empty.
   */
  fn: HttpBasicHandlerFn;
};

export type BearerSecurityScheme = {
  type: "http";
  description?: string;
  scheme: "bearer";
  /**
   * Invoked with the contents of the bearer token, AFTER `Bearer` has been stripped off. No other
   * pre-validation is performed; may be empty.
   *
   * If `Bearer` is not found, this will
   */
  fn: HttpBearerFn;
};

// export type OAuth2SecurityScheme = {
//   type: "oauth2";
//   description?: string;
//   flows: {
//     implicit: OAuthFlowObject;
//     password: OAuthFlowObject;
//     clientCredentials: OAuthFlowObject;
//     authorizationCode: OAuthFlowObject;
//   };
// };

// export type OpenIDConnectSecurityScheme = {
//   type: "openIdConnect";
//   description?: string;
//   openIdConnectUrl: string;
// };

export type OAS3PluginSecurityScheme =
  | ApiKeySecurityScheme
  | BasicAuthSecurityScheme
  | BearerSecurityScheme;
// | OAuth2SecurityScheme;
