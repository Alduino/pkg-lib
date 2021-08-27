import {build} from "esbuild";
import {createEsmBuild} from "../utils/build-configs";
import {createStaticTask} from "./utils";

export default createStaticTask("ESM", async (_, then) => {
    await then("Module", async ctx => {
        if (ctx.esmBuildResult) {
            await ctx.esmBuildResult.rebuild();
        } else {
            ctx.esmBuildResult = await build(
                await createEsmBuild(ctx.config, ctx.jsx, ctx.watch)
            );
        }
    });
});
