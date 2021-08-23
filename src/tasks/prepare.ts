import readConfig from "../utils/readConfig";
import {createStaticTask} from "./utils";
import resolveUserFile from "../utils/resolveUserFile";

export default createStaticTask("Prepare", async (_, then) => {
    await then("Read configuration", async ctx => {
        ctx.config = await readConfig(ctx.opts);
    });
    await then("Load paths", async ctx => {
        ctx.paths = {
            config: await resolveUserFile(ctx.opts.config),
            packageJson: await resolveUserFile("package.json"),
            tsconfig: await resolveUserFile("tsconfig.json")
        };
    });
});
