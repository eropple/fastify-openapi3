/**
 * Base class for errors found during startup.
 */
export class OAS3PluginError extends Error {}

export class OAS3PluginOptionsError extends OAS3PluginError {
  constructor(msg: string) {
    super(`Problem with OAS3 plugin config: ${msg}`);
  }
}

export class OAS3SpecValidationError extends OAS3PluginError {
  constructor() {
    super("Failed to validate OpenAPI specification. Check logs for errors.");
  }
}

/**
 * Base class for errors discovered when handling requests.
 */
export class OAS3RequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

export class OAS3RequestBadRequestError extends OAS3RequestError {
  constructor(message: string = "Bad Request") {
    super(message, 400);
  }
}

export class OAS3RequestUnauthorizedError extends OAS3RequestError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

export class OAS3RequestForbiddenError extends OAS3RequestError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}
