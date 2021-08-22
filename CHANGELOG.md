# @alduino/pkg-lib

## 0.4.0

### Minor Changes

- 3e910ab: Set configuration from the CLI
- c7b7e26: Switch to a custom task runner that suits the tool better

### Patch Changes

- e887aa3: Show debug logs when `--verbose` flag is set

## 0.3.0

### Minor Changes

- 1ef415d: Add optional documentation generation based on TSDoc using API Extractor
- 73c569c: Bundle all Typescript types into a single file

## 0.2.0

### Minor Changes

- 88377c3: Added optimisations for calls to `invariant` and `warning`. If you don't want to use these features, disable them
  with `"invariant": false` and `"warning": false` in the config.
- c12e82e: Replace `__DEV__` and `process.env.NODE_ENV` depending on the environment. To use this with Typescript, add a
  `.d. ts` file somewhere containing `/// <reference types="@alduino/pkg-lib/dev" />`. If you don't want to use this
  feature, disable it by setting `"dev": false` in the config.
- 080ea19: Add option to change the target platform
