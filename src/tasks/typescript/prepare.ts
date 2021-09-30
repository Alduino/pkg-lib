import {readFile, writeFile} from "fs/promises";
import {basename, dirname, extname, relative, resolve} from "path";
import {name} from "../../../package.json";
import getTemporaryFile from "../../utils/getTemporaryFile";
import readPackageInformation from "../../utils/readPackageInformation";
import {getUserDirectory} from "../../utils/resolveUserFile";
import {createStaticTask} from "../utils";

async function buildRef(sourcePath: string, file: string, enabled: boolean) {
    const relativePath = relative(dirname(sourcePath), `${file}.d.ts`);

    if (!enabled) return "";
    const {name: theirName} = await readPackageInformation();
    if (theirName === name) return `/// <reference path="${relativePath}" />`;
    return `/// <reference types="${name}/${file}" />`;
}

function getEntrypointContent(devRef: string, realSource: string) {
    if (realSource.startsWith("#!")) {
        // hashbang needs to be right at the start of the file
        const lines = realSource.split("\n");
        return [lines[0], devRef, ...lines.slice(1)].join("\n");
    } else {
        return devRef + "\n" + realSource;
    }
}

export const createTemporaryFiles = createStaticTask(
    "Create temporary files",
    async ctx => {
        const {config, cacheDir} = ctx;
        const userDir = await getUserDirectory();

        ctx.tsDeclTempEntry = {};

        for (const [name, path] of Object.entries(ctx.config.entrypoints)) {
            const devRef = await buildRef(path, "dev", config.dev);
            const realSource = await readFile(path, "utf8");

            const realExt = extname(path);
            const realBase = basename(path, realExt);

            const tempEntrypointFileName = getTemporaryFile(
                dirname(path),
                realBase,
                "ts"
            );

            const tempEntrypointContent = getEntrypointContent(devRef, realSource);

            await writeFile(tempEntrypointFileName, tempEntrypointContent);
            ctx.tsDeclTempEntry[name] = tempEntrypointFileName;
        }

        ctx.tsDeclTempOut = resolve(cacheDir, "declarations");
        ctx.tsDocsTempJson = getTemporaryFile(userDir, "docs-json", "tmp");
    }
);

export default createStaticTask("Prepare", async (_, then) => {
    await createTemporaryFiles(then);
});
