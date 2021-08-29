---
"@alduino/pkg-lib": patch
---

Fix various tsconfig issues - Typescript features will now only run if there is a tsconfig.json file, 
and pkg-lib will now warn you if your entrypoint is a Typescript file but there is no tsconfig.json
