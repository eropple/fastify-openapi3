# TODOs #
There are a lot of smaller TODOs throughout the codebase. Here's a brief list of
larger considerations that, due to a lack of need, haven't yet been handled.
Feel free to jump in.

## Integration with Fastify v4 Type Providers ##
**Expected difficulty:** moderate

Fastify v4 is on the way and includes type providers that make it easier to, in
a generic fashion, specify validators for request bodies, responses, etc. that
also act as inferrable generics. I have not yet looked at v4, but we do internally
use `@sinclair/typebox` for everything and so I don't foresee this being a huge
lift--just somewhat tedious to get right.

## Top-Level `Servers` Block ##
**Expected difficulty:** low

Right now, if you generate an OAS client from a spec generated from this client,
you need to pass the base URL. Which is silly. However, there's some weird
interplay between the prefix assigned to this plugin, the routes declared in the
same scope, and the base URL of the server. Just needs somebody to think about
it.

## Links Objects ##
**Expected difficulty:** low

I don't use [link objects](https://spec.openapis.org/oas/v3.1.0#link-object). If
you do, I'm definitely interested in discussing both how we can implement it and
how we can make writing them pleasant.

## Example Objects ##
**Expected difficulty:** moderate

Some example objects are free with the way that schemas work, but responses, etc.
need some thought.

## Header Response Schema ##
**Expected difficulty:** development low, design moderate/hard

Right now, `@eropple/fastify-openapi3` is unaware of headers in responses
because I haven't needed them (and also they don't really plug into the way
Fastify does things too well). Suggestions welcome!

## Alternate Content Types ##
**Expected difficulty:** moderate

`@eropple/fastify-openapi3` expects that every request body and every response
is `application/json`. There are two bits to this:

- Some APIs, for good reasons, use `vnd` extensions to media types to indicate
  API versions.
- Some folks want to send things that are not JSON.

The former is just changing the schema alias in the plugin (it's a constant, so
it's not a snap-your-fingers fix) but the latter requires additional thinking.
And OpenAPI isn't great at that anyway. So some insight from an invested party
would be awesome.

In the interim, you _can_ bail out by using `oas.custom` and do whatever you
want to do, but that's a little awkward.

# Things We Won't Support #
- server blocks at path/operation level
- using `$id` for schema identification
- any particular ergonomics for folks not using TypeScript. Use TypeScript.
