import {mkdir, writeFile} from "fs/promises";
import {dirname, relative} from "path";
import {build} from "esbuild";
import {
    createCommonJsDevBuild,
    createCommonJsProdBuild
} from "../utils/build-configs";
import createCommonJsEntrypointSource from "../utils/createCommonJsEntrypointSource";
import {createStaticTask} from "./utils";

export default createStaticTask("CommonJS", async (_, then) => {
    await then("Development module", async ctx => {
        if (ctx.commonJsDevBuildResult) {
            await ctx.commonJsDevBuildResult.rebuild();
        } else {
            ctx.commonJsDevBuildResult = await build(
                await createCommonJsDevBuild(ctx.config, ctx.jsx, ctx.watch)
            );
        }
    })
        .and("Production module", async ctx => {
            if (ctx.commonJsProdBuildResult) {
                await ctx.commonJsProdBuildResult.rebuild();
            } else {
                ctx.commonJsProdBuildResult = await build(
                    await createCommonJsProdBuild(
                        ctx.config,
                        ctx.jsx,
                        ctx.watch
                    )
                );
            }
        })
        .and("Entrypoint", async ({config}) => {
            const indexDir = dirname(config.cjsOut);
            const relativeProdPath = relative(indexDir, config.cjsProdOut);
            const relativeDevPath = relative(indexDir, config.cjsDevOut);
            const source = createCommonJsEntrypointSource(
                "./" + relativeProdPath,
                "./" + relativeDevPath
            );
            await mkdir(dirname(config.cjsOut), {recursive: true});
            await writeFile(config.cjsOut, source);
        });
});
