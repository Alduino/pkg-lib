import {mkdir, writeFile} from "fs/promises";
import {dirname, relative} from "path";
import {build} from "esbuild";
import {
    createCommonJsDevBuild,
    createCommonJsProdBuild
} from "../utils/build-configs";
import createCommonJsEntrypointSource from "../utils/createCommonJsEntrypointSource";
import fillNameTemplate from "../utils/fillNameTemplate";
import getHashbang from "../utils/getHashbang";
import {createStaticTask} from "./utils";

export default createStaticTask("CommonJS", async (_, then) => {
    await then("Development module", async ctx => {
        if (ctx.commonJsDevBuildResult) {
            await ctx.commonJsDevBuildResult.rebuild();
        } else {
            ctx.commonJsDevBuildResult = await build(
                await createCommonJsDevBuild(
                    ctx.config,
                    ctx.paths.tempBundle,
                    ctx.jsx,
                    ctx.watch
                )
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
                        ctx.paths.tempBundle,
                        ctx.jsx,
                        ctx.watch
                    )
                );
            }
        })
        .and("Entrypoint", async ({config}) => {
            for (const [entrypoint, path] of Object.entries(
                config.entrypoints
            )) {
                const indexFile = fillNameTemplate(config.cjsOut, {entrypoint});
                const prodFile = fillNameTemplate(config.cjsProdOut, {
                    entrypoint
                });
                const devFile = fillNameTemplate(config.cjsDevOut, {
                    entrypoint
                });

                const indexDir = dirname(indexFile);
                const relativeProdPath = relative(indexDir, prodFile);
                const relativeDevPath = relative(indexDir, devFile);
                const hashbang = await getHashbang(path);
                const source = createCommonJsEntrypointSource(
                    "./" + relativeProdPath,
                    "./" + relativeDevPath,
                    hashbang
                );
                await mkdir(dirname(indexFile), {recursive: true});
                await writeFile(indexFile, source);
            }
        });
});
