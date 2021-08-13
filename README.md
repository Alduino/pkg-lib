# pkg-lib

Library bundler

Inspired by [tsdx](https://tsdx.io/), [aqu](https://github.com/ArtiomTr/aqu).

## Features
- Supports Typescript, Javascript, React, etc
- Builds a version for apps in dev mode, and another one with apps in prod mode.
- Builds an ESModules version for better tree-shaking
- Bundles Typescript types into a single .d.ts file
- Supports the new JSX transform (and correctly switches between `react-jsx` and `react-jsxdev`)

## Usage

pkg-lib reads its config from your `package.json`, or from a `.pkglibrc` JSON file.

- `entrypoint`: The file to enter from. Defaults to `src/index` .
- `typings`: Output for Typescript typings. Defaults to `dist/index.d.ts`.
- `cjsOut`: The output file for library consumer entry. Defaults to `dist/index.js`.
- `cjsDevOut`: The output file for a development build. Defaults to `dist/[package].development.js`.
- `cjsProdOut`: The output file for a production build. Defaults to `dist/[package].production.min.js`.
- `esmOut`: The output file for an ESModule build. Defaults to `dist/index.mjs`.
- `target`: The JS syntax and std libs to target (e.g. `node12`, `node14`). Defaults to `node10`.

These map to various properties in the `package.json`:

- `entrypoint` maps to `source`
- `typings` stays the same
- `cjsOut` maps to `main`
- `esmOut` maps to `module`

Run `pkg-lib build` to run the build. You can set a script for this in your `package.json`:
```json
{
  "scripts": {
    "build": "pkg-lib build"
  }
}
```
