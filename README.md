# pkg-lib

Library bundler

Inspired by [tsdx](https://tsdx.io/), [aqu](https://github.com/ArtiomTr/aqu).

## Features

- Supports Typescript, Javascript, React, etc
- Builds a version for apps in dev mode, and another one with apps in prod mode.
- Builds an ESModules version for better tree-shaking
- Supports the new JSX transform (and correctly switches between `react-jsx` and `react-jsxdev`)
- Optimises `invariant` and `warning` function calls
- Generates documentation based on tsdoc

## Getting Started

1. Install it with your favourite package manager:

   ```shell
   pnpm add -D @alduino/pkg-lib
   ```

2. Specify what your package’s entrypoints are if you haven’t already, in your package.json:

   ```json5
   {
       "main": "dist/index.js",
       "module": "dist/index.mjs",
       "typings": "dist/index.d.ts"
   }
   ```

3. Run `pkg-lib build`

## Usage

pkg-lib reads its config from a `.pkglibrc` JSON file. Here’s the big list of every configuration option.

- `entrypoint`: The file to enter from. Defaults a `src/index` that is a `js`, `ts`, `cjs`, `mjs`, `ejs`, or `esm` file.
- `typings`: Output for Typescript typings. Defaults to `dist/index.d.ts`.
- `cjsOut`: The output file for library consumer entry. Defaults to `dist/index.js`.
- `cjsDevOut`: The output file for a development build. Defaults to `dist/[package].development.js`.
- `cjsProdOut`: The output file for a production build. Defaults to `dist/[package].production.min.js`.
- `esmOut`: The output file for an ESModule build. Defaults to `dist/index.mjs`.
- `platform`: The target platform, one of `neutral`, `browser` or `node`. Defaults to `neutral`.
- `target`: The JS syntax and std libs to target (e.g. `node12`, `es2019`). Defaults to `es6`.
- `dev`: Enable `__DEV__` and `process.env.NODE_ENV`. Defaults to `true`.
- `invariant`: Disables invariant replacing when false, or changes the function name. Use an array of identifiers for
  multiple invariant functions. Defaults to `invariant`.
- `warning`: Disables warning replacing when false, or changes the function name. Use an array of identifiers for
  multiple warning functions. Defaults to `warning`.
- `docsDir`: Output directory for documentation files. They will be put in `{docsDir}/{unscopedPackageName}.md`. Disabled by default.

You can also set some of these in your `package.json`:

- `source` sets `entrypoint`
- `typings` sets itself
- `main` sets `cjsOut`
- `module` sets `esmOut`
- `docs` sets `docsDir`

Run `pkg-lib build` to run the build. You can set a script for this in your `package.json`:

```json
{
  "scripts": {
    "build": "pkg-lib build"
  }
}
```

## Documentation generation

pkg-lib can generate documentation for you if you are using Typescript, based on your tsdoc comments. By default it generates a simple markdown file listing each export and their properties, arguments, return types, and the summary and remarks you give them.

Documentation generation is disabled by default, to enable it set `docs` in your `package.json` or `docsDir` in the config to an output directory where the documentation will be generated. If you use the built-in documentation generator, a file will be created in this directory named after your library’s name, without a scope.

### Custom generation

You can override the built-in documentation generator with a custom one by creating a file in your project directory called `pkglib.documenter.js` (it can also be a `.mjs` or `.ts` file). This file is bundled into a temporary file before it is run using the same settings as the normal bundling (as a development build), so you can use features like `invariant`, although Typescript types will not be checked.

The custom documentation generation API is very simple, and has only two concepts: hooks and context. To use these, import their functions from `@alduino/pkg-lib/docgen`. This file has Typescript typings too.

#### Context

Each hook is called as a new child process of `pkg-lib`, so you can’t save values to be used across hooks like you normally would (as a general rule of thumb, don’t use **any** global variables inside this file).

Instead, use the `getContext()` and `setContext()` functions. If you call `setContext(someValue)`, the next time you call `getContext()` (even in another hook) that value will be returned. You can use this to store any serialisable data (functions and symbols are not supported), e.g. to make a table of contents.

##### Notes:

- The default value returned from `getContext()` when you haven’t called `setContext()` yet is `null`.
- Setting the context to `undefined` will actually set it to `null`.

- Don’t edit the object passed into `setContext` or returned from `getContext` without calling `setContext` with it again. Due to the implementation of these functions, these edits will change the value in the current hook, but it will not persist to others.

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

For an example implementation, see [here](https://github.com/microsoft/rushstack/blob/master/apps/api-documenter/src/documenters/MarkdownDocumenter.ts) and [here](https://github.com/Alduino/pkg-lib/blob/master/src/utils/generateMarkdownDocs.ts).

It is passed some values as an object in the first parameter:

- `fileName: string`: The name that the file you create should be called, without an extension
- `outputDirectory: string`: The directory that the file should be put in
- `source: ApiPackage`: Information about each export. See [@microsoft/api-extractor-model](https://www.npmjs.com/package/@microsoft/api-extractor-model).

##### `start`

This hook is called before all other hooks. It is not passed any information.

##### `end`

This hook is called after all other hooks. It is not passed any information.

If you are going to generate a separate table of contents file, this is the place to do it - you can save information about each file in their `doc` hooks, then read it here and create the file.

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
  expression. If you want to disable this (which is not recommended), set  `recommendedExprCheck` in the config
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
5 + 5 > 10 || t(!1)
```

#### ESM build

```js
5 + 5 > 10 || (process.env.NODE_ENV !== "production" ? invariant(false, "Maths has stopped existing!") : invariant(false));
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
  expression. If you want to disable this (which is not recommended), set  `recommendedExprCheck` in the config
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
5 + 5 > 10 && process.env.NODE_ENV !== "production" || warning(false, "The universe is about to collapse");
```

</details>

#### Warning packages

pkg-lib doesn’t supply a `warning` function, you need to create or import one yourself. Make sure it has the
signature `warning(check: boolean, message: string): void`.

We recommend [`tiny-warning`](https:///npmjs.com/package/tiny-warning).
