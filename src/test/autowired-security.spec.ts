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
});
