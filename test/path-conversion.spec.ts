import { convertFastifyToOpenAPIPath } from "../src/path-converter.js"; // Assume the function is in this file

describe("convertFastifyToOpenAPIPath", () => {
  // Test simple static paths
  test("should not modify paths without parameters", () => {
    expect(convertFastifyToOpenAPIPath("/users")).toEqual({
      url: "/users",
      paramPatterns: {},
    });
    expect(convertFastifyToOpenAPIPath("/api/v1/products")).toEqual({
      url: "/api/v1/products",
      paramPatterns: {},
    });
  });

  // Test paths with simple parameters
  test("should convert simple path parameters", () => {
    expect(convertFastifyToOpenAPIPath("/users/:userId")).toEqual({
      url: "/users/{userId}",
      paramPatterns: {},
    });
    expect(
      convertFastifyToOpenAPIPath(
        "/api/v1/products/:productId/reviews/:reviewId"
      )
    ).toEqual({
      url: "/api/v1/products/{productId}/reviews/{reviewId}",
      paramPatterns: {},
    });
  });

  // Test paths with regex patterns
  test("should convert regex patterns to OpenAPI style parameters", () => {
    expect(
      convertFastifyToOpenAPIPath("/user/:action(profile|settings)")
    ).toEqual({
      url: "/user/{action}",
      paramPatterns: { action: "profile|settings" },
    });
    expect(
      convertFastifyToOpenAPIPath("/api/v:version(\\d+)/users/:userId")
    ).toEqual({
      url: "/api/v{version}/users/{userId}",
      paramPatterns: { version: "\\d+" },
    });
  });

  // Test paths with multiple regex patterns
  test("should handle multiple regex patterns in a single path", () => {
    expect(
      convertFastifyToOpenAPIPath(
        "/api/:apiVersion(v1|v2)/:resource/:id(\\d+)-:status([a-z]+)"
      )
    ).toEqual({
      url: "/api/{apiVersion}/{resource}/{id}-{status}",
      paramPatterns: {
        apiVersion: "v1|v2",
        id: "\\d+",
        status: "[a-z]+",
      },
    });
  });

  // Test paths with regex patterns and simple parameters
  test("should handle a mix of regex patterns and simple parameters", () => {
    expect(
      convertFastifyToOpenAPIPath("/:resource/:id(\\d+)-:status/:category")
    ).toEqual({
      url: "/{resource}/{id}-{status}/{category}",
      paramPatterns: { id: "\\d+" },
    });
  });

  // Test edge cases
  test("should handle edge cases", () => {
    // Empty path
    expect(convertFastifyToOpenAPIPath("")).toEqual({
      url: "",
      paramPatterns: {},
    });

    // Path with only a parameter
    expect(convertFastifyToOpenAPIPath(":param")).toEqual({
      url: "{param}",
      paramPatterns: {},
    });

    // Path with a regex at the end
    expect(convertFastifyToOpenAPIPath("/users/:id(\\d+)")).toEqual({
      url: "/users/{id}",
      paramPatterns: { id: "\\d+" },
    });

    // Path with a regex at the start
    expect(
      convertFastifyToOpenAPIPath(":userType(admin|user)/:role/dashboard")
    ).toEqual({
      url: "{userType}/{role}/dashboard",
      paramPatterns: { userType: "admin|user" },
    });
  });

  // Test paths with special characters in regex
  test("should handle paths with special characters in regex", () => {
    expect(
      convertFastifyToOpenAPIPath("/user/:username([a-zA-Z0-9_-]+)")
    ).toEqual({
      url: "/user/{username}",
      paramPatterns: { username: "[a-zA-Z0-9_-]+" },
    });
    expect(convertFastifyToOpenAPIPath("/file/:filename(\\.[a-z]+)")).toEqual({
      url: "/file/{filename}",
      paramPatterns: { filename: "\\.[a-z]+" },
    });
  });
});
