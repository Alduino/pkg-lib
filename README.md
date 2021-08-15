# pkg-lib

Library bundler

Inspired by [tsdx](https://tsdx.io/), [aqu](https://github.com/ArtiomTr/aqu).

## Features

- Supports Typescript, Javascript, React, etc
- Builds a version for apps in dev mode, and another one with apps in prod mode.
- Builds an ESModules version for better tree-shaking
- Supports the new JSX transform (and correctly switches between `react-jsx` and `react-jsxdev`)
- Optimises `invariant` and `warning` function calls

## Usage

pkg-lib reads its config from a `.pkglibrc` JSON file.

- `entrypoint`: The file to enter from. Defaults to `src/index` .
- `typings`: Output for Typescript typings. Defaults to `dist/index.d.ts`.
- `cjsOut`: The output file for library consumer entry. Defaults to `dist/index.js`.
- `cjsDevOut`: The output file for a development build. Defaults to `dist/[package].development.js`.
- `cjsProdOut`: The output file for a production build. Defaults to `dist/[package].production.min.js`.
- `esmOut`: The output file for an ESModule build. Defaults to `dist/index.mjs`.
- `target`: The JS syntax and std libs to target (e.g. `node12`, `node14`). Defaults to `node10`.
- `dev`: Enable `__DEV__` and `process.env.NODE_ENV`. Defaults to `true`.
- `invariant`: Disables invariant replacing when false, or changes the function name. Use an array of identifiers for
  multiple invariant functions. Defaults to `invariant`.
- `warning`: Disables warning replacing when false, or changes the function name. Use an array of identifiers for
  multiple warning functions. Defaults to `warning`.

You can also set some of these in your `package.json`:

- `source` sets `entrypoint`
- `typings` sets itself
- `main` sets `cjsOut`
- `module` sets `esmOut`

Run `pkg-lib build` to run the build. You can set a script for this in your `package.json`:

```json
{
  "scripts": {
    "build": "pkg-lib build"
  }
}
```

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
