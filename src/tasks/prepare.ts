import readConfig from "../utils/readConfig";
import resolveUserFile, {getUserDirectory} from "../utils/resolveUserFile";
import {createStaticTask} from "./utils";
import logger from "consola";
import {existsSync} from "fs";

export default createStaticTask("Prepare", async (_, then) => {
    await then("Read configuration", async ctx => {
        ctx.config = await readConfig(ctx.opts);
    });
    await then("Load paths", async ctx => {
        ctx.paths = {
            userDir: await getUserDirectory(),
            config: await resolveUserFile(ctx.opts.config),
            packageJson: await resolveUserFile("package.json"),
            tsconfig: await resolveUserFile("tsconfig.json")
        };
    });
    await then("Run checks", async ctx => {
        if (!existsSync(ctx.paths.tsconfig) && /\.tsx?$/.test(ctx.config.entrypoint)) {
            logger.warn("Entrypoint is a Typescript file but there is no tsconfig.json file. Typescript-specific features will not run.");
        }
    });
});
