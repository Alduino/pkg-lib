# @alduino/pkg-lib

## 0.2.0
### Minor Changes

- 88377c3: Added optimisations for calls to `invariant` and `warning`. If you don't want to use these features, disable them
  with `"invariant": false` and `"warning": false` in the config.
- c12e82e: Replace `__DEV__` and `process.env.NODE_ENV` depending on the environment. To use this with Typescript, add a
  `.d. ts` file somewhere containing `/// <reference types="@alduino/pkg-lib/dev" />`. If you don't want to use this
  feature, disable it by setting `"dev": false` in the config.
- 080ea19: Add option to change the target platform