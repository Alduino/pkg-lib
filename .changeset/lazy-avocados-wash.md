---
"@alduino/pkg-lib": minor
---

Replace `__DEV__` and `process.env.NODE_ENV` depending on the environment. To use this with Typescript, add a
`.d. ts` file somewhere containing `/// <reference types="@alduino/pkg-lib/dev" />`. If you don't want to use this
feature, disable it by setting `"dev": false` in the config.
