import {writeFile} from "fs/promises";
import {basename, dirname, extname, resolve} from "path";
import {name} from "../../../package.json";
import getTemporaryFile from "../../utils/getTemporaryFile";
import readPackageInformation from "../../utils/readPackageInformation";
import {getUserDirectory} from "../../utils/resolveUserFile";
import {createStaticTask} from "../utils";

async function buildRef(file: string, enabled: boolean) {
    if (!enabled) return "";
    const {name: theirName} = await readPackageInformation();
    if (theirName === name) return `/// <reference path="../${file}.d.ts" />`;
    return `/// <reference types="${name}/${file}" />`;
}

export const createTemporaryFiles = createStaticTask(
    "Create temporary files",
    async ctx => {
        const {config, cacheDir} = ctx;
        const userDir = await getUserDirectory();

        const devRef = await buildRef("dev", config.dev);

        const realEntrypointModulePath =
            "./" + basename(config.entrypoint, extname(config.entrypoint));

        const entrypointFileName = getTemporaryFile(
            dirname(config.entrypoint),
            "index",
            "ts"
        );
        const entrypointContent = `${devRef}
export * from ${JSON.stringify(realEntrypointModulePath)};`;
        await writeFile(entrypointFileName, entrypointContent);

        ctx.tsDeclTempEntry = entrypointFileName;
        ctx.tsDeclTempOut = resolve(cacheDir, "declarations");
        ctx.tsDocsTempJson = getTemporaryFile(userDir, "docs-json", "tmp");
    }
);

export default createStaticTask("Prepare", async (_, then) => {
    await createTemporaryFiles(then);
});
