import { OpenAPIObject, OperationObject, SchemaObject } from 'openapi3-ts';
import { Static, Type } from '@sinclair/typebox';
import { inspect } from 'util';

import { canonicalizeAnnotatedSchemas } from '../src/spec-transforms/index.js';
import { findTaggedSchemas } from '../src/spec-transforms/find.js';
import { canonicalizeSchemas } from '../src/spec-transforms/canonicalize';
import { schemaType } from '../src/schemas.js';
import { APPLICATION_JSON, SCHEMA_NAME_PROPERTY } from '../src/constants.js';

const typeA = schemaType('MyTypeA', Type.Object({}));
const typeB = schemaType('MyTypeB',
  Type.Object({
    foo: Type.Boolean(),
  }));
const typeC = schemaType('MyTypeC',
  Type.Object({
    a: typeA,
    b: typeB,
  }));

const typeWithArray = schemaType('TypeWithArray', Type.Object({
  arr: Type.Array(typeA),
}));


const baseOas: OpenAPIObject = {
  openapi: '3.1.0',
  info: {
    title: 'a test',
    version: '0.0.1',
  },
  paths: {},
  components: {},
}

describe('tagged schema finder', () => {
  test('finds tagged schema in oas.components', () => {
    const oas: OpenAPIObject = {
      ...baseOas,
      components: {
        schemas: {
          MyTypeA: typeA,
          MyTypeB: typeB,
        }
      }
    };

    expect(findTaggedSchemas(oas)).toHaveLength(2);
  });

  test('finds tagged schema in request body', () => {
    const oas: OpenAPIObject = {
      ...baseOas,
      paths: {
        '/': {
          post: {
            requestBody: {
              content: {
                [APPLICATION_JSON]: {
                  schema: typeA,
                }
              }
            },
            responses: {},
          } as OperationObject,
        },
      },
      components: {
        requestBodies: {
          'abc': {
            content: {
              [APPLICATION_JSON]: {
                schema: typeB,
              },
            },
          },
        },
      },
    };

    expect(findTaggedSchemas(oas)).toHaveLength(2);
  });

  test('finds tagged schema in responses', () => {
    const oas: OpenAPIObject = {
      ...baseOas,
      paths: {
        '/': {
          post: {
            responses: {
              default: {
                description: 'doot',
                content: {
                  [APPLICATION_JSON]: {
                    schema: typeA,
                  }
                }
              },
            },
          } as OperationObject
        },
      },
      components: {
        responses: {
          'a-response': {
            description: 'DOOT!',
            content: {
              [APPLICATION_JSON]: {
                schema: typeB,
              }
            },
          },
        },
      },
    };

    expect(findTaggedSchemas(oas)).toHaveLength(2);
  });

  test('find tagged schema in parameters', () => {
    const oas: OpenAPIObject = {
      ...baseOas,
      paths: {
        '/': {
          get: {
            parameters: [
              {
                name: 'foo',
                in: 'query',
                schema: typeA,
              }
            ],
            responses: {},
          } as OperationObject,
          parameters: [
            {
              name: 'bar',
              in: 'query',
              schema: typeB,
            }
          ],
        },
      },
    };

    expect(findTaggedSchemas(oas)).toHaveLength(2);
  })

  test('finds nested tagged schema', () => {
    const oas: OpenAPIObject = {
      ...baseOas,
      components: {
        schemas: {
          'MyTypeC': typeC,
        }
      }
    };

    const schemaKeys = [
      ...new Set([...findTaggedSchemas(oas).map(s => s[SCHEMA_NAME_PROPERTY])]),
    ];
    expect(schemaKeys).toHaveLength(3);
  });

  test('finds tagged schema in arrays', () => {
    const oas: OpenAPIObject = {
      ...baseOas,
      components: {
        schemas: {
          'TypeWithArray': typeWithArray,
        }
      }
    };

    const schemaKeys = [
      ...new Set([...findTaggedSchemas(oas).map(s => s[SCHEMA_NAME_PROPERTY])]),
    ];
    expect(schemaKeys).toHaveLength(2);
  });

  // TODO: test for callback
  // I'm confident it works (as it duplicates request body syntax), but we should have
  // a test for completeness.
});


describe('schema canonicalization', () => {
  test('canonicalizes even in nested schema', () => {
    const oas: OpenAPIObject = {
      ...baseOas,
      components: {
        schemas: {
          'MyTypeC': typeC,
        }
      }
    };

    const schemas = findTaggedSchemas(oas);
    const canonicalized = canonicalizeSchemas(schemas);
    expect(Object.values(canonicalized)).toHaveLength(3);
  });

  // I don't feel a need for more tests here right now. This is the hard case.
});

describe('schema fixup', () => {
  test('properly canonicalizes schema with multiple uses', () => {
    const oas: OpenAPIObject = {
      ...baseOas,
      paths: {
        '/': {
          get: {
            parameters: [
              {
                name: 'foo',
                in: 'query',
                schema: typeA,
              }
            ],
            responses: {},
          } as OperationObject,
          parameters: [
            {
              name: 'bar',
              in: 'query',
              schema: typeB,
            }
          ],
        },
      },
      components: {
        schemas: {
          'MyTypeC': typeC,
        }
      }
    };

    canonicalizeAnnotatedSchemas(oas);

    expect(Object.keys(oas?.components?.schemas ?? {})).toHaveLength(3);

    const aParam = oas.paths['/'].get.parameters[0];
    const bParam = oas.paths['/'].parameters[0];
    expect(aParam)
      .toMatchObject({ name: 'foo', schema: { $ref: '#/components/schemas/MyTypeA' } });
    expect(bParam)
      .toMatchObject({ name: 'bar', schema: { $ref: '#/components/schemas/MyTypeB' } });
    expect(
      (oas?.components?.schemas?.['MyTypeC'] as SchemaObject)
        ?.properties?.['a']
    )
      .toEqual({ $ref: '#/components/schemas/MyTypeA' });
    expect(
      (oas?.components?.schemas?.['MyTypeC'] as SchemaObject)
        ?.properties?.['b']
    )
      .toEqual({ $ref: '#/components/schemas/MyTypeB' });
  });
});
