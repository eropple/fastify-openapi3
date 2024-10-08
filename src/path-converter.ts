type ConversionResult = {
  url: string;
  paramPatterns: Record<string, string>;
};

export function convertFastifyToOpenAPIPath(
  fastifyPath: string
): ConversionResult {
  let url = fastifyPath;
  const paramPatterns: Record<string, string> = {};

  // Replace :paramName(regex) patterns with OpenAPI style parameters
  url = url.replace(/:(\w+)(\([^)]+\))?/g, (match, paramName, regex) => {
    if (regex) {
      // Remove the parentheses from the regex
      paramPatterns[paramName] = regex.slice(1, -1);
    }
    return `{${paramName}}`;
  });

  return { url, paramPatterns };
}
