import { Type } from "@sinclair/typebox";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import { describe, expect, test } from "vitest";

import { oas3PluginAjv } from "../ajv.js";
import { type OAS3AutowireSecurityOptions } from "../autowired-security/index.js";
import { type OAS3PluginOptions } from "../options.js";
import { oas3Plugin } from "../plugin.js";

const fastifyOpts: FastifyServerOptions = {
  logger: { level: "error" },
  ajv: {
    customOptions: {
      coerceTypes: true,
    },
    plugins: [oas3PluginAjv],
  },
};
const pluginOpts: OAS3PluginOptions = {
  openapiInfo: {
    title: "test",
    version: "0.1.0",
  },
};
const autowiredOpts: OAS3AutowireSecurityOptions = {
  disabled: false,
  securitySchemes: {},
};

describe("autowired security", () => {
  describe("doc generation", () => {
    test("attaching security schemes to document works", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, {
        ...pluginOpts,
        autowiredSecurity: {
          ...autowiredOpts,
          securitySchemes: {
            TestScheme: {
              type: "apiKey",
              in: "header",
              name: "X-Test-Key",
              fn: () => ({ ok: true }),
            },
          },
        },
      });

      await fastify.ready();

      const jsonDoc = JSON.parse(
        (
          await fastify.inject({
            method: "GET",
            path: "/openapi.json",
          })
        ).body
      );

      expect(jsonDoc.components.securitySchemes).toMatchObject({
        TestScheme: {
          type: "apiKey",
          in: "header",
          name: "X-Test-Key",
        },
      });
      expect(jsonDoc.components.securitySchemes.TestScheme.fn).toBeFalsy();
    });
  });

  describe("configuration checks", () => {
    test("does not yell at unrecognized schemes if disabled", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, {
        ...pluginOpts,
        autowiredSecurity: {
          ...autowiredOpts,
          disabled: true,
        },
      });

      fastify.get(
        "/boop",
        {
          oas: {
            security: {
              ANonsenseItem: [],
            },
          },
        },
        async (request, reply) => {
          return "hi";
        }
      );

      expect(async () => fastify.ready()).not.toThrow();
    });

    test("allows unrecognized schemes when configured to", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, {
        ...pluginOpts,
        autowiredSecurity: {
          ...autowiredOpts,
          disabled: false,
          allowUnrecognizedSecurity: true,
        },
      });

      fastify.get(
        "/boop",
        {
          oas: {
            security: {
              ANonsenseItem: [],
            },
          },
        },
        async (request, reply) => {
          return "hi";
        }
      );

      expect(async () => fastify.ready()).not.toThrow();
    });

    // TODO:  fix test
    //        this fails because it throws in onRoute, which blows up the server (good!)
    //        but can't be caught in the test (bad!)
    //   test("by default, requires a route-level security if no root security", async () => {
    //     const fastify = Fastify(fastifyOpts);
    //     await fastify.register(oas3Plugin, {
    //       ...pluginOpts,
    //       autowiredSecurity: {
    //         ...autowiredOpts,
    //       },
    //     });

    //     try {
    //       fastify.get(
    //         "/boop",
    //         {
    //           schema: {
    //             response: {
    //               200: Type.Object({}),
    //             },
    //           },
    //           oas: {},
    //         },
    //         async (request, reply) => {
    //           return "hi";
    //         }
    //       );

    //       throw new Error("onRoute failed to throw");
    //     } catch (err) {
    //       expect(err).toBeInstanceOf(Error);
    //       expect((err as Error).message).toContain(
    //         "has no security defined, and rootSecurity is not defined"
    //       );
    //     }
    //   });

    test("allows no route-level handlers when root security is not set when options permits", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, {
        ...pluginOpts,
        autowiredSecurity: {
          ...autowiredOpts,
          allowEmptySecurityWithNoRoot: true,
        },
      });

      fastify.get(
        "/boop",
        {
          schema: {
            response: {
              200: Type.Object({}),
            },
          },
          oas: {},
        },
        async (request, reply) => {
          return "hi";
        }
      );

      expect(async () => fastify.ready()).not.toThrow();
    });
  });

  describe("autowired handlers", () => {
    describe("API key handlers", () => {
      test("empty security allows anything", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              MyApiKey: {
                type: "apiKey",
                in: "header",
                name: "X-My-Key",
                fn: () => ({ ok: true }),
              },
            },
          },
        });

        fastify.get(
          "/boop",
          {
            schema: {
              response: {
                200: Type.Object({}),
              },
            },
            oas: {
              security: [],
            },
          },
          async (request, reply) => {
            return "hello";
          }
        );

        await fastify.ready();

        const response = await fastify.inject({
          method: "GET",
          path: "/boop",
        });

        expect(response.statusCode).toBe(200);
      });

      test("basic API key handler works", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              MyApiKey: {
                type: "apiKey",
                in: "header",
                name: "X-My-Key",
                fn: (header, request) => {
                  return header === "test"
                    ? { ok: true }
                    : { ok: false, reason: "UNAUTHORIZED" };
                },
              },
            },
          },
        });

        fastify.get(
          "/boop",
          {
            schema: {
              response: {
                200: Type.Object({}),
              },
            },
            oas: {
              security: {
                MyApiKey: [],
              },
            },
          },
          async (request, reply) => {
            return "hello";
          }
        );

        await fastify.ready();
        const response = await fastify.inject({
          method: "GET",
          path: "/boop",
          headers: {
            "X-My-Key": "test",
          },
        });

        expect(response.statusCode).toBe(200);

        const response2 = await fastify.inject({
          method: "GET",
          path: "/boop",
          headers: {
            "X-My-Key": "not-test",
          },
        });

        expect(response2.statusCode).toBe(401);
      });

      test("http basic handler works", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              MyHttpBasic: {
                type: "http",
                scheme: "basic",
                fn: (credentials, request) => {
                  return credentials.username === "test" &&
                    credentials.password === "pwd"
                    ? { ok: true }
                    : { ok: false, reason: "UNAUTHORIZED" };
                },
              },
            },
          },
        });

        fastify.get(
          "/boop",
          {
            schema: {
              response: {
                200: Type.Object({}),
              },
            },
            oas: {
              security: {
                MyHttpBasic: [],
              },
            },
          },
          async (request, reply) => {
            return "hello";
          }
        );

        await fastify.ready();

        const encodedGood = Buffer.from("test:pwd").toString("base64");
        const encodedBad = Buffer.from("test:not-pwd").toString("base64");

        const response = await fastify.inject({
          method: "GET",
          path: "/boop",
          headers: {
            Authorization: "Basic " + encodedGood,
          },
        });

        expect(response.statusCode).toBe(200);

        const response2 = await fastify.inject({
          method: "GET",
          path: "/boop",
          headers: {
            Authorization: "Basic " + encodedBad,
          },
        });

        expect(response2.statusCode).toBe(401);
      });
    });

    test("http bearer", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, {
        ...pluginOpts,
        autowiredSecurity: {
          ...autowiredOpts,
          securitySchemes: {
            MyHttpBearer: {
              type: "http",
              scheme: "bearer",
              fn: (token, request) => {
                return token === "test"
                  ? { ok: true }
                  : { ok: false, reason: "UNAUTHORIZED" };
              },
            },
          },
        },
      });

      fastify.get(
        "/boop",
        {
          schema: {
            response: {
              200: Type.Object({}),
            },
          },
          oas: {
            security: {
              MyHttpBearer: [],
            },
          },
        },
        async (request, reply) => {
          return "hello";
        }
      );

      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        path: "/boop",
        headers: {
          Authorization: "Bearer test",
        },
      });

      expect(response.statusCode).toBe(200);

      const response2 = await fastify.inject({
        method: "GET",
        path: "/boop",
        headers: {
          Authorization: "Bearer not-test",
        },
      });

      expect(response2.statusCode).toBe(401);
    });
  });

  test("OR security handlers work (separate array entries)", async () => {
    const fastify = Fastify(fastifyOpts);
    await fastify.register(oas3Plugin, {
      ...pluginOpts,
      autowiredSecurity: {
        ...autowiredOpts,
        securitySchemes: {
          MyApiKey: {
            type: "apiKey",
            in: "header",
            name: "X-Test-Key",
            fn: (key, request) => {
              return key === "test"
                ? { ok: true }
                : { ok: false, reason: "UNAUTHORIZED" };
            },
          },
          MySecondKey: {
            type: "apiKey",
            in: "header",
            name: "X-Test-Second-Key",
            fn: (key, request) => {
              return key === "test"
                ? { ok: true }
                : { ok: false, reason: "UNAUTHORIZED" };
            },
          },
        },
      },
    });

    fastify.get(
      "/boop",
      {
        schema: {
          response: {
            200: Type.Object({}),
          },
        },
        oas: {
          security: [{ MyApiKey: [] }, { MySecondKey: [] }],
        },
      },
      async (request, reply) => {
        return "hello";
      }
    );

    await fastify.ready();

    const response = await fastify.inject({
      method: "GET",
      path: "/boop",
      headers: {
        "X-Test-Key": "test",
      },
    });

    expect(response.statusCode).toBe(200);

    const response2 = await fastify.inject({
      method: "GET",
      path: "/boop",
      headers: {
        "X-Test-Second-Key": "test",
      },
    });

    expect(response2.statusCode).toBe(200);

    const response3 = await fastify.inject({
      method: "GET",
      path: "/boop",
      headers: {
        "X-Test-Key": "not-test",
      },
    });

    expect(response3.statusCode).toBe(401);
  });

  test("AND handler (multiple keys in same object)", async () => {
    const fastify = Fastify(fastifyOpts);
    await fastify.register(oas3Plugin, {
      ...pluginOpts,
      autowiredSecurity: {
        ...autowiredOpts,
        securitySchemes: {
          MyApiKey: {
            type: "apiKey",
            in: "header",
            name: "X-Test-Key",
            fn: (key, request) => {
              return key === "test"
                ? { ok: true }
                : { ok: false, reason: "UNAUTHORIZED" };
            },
          },
          MySecondKey: {
            type: "apiKey",
            in: "header",
            name: "X-Test-Second-Key",
            fn: (key, request) => {
              return key === "test2"
                ? { ok: true }
                : { ok: false, reason: "UNAUTHORIZED" };
            },
          },
        },
      },
    });

    fastify.get(
      "/boop",
      {
        schema: {
          response: {
            200: Type.Object({}),
          },
        },
        oas: {
          security: {
            MyApiKey: [],
            MySecondKey: [],
          },
        },
      },
      async (request, reply) => {
        return "hello";
      }
    );

    await fastify.ready();

    const response = await fastify.inject({
      method: "GET",
      path: "/boop",
      headers: {
        "X-Test-Key": "test",
        "X-Test-Second-Key": "test2",
      },
    });

    expect(response.statusCode).toBe(200);

    const response2 = await fastify.inject({
      method: "GET",
      path: "/boop",
      headers: {
        "X-Test-Key": "test",
        "X-Test-Second-Key": "not-test2",
      },
    });

    expect(response2.statusCode).toBe(401);

    const response3 = await fastify.inject({
      method: "GET",
      path: "/boop",
      headers: {
        "X-Test-Key": "not-test",
        "X-Test-Second-Key": "test2",
      },
    });

    expect(response3.statusCode).toBe(401);

    const response4 = await fastify.inject({
      method: "GET",
      path: "/boop",
      headers: {
        "X-Test-Key": "test",
      },
    });

    expect(response4.statusCode).toBe(401);

    const response5 = await fastify.inject({
      method: "GET",
      path: "/boop",
      headers: {
        "X-Test-Second-Key": "test2",
      },
    });

    expect(response5.statusCode).toBe(401);
  });

  test("root security should apply if route-specific doesn't exist", async () => {
    const fastify = Fastify(fastifyOpts);
    await fastify.register(oas3Plugin, {
      ...pluginOpts,
      autowiredSecurity: {
        ...autowiredOpts,
        rootSecurity: { MyApiKey: [] },
        securitySchemes: {
          MyApiKey: {
            type: "apiKey",
            in: "header",
            name: "X-Test-Key",
            fn: (key, request) => {
              return key === "test"
                ? { ok: true }
                : { ok: false, reason: "UNAUTHORIZED" };
            },
          },
        },
      },
    });

    fastify.get(
      "/boop",
      {
        schema: {
          response: {
            200: Type.Object({}),
          },
        },
        oas: {},
      },
      async (request, reply) => {
        return "hello";
      }
    );

    await fastify.ready();

    const response = await fastify.inject({
      method: "GET",
      path: "/boop",
      headers: {
        "X-Test-Key": "test",
      },
    });

    expect(response.statusCode).toBe(200);
  });

  test("route-specific security should replace root security", async () => {
    const fastify = Fastify(fastifyOpts);
    await fastify.register(oas3Plugin, {
      ...pluginOpts,
      autowiredSecurity: {
        ...autowiredOpts,
        rootSecurity: { MyApiKey: [] },
        securitySchemes: {
          MyApiKey: {
            type: "apiKey",
            in: "header",
            name: "X-Test-Key",
            fn: (key, request) => {
              return key === "test"
                ? { ok: true }
                : { ok: false, reason: "UNAUTHORIZED" };
            },
          },
          MySecondKey: {
            type: "apiKey",
            in: "header",
            name: "X-Test-Second-Key",
            fn: (key, request) => {
              return key === "test2"
                ? { ok: true }
                : { ok: false, reason: "UNAUTHORIZED" };
            },
          },
        },
      },
    });

    fastify.get(
      "/boop",
      {
        schema: {
          response: {
            200: Type.Object({}),
          },
        },
        oas: {
          security: {
            MySecondKey: [],
          },
        },
      },
      async (request, reply) => {
        return "hello";
      }
    );

    await fastify.ready();

    const response = await fastify.inject({
      method: "GET",
      path: "/boop",
      headers: {
        "X-Test-Second-Key": "test2",
      },
    });

    expect(response.statusCode).toBe(200);

    const response2 = await fastify.inject({
      method: "GET",
      path: "/boop",
      headers: {
        "X-Test-Key": "test",
      },
    });

    expect(response2.statusCode).toBe(401);

    const response3 = await fastify.inject({
      method: "GET",
      path: "/boop",
      headers: {},
    });

    expect(response3.statusCode).toBe(401);
  });
});
