import { OpenAPIObject } from "openapi3-ts";

export function rapidocSkeleton(document: OpenAPIObject): string {
  // this is a _little_ bonkers because we have to avoid accidental backticks.
  // it's OK though.
  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
</head>
<body>
  <rapi-doc
    id="RAPIDOC"
    regular-font="Roboto, Calibri, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    mono-font="'Roboto Mono', Consolas,  Monaco, monospace"
  > </rapi-doc>
  <script>
    document.addEventListener('DOMContentLoaded', (event) => {
      window.docEl = document.getElementById("RAPIDOC");
      window.specText = \`${JSON.stringify(document).replace(
        "`",
        "_!@#$"
      )}\`.replace("_!@#$", "\`");
      window.spec = JSON.parse(window.specText);
      window.docEl.loadSpec(spec);
    });
  </script>
</body>
</html>`;
}
