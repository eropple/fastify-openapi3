import { fastifyCookie } from "@fastify/cookie";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import { Type } from "typebox";
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

      const jsonDoc = JSON.parse(
        (
          await fastify.inject({
            method: "GET",
            path: "/openapi.json",
          })
        ).body
      );

      expect(jsonDoc.paths["/boop"].get.security).toMatchObject([
        { ANonsenseItem: [] },
      ]);
    });

    test("includes security clauses even when autowired is off", async () => {
      const fastify = Fastify(fastifyOpts);
      await fastify.register(oas3Plugin, {
        ...pluginOpts,
        autowiredSecurity: undefined,
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

      const jsonDoc = JSON.parse(
        (
          await fastify.inject({
            method: "GET",
            path: "/openapi.json",
          })
        ).body
      );

      expect(jsonDoc.paths["/boop"].get.security).toMatchObject([
        { ANonsenseItem: [] },
      ]);
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
                    : { ok: false, code: 401 };
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

        const jsonDoc = JSON.parse(
          (
            await fastify.inject({
              method: "GET",
              path: "/openapi.json",
            })
          ).body
        );

        expect(jsonDoc.components.securitySchemes).toMatchObject({
          MyApiKey: {
            type: "apiKey",
            in: "header",
            name: "X-My-Key",
          },
        });
        expect(jsonDoc.paths["/boop"].get.security).toMatchObject([
          { MyApiKey: [] },
        ]);

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
                    : { ok: false, code: 401 };
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

    describe("cookie-based security", () => {
      test("basic cookie handler works", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(fastifyCookie);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              MyCookie: {
                type: "apiKey",
                in: "cookie",
                name: "session",
                fn: (cookieValue, request) => {
                  return cookieValue === "valid-session"
                    ? { ok: true }
                    : { ok: false, code: 401 };
                },
              },
            },
          },
        });

        fastify.get(
          "/protected",
          {
            schema: {
              response: {
                200: Type.Object({}),
              },
            },
            oas: {
              security: {
                MyCookie: [],
              },
            },
          },
          async () => "hello"
        );

        await fastify.ready();

        // Test valid cookie
        const response = await fastify.inject({
          method: "GET",
          path: "/protected",
          cookies: {
            session: "valid-session",
          },
        });
        expect(response.statusCode).toBe(200);

        // Test invalid cookie
        const response2 = await fastify.inject({
          method: "GET",
          path: "/protected",
          cookies: {
            session: "invalid-session",
          },
        });
        expect(response2.statusCode).toBe(401);

        // Test missing cookie
        const response3 = await fastify.inject({
          method: "GET",
          path: "/protected",
        });
        expect(response3.statusCode).toBe(401);
      });

      test("cookie handler fails gracefully without cookie plugin", async () => {
        const fastify = Fastify(fastifyOpts);
        // Deliberately NOT registering cookie plugin
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              MyCookie: {
                type: "apiKey",
                in: "cookie",
                name: "session",
                fn: () => ({ ok: true }),
              },
            },
          },
        });

        fastify.get(
          "/protected",
          {
            oas: {
              security: {
                MyCookie: [],
              },
            },
          },
          async () => "hello"
        );

        await fastify.ready();

        const response = await fastify.inject({
          method: "GET",
          path: "/protected",
          cookies: {
            session: "any-value",
          },
        });
        expect(response.statusCode).toBe(401);
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
                  : { ok: false, code: 401 };
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
              return key === "test" ? { ok: true } : { ok: false, code: 401 };
            },
          },
          MySecondKey: {
            type: "apiKey",
            in: "header",
            name: "X-Test-Second-Key",
            fn: (key, request) => {
              return key === "test" ? { ok: true } : { ok: false, code: 401 };
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
              return key === "test" ? { ok: true } : { ok: false, code: 401 };
            },
          },
          MySecondKey: {
            type: "apiKey",
            in: "header",
            name: "X-Test-Second-Key",
            fn: (key, request) => {
              return key === "test2" ? { ok: true } : { ok: false, code: 401 };
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
              return key === "test" ? { ok: true } : { ok: false, code: 401 };
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
              return key === "test" ? { ok: true } : { ok: false, code: 401 };
            },
          },
          MySecondKey: {
            type: "apiKey",
            in: "header",
            name: "X-Test-Second-Key",
            fn: (key, request) => {
              return key === "test2" ? { ok: true } : { ok: false, code: 401 };
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

  describe("passNullIfNotFound variants", () => {
    describe("API Key (header)", () => {
      test("strict variant returns 401 when header missing", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              StrictApiKey: {
                type: "apiKey",
                in: "header",
                name: "X-Test-Key",
                passNullIfNoneProvided: false,
                fn: (value) =>
                  value === "test" ? { ok: true } : { ok: false, code: 401 },
              },
            },
          },
        });

        fastify.get(
          "/test",
          {
            schema: { response: { 200: Type.Object({}) } },
            oas: { security: { StrictApiKey: [] } },
          },
          async () => "ok"
        );

        await fastify.ready();

        const resNoHeader = await fastify.inject({
          method: "GET",
          path: "/test",
        });
        expect(resNoHeader.statusCode).toBe(401);

        const resValid = await fastify.inject({
          method: "GET",
          path: "/test",
          headers: { "X-Test-Key": "test" },
        });
        expect(resValid.statusCode).toBe(200);
      });

      test("nullable variant passes null to handler when header missing", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              NullableApiKey: {
                type: "apiKey",
                in: "header",
                name: "X-Test-Key",
                passNullIfNoneProvided: true,
                fn: (value) =>
                  value === null || value === "test"
                    ? { ok: true }
                    : { ok: false, code: 401 },
              },
            },
          },
        });

        fastify.get(
          "/test",
          {
            schema: { response: { 200: Type.Object({}) } },
            oas: { security: { NullableApiKey: [] } },
          },
          async () => "ok"
        );

        await fastify.ready();

        const resNoHeader = await fastify.inject({
          method: "GET",
          path: "/test",
        });
        expect(resNoHeader.statusCode).toBe(200);

        const resValid = await fastify.inject({
          method: "GET",
          path: "/test",
          headers: { "X-Test-Key": "test" },
        });
        expect(resValid.statusCode).toBe(200);

        const resInvalid = await fastify.inject({
          method: "GET",
          path: "/test",
          headers: { "X-Test-Key": "wrong" },
        });
        expect(resInvalid.statusCode).toBe(401);
      });
    });

    describe("API Key (cookie)", () => {
      test("strict variant returns 401 when cookie missing", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(fastifyCookie);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              StrictCookie: {
                type: "apiKey",
                in: "cookie",
                name: "session",
                passNullIfNoneProvided: false,
                fn: (value) =>
                  value === "test" ? { ok: true } : { ok: false, code: 401 },
              },
            },
          },
        });

        fastify.get(
          "/test",
          {
            schema: { response: { 200: Type.Object({}) } },
            oas: { security: { StrictCookie: [] } },
          },
          async () => "ok"
        );

        await fastify.ready();

        const resNoCookie = await fastify.inject({
          method: "GET",
          path: "/test",
        });
        expect(resNoCookie.statusCode).toBe(401);

        const resValid = await fastify.inject({
          method: "GET",
          path: "/test",
          cookies: { session: "test" },
        });
        expect(resValid.statusCode).toBe(200);
      });

      test("nullable variant passes null to handler when cookie missing", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(fastifyCookie);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              NullableCookie: {
                type: "apiKey",
                in: "cookie",
                name: "session",
                passNullIfNoneProvided: true,
                fn: (value) =>
                  value === null || value === "test"
                    ? { ok: true }
                    : { ok: false, code: 401 },
              },
            },
          },
        });

        fastify.get(
          "/test",
          {
            schema: { response: { 200: Type.Object({}) } },
            oas: { security: { NullableCookie: [] } },
          },
          async () => "ok"
        );

        await fastify.ready();

        const resNoCookie = await fastify.inject({
          method: "GET",
          path: "/test",
        });
        expect(resNoCookie.statusCode).toBe(200);

        const resValid = await fastify.inject({
          method: "GET",
          path: "/test",
          cookies: { session: "test" },
        });
        expect(resValid.statusCode).toBe(200);

        const resInvalid = await fastify.inject({
          method: "GET",
          path: "/test",
          cookies: { session: "wrong" },
        });
        expect(resInvalid.statusCode).toBe(401);
      });
    });

    describe("HTTP Basic Auth", () => {
      test("strict variant returns 401 when auth header missing", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              StrictBasic: {
                type: "http",
                scheme: "basic",
                passNullIfNoneProvided: false,
                fn: (creds) =>
                  creds.username === "user" && creds.password === "pass"
                    ? { ok: true }
                    : { ok: false, code: 401 },
              },
            },
          },
        });

        fastify.get(
          "/test",
          {
            schema: { response: { 200: Type.Object({}) } },
            oas: { security: { StrictBasic: [] } },
          },
          async () => "ok"
        );

        await fastify.ready();

        const resNoAuth = await fastify.inject({
          method: "GET",
          path: "/test",
        });
        expect(resNoAuth.statusCode).toBe(401);

        const resValid = await fastify.inject({
          method: "GET",
          path: "/test",
          headers: {
            Authorization:
              "Basic " + Buffer.from("user:pass").toString("base64"),
          },
        });
        expect(resValid.statusCode).toBe(200);
      });

      test("nullable variant passes null to handler when auth header missing", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              NullableBasic: {
                type: "http",
                scheme: "basic",
                passNullIfNoneProvided: true,
                fn: (creds) =>
                  creds === null ||
                  (creds.username === "user" && creds.password === "pass")
                    ? { ok: true }
                    : { ok: false, code: 401 },
              },
            },
          },
        });

        fastify.get(
          "/test",
          {
            schema: { response: { 200: Type.Object({}) } },
            oas: { security: { NullableBasic: [] } },
          },
          async () => "ok"
        );

        await fastify.ready();

        const resNoAuth = await fastify.inject({
          method: "GET",
          path: "/test",
        });
        expect(resNoAuth.statusCode).toBe(200);

        const resValid = await fastify.inject({
          method: "GET",
          path: "/test",
          headers: {
            Authorization:
              "Basic " + Buffer.from("user:pass").toString("base64"),
          },
        });
        expect(resValid.statusCode).toBe(200);

        const resInvalid = await fastify.inject({
          method: "GET",
          path: "/test",
          headers: {
            Authorization:
              "Basic " + Buffer.from("wrong:wrong").toString("base64"),
          },
        });
        expect(resInvalid.statusCode).toBe(401);
      });
    });

    describe("HTTP Bearer Auth", () => {
      test("strict variant returns 401 when auth header missing", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              StrictBearer: {
                type: "http",
                scheme: "bearer",
                passNullIfNoneProvided: false,
                fn: (token) =>
                  token === "valid-token"
                    ? { ok: true }
                    : { ok: false, code: 401 },
              },
            },
          },
        });

        fastify.get(
          "/test",
          {
            schema: { response: { 200: Type.Object({}) } },
            oas: { security: { StrictBearer: [] } },
          },
          async () => "ok"
        );

        await fastify.ready();

        const resNoAuth = await fastify.inject({
          method: "GET",
          path: "/test",
        });
        expect(resNoAuth.statusCode).toBe(401);

        const resValid = await fastify.inject({
          method: "GET",
          path: "/test",
          headers: { Authorization: "Bearer valid-token" },
        });
        expect(resValid.statusCode).toBe(200);
      });

      test("nullable variant passes null to handler when auth header missing", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              NullableBearer: {
                type: "http",
                scheme: "bearer",
                passNullIfNoneProvided: true,
                fn: (token) =>
                  token === null || token === "valid-token"
                    ? { ok: true }
                    : { ok: false, code: 401 },
              },
            },
          },
        });

        fastify.get(
          "/test",
          {
            schema: { response: { 200: Type.Object({}) } },
            oas: { security: { NullableBearer: [] } },
          },
          async () => "ok"
        );

        await fastify.ready();

        const resNoAuth = await fastify.inject({
          method: "GET",
          path: "/test",
        });
        expect(resNoAuth.statusCode).toBe(200);

        const resValid = await fastify.inject({
          method: "GET",
          path: "/test",
          headers: { Authorization: "Bearer valid-token" },
        });
        expect(resValid.statusCode).toBe(200);

        const resInvalid = await fastify.inject({
          method: "GET",
          path: "/test",
          headers: { Authorization: "Bearer wrong-token" },
        });
        expect(resInvalid.statusCode).toBe(401);
      });
    });
  });

  describe("requiresParsedBody", () => {
    describe("API Key with body access", () => {
      test("handler receives parsed body when requiresParsedBody is true", async () => {
        let receivedBody: unknown = undefined;

        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              BodyAwareKey: {
                type: "apiKey",
                in: "header",
                name: "X-Api-Key",
                requiresParsedBody: true,
                fn: (value, request, context) => {
                  receivedBody = context?.body;
                  return value === "test" ? { ok: true } : { ok: false, code: 401 };
                },
              },
            },
          },
        });

        fastify.post(
          "/test",
          {
            schema: {
              body: Type.Object({ secret: Type.String() }),
              response: { 200: Type.Object({}) },
            },
            oas: { security: { BodyAwareKey: [] } },
          },
          async () => "ok"
        );

        await fastify.ready();

        const response = await fastify.inject({
          method: "POST",
          path: "/test",
          headers: {
            "X-Api-Key": "test",
            "Content-Type": "application/json",
          },
          payload: { secret: "my-secret-value" },
        });

        expect(response.statusCode).toBe(200);
        expect(receivedBody).toEqual({ secret: "my-secret-value" });
      });

      test("handler receives undefined context when requiresParsedBody is false", async () => {
        let receivedContext: unknown = "not-called";

        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              NoBodyKey: {
                type: "apiKey",
                in: "header",
                name: "X-Api-Key",
                requiresParsedBody: false,
                fn: (value, request, context) => {
                  receivedContext = context;
                  return value === "test" ? { ok: true } : { ok: false, code: 401 };
                },
              },
            },
          },
        });

        fastify.post(
          "/test",
          {
            schema: {
              body: Type.Object({ data: Type.String() }),
              response: { 200: Type.Object({}) },
            },
            oas: { security: { NoBodyKey: [] } },
          },
          async () => "ok"
        );

        await fastify.ready();

        const response = await fastify.inject({
          method: "POST",
          path: "/test",
          headers: {
            "X-Api-Key": "test",
            "Content-Type": "application/json",
          },
          payload: { data: "some-data" },
        });

        expect(response.statusCode).toBe(200);
        expect(receivedContext).toBeUndefined();
      });

      test("can make auth decisions based on body content", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              BodyCheckKey: {
                type: "apiKey",
                in: "header",
                name: "X-Api-Key",
                requiresParsedBody: true,
                fn: (value, request, context) => {
                  const body = context?.body as { allowAccess?: boolean } | undefined;
                  if (value !== "test") return { ok: false, code: 401 };
                  if (!body?.allowAccess) return { ok: false, code: 403 };
                  return { ok: true };
                },
              },
            },
          },
        });

        fastify.post(
          "/test",
          {
            schema: {
              body: Type.Object({ allowAccess: Type.Boolean() }),
              response: { 200: Type.Object({}) },
            },
            oas: { security: { BodyCheckKey: [] } },
          },
          async () => "ok"
        );

        await fastify.ready();

        // Valid key but body says no access
        const resForbidden = await fastify.inject({
          method: "POST",
          path: "/test",
          headers: {
            "X-Api-Key": "test",
            "Content-Type": "application/json",
          },
          payload: { allowAccess: false },
        });
        expect(resForbidden.statusCode).toBe(403);

        // Valid key and body allows access
        const resAllowed = await fastify.inject({
          method: "POST",
          path: "/test",
          headers: {
            "X-Api-Key": "test",
            "Content-Type": "application/json",
          },
          payload: { allowAccess: true },
        });
        expect(resAllowed.statusCode).toBe(200);

        // Invalid key (body doesn't matter)
        const resUnauth = await fastify.inject({
          method: "POST",
          path: "/test",
          headers: {
            "X-Api-Key": "wrong",
            "Content-Type": "application/json",
          },
          payload: { allowAccess: true },
        });
        expect(resUnauth.statusCode).toBe(401);
      });
    });

    describe("HTTP Bearer with body access", () => {
      test("handler receives parsed body when requiresParsedBody is true", async () => {
        let receivedBody: unknown = undefined;

        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              BodyAwareBearer: {
                type: "http",
                scheme: "bearer",
                requiresParsedBody: true,
                fn: (token, request, context) => {
                  receivedBody = context?.body;
                  return token === "valid" ? { ok: true } : { ok: false, code: 401 };
                },
              },
            },
          },
        });

        fastify.post(
          "/test",
          {
            schema: {
              body: Type.Object({ message: Type.String() }),
              response: { 200: Type.Object({}) },
            },
            oas: { security: { BodyAwareBearer: [] } },
          },
          async () => "ok"
        );

        await fastify.ready();

        const response = await fastify.inject({
          method: "POST",
          path: "/test",
          headers: {
            Authorization: "Bearer valid",
            "Content-Type": "application/json",
          },
          payload: { message: "hello world" },
        });

        expect(response.statusCode).toBe(200);
        expect(receivedBody).toEqual({ message: "hello world" });
      });
    });

    describe("HTTP Basic with body access", () => {
      test("handler receives parsed body when requiresParsedBody is true", async () => {
        let receivedBody: unknown = undefined;

        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              BodyAwareBasic: {
                type: "http",
                scheme: "basic",
                requiresParsedBody: true,
                fn: (creds, request, context) => {
                  receivedBody = context?.body;
                  return creds.username === "user" && creds.password === "pass"
                    ? { ok: true }
                    : { ok: false, code: 401 };
                },
              },
            },
          },
        });

        fastify.post(
          "/test",
          {
            schema: {
              body: Type.Object({ value: Type.Number() }),
              response: { 200: Type.Object({}) },
            },
            oas: { security: { BodyAwareBasic: [] } },
          },
          async () => "ok"
        );

        await fastify.ready();

        const response = await fastify.inject({
          method: "POST",
          path: "/test",
          headers: {
            Authorization: "Basic " + Buffer.from("user:pass").toString("base64"),
            "Content-Type": "application/json",
          },
          payload: { value: 42 },
        });

        expect(response.statusCode).toBe(200);
        expect(receivedBody).toEqual({ value: 42 });
      });
    });

    describe("combined with passNullIfNoneProvided", () => {
      test("nullable API key handler receives both null value and body context", async () => {
        let receivedValue: string | null | undefined = undefined;
        let receivedBody: unknown = undefined;

        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              NullableBodyKey: {
                type: "apiKey",
                in: "header",
                name: "X-Api-Key",
                passNullIfNoneProvided: true,
                requiresParsedBody: true,
                fn: (value, request, context) => {
                  receivedValue = value;
                  receivedBody = context?.body;
                  // Allow if no key provided but body has special flag
                  const body = context?.body as { anonymous?: boolean } | undefined;
                  if (value === null && body?.anonymous) return { ok: true };
                  if (value === "test") return { ok: true };
                  return { ok: false, code: 401 };
                },
              },
            },
          },
        });

        fastify.post(
          "/test",
          {
            schema: {
              body: Type.Object({ anonymous: Type.Optional(Type.Boolean()) }),
              response: { 200: Type.Object({}) },
            },
            oas: { security: { NullableBodyKey: [] } },
          },
          async () => "ok"
        );

        await fastify.ready();

        // No key, but body says anonymous allowed
        const resAnon = await fastify.inject({
          method: "POST",
          path: "/test",
          headers: { "Content-Type": "application/json" },
          payload: { anonymous: true },
        });
        expect(resAnon.statusCode).toBe(200);
        expect(receivedValue).toBeNull();
        expect(receivedBody).toEqual({ anonymous: true });

        // No key, body doesn't allow anonymous
        const resNoAnon = await fastify.inject({
          method: "POST",
          path: "/test",
          headers: { "Content-Type": "application/json" },
          payload: { anonymous: false },
        });
        expect(resNoAnon.statusCode).toBe(401);
      });
    });

    describe("with AND/OR security logic", () => {
      test("OR logic: body-aware handler works alongside regular handler", async () => {
        let bodyHandlerCalled = false;
        let regularHandlerCalled = false;

        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              RegularKey: {
                type: "apiKey",
                in: "header",
                name: "X-Regular-Key",
                fn: (value) => {
                  regularHandlerCalled = true;
                  return value === "regular" ? { ok: true } : { ok: false, code: 401 };
                },
              },
              BodyKey: {
                type: "apiKey",
                in: "header",
                name: "X-Body-Key",
                requiresParsedBody: true,
                fn: (value, request, context) => {
                  bodyHandlerCalled = true;
                  const body = context?.body as { token?: string } | undefined;
                  return value === "body" && body?.token === "secret"
                    ? { ok: true }
                    : { ok: false, code: 401 };
                },
              },
            },
          },
        });

        fastify.post(
          "/test",
          {
            schema: {
              body: Type.Object({ token: Type.Optional(Type.String()) }),
              response: { 200: Type.Object({}) },
            },
            oas: {
              // OR logic: either RegularKey OR BodyKey
              security: [{ RegularKey: [] }, { BodyKey: [] }],
            },
          },
          async () => "ok"
        );

        await fastify.ready();

        // Regular key succeeds (short-circuits, body handler not called)
        bodyHandlerCalled = false;
        regularHandlerCalled = false;
        const resRegular = await fastify.inject({
          method: "POST",
          path: "/test",
          headers: {
            "X-Regular-Key": "regular",
            "Content-Type": "application/json",
          },
          payload: {},
        });
        expect(resRegular.statusCode).toBe(200);
        expect(regularHandlerCalled).toBe(true);
        expect(bodyHandlerCalled).toBe(false);

        // Body key succeeds
        bodyHandlerCalled = false;
        regularHandlerCalled = false;
        const resBody = await fastify.inject({
          method: "POST",
          path: "/test",
          headers: {
            "X-Body-Key": "body",
            "Content-Type": "application/json",
          },
          payload: { token: "secret" },
        });
        expect(resBody.statusCode).toBe(200);
        expect(bodyHandlerCalled).toBe(true);
      });

      test("AND logic: both regular and body-aware handlers must pass", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              RegularKey: {
                type: "apiKey",
                in: "header",
                name: "X-Regular-Key",
                fn: (value) => {
                  return value === "regular" ? { ok: true } : { ok: false, code: 401 };
                },
              },
              BodyKey: {
                type: "apiKey",
                in: "header",
                name: "X-Body-Key",
                requiresParsedBody: true,
                fn: (value, request, context) => {
                  const body = context?.body as { valid?: boolean } | undefined;
                  return value === "body" && body?.valid
                    ? { ok: true }
                    : { ok: false, code: 403 };
                },
              },
            },
          },
        });

        fastify.post(
          "/test",
          {
            schema: {
              body: Type.Object({ valid: Type.Boolean() }),
              response: { 200: Type.Object({}) },
            },
            oas: {
              // AND logic: both RegularKey AND BodyKey required
              security: { RegularKey: [], BodyKey: [] },
            },
          },
          async () => "ok"
        );

        await fastify.ready();

        // Both pass
        const resBothPass = await fastify.inject({
          method: "POST",
          path: "/test",
          headers: {
            "X-Regular-Key": "regular",
            "X-Body-Key": "body",
            "Content-Type": "application/json",
          },
          payload: { valid: true },
        });
        expect(resBothPass.statusCode).toBe(200);

        // Regular fails
        const resRegularFail = await fastify.inject({
          method: "POST",
          path: "/test",
          headers: {
            "X-Regular-Key": "wrong",
            "X-Body-Key": "body",
            "Content-Type": "application/json",
          },
          payload: { valid: true },
        });
        expect(resRegularFail.statusCode).toBe(401);

        // Body check fails (valid key but body says invalid)
        const resBodyFail = await fastify.inject({
          method: "POST",
          path: "/test",
          headers: {
            "X-Regular-Key": "regular",
            "X-Body-Key": "body",
            "Content-Type": "application/json",
          },
          payload: { valid: false },
        });
        expect(resBodyFail.statusCode).toBe(403);
      });
    });

    describe("requiresParsedBody not leaked to OAS document", () => {
      test("requiresParsedBody is stripped from security scheme in OpenAPI doc", async () => {
        const fastify = Fastify(fastifyOpts);
        await fastify.register(oas3Plugin, {
          ...pluginOpts,
          autowiredSecurity: {
            ...autowiredOpts,
            securitySchemes: {
              BodyKey: {
                type: "apiKey",
                in: "header",
                name: "X-Body-Key",
                requiresParsedBody: true,
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

        expect(jsonDoc.components.securitySchemes.BodyKey).toEqual({
          type: "apiKey",
          in: "header",
          name: "X-Body-Key",
        });
        expect(jsonDoc.components.securitySchemes.BodyKey.requiresParsedBody).toBeUndefined();
        expect(jsonDoc.components.securitySchemes.BodyKey.fn).toBeUndefined();
      });
    });
  });
});
