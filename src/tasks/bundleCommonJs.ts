import {build} from "esbuild";
import {createCommonJsDevBuild, createCommonJsProdBuild} from "../utils/build-configs";
import { dirname, relative } from "path";
import createCommonJsEntrypointSource from "../utils/createCommonJsEntrypointSource";
import {mkdir, writeFile} from "fs/promises";
import {createStaticTask} from "./utils";

export default createStaticTask("CommonJS", async (_, then) => {
    await then("Development module", async ({config, jsx}) => {
        await build(await createCommonJsDevBuild(config, jsx));
    }).and("Production module", async ({config, jsx}) => {
        await build(await createCommonJsProdBuild(config, jsx));
    }).and("Entrypoint", async ({config}) => {
        const indexDir = dirname(config.cjsOut);
        const relativeProdPath = relative(indexDir, config.cjsProdOut);
        const relativeDevPath = relative(indexDir, config.cjsDevOut);
        const source = createCommonJsEntrypointSource("./" + relativeProdPath, "./" + relativeDevPath);
        await mkdir(dirname(config.cjsOut), {recursive: true});
        await writeFile(config.cjsOut, source);
    });
});
