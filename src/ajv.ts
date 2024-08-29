import Ajv from 'ajv';

export function oas3PluginAjv(ajv: Ajv) {
  ajv.addKeyword({
    keyword: "x-fastify-schemaName",
  });

  return ajv;
}
