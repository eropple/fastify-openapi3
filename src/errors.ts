export class OAS3PluginError extends Error {

}

export class OAS3PluginOptionsError extends OAS3PluginError {
  constructor(msg: string) {
    super(`Problem with OAS3 plugin config: ${msg}`)
  }
}
