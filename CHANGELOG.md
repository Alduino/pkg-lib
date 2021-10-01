# @alduino/pkg-lib

## 0.6.0

### Minor Changes

-   a2f6307: Added machine-readable message in watch mode when there is no TTY
-   1be6318: Added support for multiple entrypoints. To add a new entrypoint, create a new source file in the root directory of your
    project. Otherwise, everything should "just work" if you haven't changed any configuration.

### Patch Changes

-   a2f6307: Added check for TTY mode before attempting to set raw mode
-   cfc457f: Include all potential replacements (`invariant`, `warning`, `__DEV__`) in the cursory check to see if a file needs to be transformed by Babel

## 0.5.1

### Patch Changes

-   22900fd: Fix various tsconfig issues - Typescript features will now only run if there is a tsconfig.json file,
    and pkg-lib will now warn you if your entrypoint is a Typescript file but there is no tsconfig.json
-   efb4e49: Add check for if tsconfig exists before checking `compilerOptions`

## 0.5.0

### Minor Changes

-   12ae3d9: Add `watch` command, that detects changes in source files and quickly recompiles them automatically

### Patch Changes

-   3500ef1: CJS development and production builds will no longer include the package name, to make it simpler and to prevent situations where the package name is an invalid file name

## 0.4.1

### Patch Changes

-   17ca9ae: Add ponyfill for `AbortController` in task system

## 0.4.0

### Minor Changes

-   3e910ab: Set configuration from the CLI
-   c7b7e26: Switch to a custom task runner that suits the tool better

### Patch Changes

-   e887aa3: Show debug logs when `--verbose` flag is set

## 0.3.0

### Minor Changes

-   1ef415d: Add optional documentation generation based on TSDoc using API Extractor
-   73c569c: Bundle all Typescript types into a single file

## 0.2.0

### Minor Changes

-   88377c3: Added optimisations for calls to `invariant` and `warning`. If you don't want to use these features, disable them
    with `"invariant": false` and `"warning": false` in the config.
-   c12e82e: Replace `__DEV__` and `process.env.NODE_ENV` depending on the environment. To use this with Typescript, add a
    `.d. ts` file somewhere containing `/// <reference types="@alduino/pkg-lib/dev" />`. If you don't want to use this
    feature, disable it by setting `"dev": false` in the config.
-   080ea19: Add option to change the target platform
