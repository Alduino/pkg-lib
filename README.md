# pkg-lib

Library bundler

Inspired by [tsdx](https://tsdx.io/), [aqu](https://github.com/ArtiomTr/aqu).

## Features

- Supports [multiple entrypoints](#multiple-entrypoints)
- Supports Typescript, Javascript, React, etc
- Builds a version for apps in dev mode, and another one with apps in prod mode.
- Builds an ESModules version for better tree-shaking
- Supports the new JSX transform (and correctly switches between `react-jsx` and `react-jsxdev`)

## Getting Started

1. Install it with your favourite package manager:

    ```shell
    pnpm add -D @alduino/pkg-lib
    ```

2. Specify what your package’s entrypoints are if you haven’t already, in your package.json:

    ```json5
    {
        main: "dist/index.js",
        module: "dist/index.mjs",
        typings: "dist/index.d.ts"
    }
    ```

3. Add `/.js` and `/.mjs` to your gitignore, to ignore bundled entrypoints

4. Run `pkg-lib build`

If you are using Typescript, there is some additional steps before you can run the build command:

4. Add `/.d.ts` to your gitignore
5. Set `compilerOptions.isolatedModules` to `true` in your tsconfig.json

6. Add `**/node_modules` and `**/.*/` to the `exclude` option in your tsconfig.json
7. Double check that the `include` option includes all entrypoints and source code (you will get weird errors if it
   doesn’t)
8. Run `pkg-lib build`

## CLI

### `pkg-lib build`

- `-c, --config`: The path to the configuration file. Defaults to `.pkglibrc`.
- `--no-dev`: Disables `__DEV__` replacement
- `--no-invariant`: Disables `invariant` optimisation
- `--no-warning`: Disables `warning` optimisation
- `--entrypoints`: Glob file paths, or explicitly named entrypoint, separated by `,` (no whitespace). For explicit
  entrypoint names, use `[name]=[path]`.

Other than this, you can use all the configuration values in the CLI too. This will override all other configuration.
See `pkg-lib build --help` for more info.

### `pkg-lib watch`

Watches the source files for changes, and recompiles the minimum needed to get the output up-to-date.

Takes the same parameters as `build`.

#### Typescript warning

If you are using Typescript, you will notice the Typescript features build stage can be very slow. pkg-lib attempts to
work around this by using incremental builds, which reduces subsequent .d.ts builds from 5s to 1s in the example
project. API Extractor should also have a speedup from this, but from tests with the example project it seems to not
make much difference.

Basically, this is because `tsc`, the compiler that pkg-lib uses to build your .d.ts files, is really slow. We’re
watching a project, [stc](https://stc.dudy.dev/docs/status) - an attempt to rewrite tsc in Rust, which will hopefully
speed it up a lot.

If you have any ideas how to make `tsc` any faster, please tell me
in [this issue](https://github.com/Alduino/pkg-lib/issues/12).

For now, the actual code is emitted before tsc runs so you should still be able to work quickly.

## Configuration

pkg-lib reads its config from a `.pkglibrc` JSON file. Here’s the big list of every configuration option.

- `entrypoint`: The package’s root, will be compiled as an entrypoint named by `mainEntryOut`. Set to `false` to disable 
  automatic detection. Defaults a `src/index` that is a `js`, `ts`, `cjs`, `mjs`, `ejs`, or `esm` file.
- `entrypoints`: A list of named entrypoints. See [here](#custom-entrypoints) for the format of the value. Defaults to
  any files with the above extensions in `./entry` or the root project directory.
- `typings`: Output for Typescript typings. Defaults to `[entrypoint].d.ts`.
- `mainEntry`: The output file of the main entrypoint, with no extension. Files will be generated as defined in the
  various entrypoint output options. Defaults to `index`.
- `cjsOut`: The output file for library consumer entry. Defaults to `[entrypoint].js`.
- `cjsDevOut`: The output file for a development build. Defaults to `dist/[entrypoint].dev.js`.
- `cjsProdOut`: The output file for a production build. Defaults to `dist/[entrypoint].prod.min.js`.
- `esmOut`: The output file for an ESModule build. Defaults to `[entrypoint].mjs`.
- `platform`: The target platform, one of `neutral`, `browser` or `node`. Defaults to `neutral`.
- `target`: The JS syntax and std libs to target (e.g. `node12`, `es2019`). Defaults to `es6`.
- `dev`: Enable `__DEV__` and `process.env.NODE_ENV`. Defaults to `true`.
- `invariant`: Disables invariant replacing when false, or changes the function name. Use an array of identifiers for
  multiple invariant functions. Defaults to `invariant`.
- `warning`: Disables warning replacing when false, or changes the function name. Use an array of identifiers for
  multiple warning functions. Defaults to `warning`.
- `docsDir`: Output directory for documentation files. They will be put in `[docsDir]/[unscopedPackageName].md`.
  Disabled by default.

You can also set some of these in your `package.json`:

- `source` sets `entrypoint
- `main` sets `mainEntry` to be a matching entrypoint name for `cjsOut`
- `module` sets `mainEntry` if `main` hasn’t already, to be a matching entrypoint name for `esmOut`
- `typings` sets `mainEntry` if neither `main` nor `module` have already, to be a matching entrypoint name for `typings`
- `docs` sets `docsDir`

Run `pkg-lib build` to run the build. You can set a script for this in your `package.json`:

```json
{
  "scripts": {
    "build": "pkg-lib build"
  }
}
```

## Multiple entrypoints

pkg-lib has support for multiple entrypoints. Note that this is separate from the `exports` field in the `package.json`,
as that field is only supported by ESModules (which Typescript does not support at the moment).

If you don’t specify any custom entrypoints, pkg-lib will automatically add multiple entrypoints for any `js`, `ts`
, `cjs`, `mjs`, `ejs`, or `esm` in the `entry` directory, and any files with those extensions that can’t match one of
the build result paths in the root. In fact, no matter what glob or paths you specify, pkg-lib will refuse to resolve
them as entrypoints if they could match a build result, as otherwise the file would get overwritten when you build your
code. Please note that this check may not be perfect, so you shouldn’t rely on it (
see [the known issues](#overwrite-protection-issues)).

This means, by default, `.js` and `.mjs` files in the root directory would not be recognised as entrypoints, as they
would match the default `cjsOut` setting of `[entrypoint].js` and `esmOut` setting of `[entrypoint].mjs`. You can either
put these in the `entry` directory, or change the `cjsOut` and/or `esmOut` options to not match them (e.g. change
`cjsOut` to use the `.cjs` extension).

Here’s an example directory structure:

```
(project root)
├── src
│   └── index.ts
├── utils.ts
├── server.ts
└── package.json
```

The entrypoints would be `src/index.ts` (the package root), `utils.ts`, and `server.ts`. These would build to individual
bundles, so then you could import them as follows:

```ts
import pkg from "package"; // imports /src/index.ts
import utils from "package/utils"; // imports /utils.ts
import server from "package/server"; // imports /server.ts
```

### Custom entrypoints

You can customise the entrypoints or where they are searched for, by using the `entrypoints` key in the config. This can
have a few types of values:

- a glob string, matching any file to be used as an entrypoint, e.g. `"./entrypoints/*.ts"`. The file’s name (without
  the extension) will be used as the name of the entrypoint.
- an array of file paths, globs (see above), and/or entrypoint objects (see below). For any files in this list, the
  file’s name (without the extension) will be used as the name of the entrypoint.
- an object, where each key is the name of an entrypoint, and the value is the path to the entrypoint source file.

(see [fast-glob's documentation](https://www.npmjs.com/package/fast-glob#pattern-syntax) for more info on glob syntax)

For example, with a config of `["./entrypoints/*.ts", "./server.ts", {utils: "./utils/index.ts"}]`, the entrypoints
could be:

```
test => ./entrypoints/test.ts
foo => ./entrypoints/foo.ts
server => ./server.ts
utils => ./utils/index.ts
```

> Two entrypoints must not have the same name. If they do, an error will be thrown.

### Overwrite protection issues

- The check does not include subdirectories (as this would prevent _any_ `.js` files from being an entrypoint, by
  default). This means that, if an entrypoint name is explicitly specified to have a subdirectory (i.e. the name has a
  slash, e.g. `foo/bar`) and that directory points to the same location as the source file, that file might get
  overwritten. No entrypoint names can have subdirectories without explicitly specifying them (as the file’s basename is
  used, which doesn’t include its directory), so normally this should be a nonissue.

### Typescript limitations

At the moment we use [API Extractor](https://api-extractor.com/) to bundle typings into a single `.d.ts` file for each
entrypoint. API Extractor currently doesn’t support multiple entrypoints, so we have to run it multiple times - once for
each entrypoint.

Because each `.d.ts` file has completely separate typings (even for types that should be shared), if you have any
user-accessible classes with private properties, Typescript will not let the user use instances across multiple
endpoints. For now, make sure none of your exported classes have private fields, or create a wrapper type for them that
doesn’t. See

The Typescript stage of the builds may also get significantly slower, as it has to run the whole Typescript compiler for
every entrypoint.

See [these](https://github.com/microsoft/rushstack/issues/1596) [issues](https://github.com/microsoft/rushstack/issues/664)
for more information.

## Documentation generation

pkg-lib can generate documentation for you if you are using Typescript, based on your tsdoc comments. By default it
generates a simple markdown file listing each export and their properties, arguments, return types, and the summary and
remarks you give them.

Documentation generation is disabled by default, to enable it set `docs` in your `package.json` or `docsDir` in the
config to an output directory where the documentation will be generated. If you use the built-in documentation
generator, a file will be created in this directory named after your library’s name, without a scope.

### Custom generation

You can override the built-in documentation generator with a custom one by creating a file in your project directory
called `pkglib.documenter.js` (it can also be a `.mjs` or `.ts` file). This file is bundled into a temporary file before
it is run using the same settings as the normal bundling (as a development build), so you can use features
like `invariant`, although Typescript types will not be checked.

The custom documentation generation API is very simple, and has only two concepts: hooks and context. To use these,
import their functions from `@alduino/pkg-lib/docgen`. This file has Typescript typings too.

#### Context

Each hook is called as a new child process of `pkg-lib`, so you can’t save values to be used across hooks like you
normally would (as a general rule of thumb, don’t use **any** global variables inside this file).

Instead, use the `getContext()` and `setContext()` functions. If you call `setContext(someValue)`, the next time you
call `getContext()` (even in another hook) that value will be returned. You can use this to store any serialisable
data (functions and symbols are not supported), e.g. to make a table of contents.

##### Notes:

- The default value returned from `getContext()` when you haven’t called `setContext()` yet is `null`.
- Setting the context to `undefined` will actually set it to `null`.

- Don’t edit the object passed into `setContext` or returned from `getContext` without calling `setContext` with it
  again. Due to the implementation of these functions, these edits will change the value in the current hook, but it
  will not persist to others.

#### Hooks

To run your code on a hook, use the `hook(name, callback)` function:

```js
const {hook} = require("@alduino/pkg-lib/docgen");
hook("name", arg => {
    console.log("Called on the `name` hook with some data:", arg);
});
```

There is currently three hooks supplied:

##### `doc`

This hook is called for each documentation file (currently only once). You need to write the output file yourself.

For an example implementation,
see [here](https://github.com/microsoft/rushstack/blob/master/apps/api-documenter/src/documenters/MarkdownDocumenter.ts)
and [here](https://github.com/Alduino/pkg-lib/blob/master/src/utils/generateMarkdownDocs.ts).

It is passed some values as an object in the first parameter:

- `fileName: string`: The name that the file you create should be called, without an extension
- `outputDirectory: string`: The directory that the file should be put in
- `source: ApiPackage`: Information about each export.
  See [@microsoft/api-extractor-model](https://www.npmjs.com/package/@microsoft/api-extractor-model).

##### `start`

This hook is called before all other hooks. It is not passed any information.

##### `end`

This hook is called after all other hooks. It is not passed any information.

If you are going to generate a separate table of contents file, this is the place to do it - you can save information
about each file in their `doc` hooks, then read it here and create the file.

## Optimisations

### `invariant`

In your code, you can call `invariant` to make an assertion about some state:

```ts
invariant(5 + 5 > 10, "Maths has stopped working");
```

pkg-lib converts calls to `invariant` to not have a message in the production output, to reduce code size. Think of it
like this:

```ts
if (process.env.NODE_ENV === "production") {
    invariant(5 + 5 > 10);
} else {
    invariant(5 + 5 > 10, "Maths has stopped working");
}
```

There are some significant differences however, that could change how your code works:

- The check is done before calling `invariant`, so that it’s only called if it needs to be. This looks more
  like `if (!(5 + 5 > 10)) invariant(false)`.
- The result of the check will be returned as the result of the expression. With `foo = invariant("test")`, foo will be
  set to `"test"` if it is truthy. To combat this, pkg-lib will prevent you from calling `invariant` as a part of an
  expression. If you want to disable this (which is not recommended), set `recommendedExprCheck` in the config
  to `false`.

If you do not want to use `invariant`, disable it by setting `invariant` in the config to `false`.

You can change what names pkg-lib uses for `invariant` functions by setting the `invariant` config value to the name of
the function you want to use. If there are multiple, you can set it to an array too.

<details>
<summary>Build output</summary>

#### Development build

```js
5 + 5 > 10 || invariant(false, "Maths has stopped existing!");
```

#### Production build

```js
5 + 5 > 10 || t(!1);
```

#### ESM build

```js
5 + 5 > 10 ||
(process.env.NODE_ENV !== "production"
    ? invariant(false, "Maths has stopped existing!")
    : invariant(false));
```

</details>

#### Invariant packages

pkg-lib doesn’t supply an `invariant` function, you need to create or import one yourself. Make sure it has the
signature `invariant(check: boolean, message?: string): void`.

We recommend [`tiny-invariant`](https:///npmjs.com/package/tiny-invariant).

### `warning`

In your code, you can call `warning` to log a warning message to the console if a check fails:

```ts
warning(5 + 5 > 10, "The universe is about to collapse");
```

pkg-lib removes calls to `warning` in production builds:

```js
if (process.env.NODE_ENV !== "production") {
    warning(5 + 5 > 10, "The universe is about to collapse");
}
```

There are some significant differences however, that could change how your code works:

- The check is done before calling `warning`, so that it’s only called if it needs to be. This looks more
  like `if (!(5 + 5 > 10)) warning(false, "The universe is about to collapse")`.
- The result of the check will be returned as the result of the expression. With `foo = warning("test")`, foo will be
  set to `"test"` if it is truthy. To combat this, pkg-lib will prevent you from calling `warning` as a part of an
  expression. If you want to disable this (which is not recommended), set `recommendedExprCheck` in the config
  to `false`.

If you do not want to use `warning`, disable it by setting `warning` in the config to `false`.

You can change what names pkg-lib uses for `warning` functions by setting the `warning` config value to the name of the
function you want to use. If there are multiple, you can set it to an array too.

<details>
<summary>Build output</summary>

#### Development build

```js
5 + 5 > 10 || warning(false, "The universe is about to collapse");
```

#### Production build

No code is generated for production builds.

#### ESM build

```js
(5 + 5 > 10 && process.env.NODE_ENV !== "production") || warning(false, "The universe is about to collapse");
```

</details>

#### Warning packages

pkg-lib doesn’t supply a `warning` function, you need to create or import one yourself. Make sure it has the
signature `warning(check: boolean, message: string): void`.

We recommend [`tiny-warning`](https:///npmjs.com/package/tiny-warning).
