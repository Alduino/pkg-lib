import {ListrTask} from "listr2";
import ListrContext from "./ListrContext";
import readTsconfig from "../utils/readTsconfig";
import readPackageInformation from "../utils/readPackageInformation";
import {name} from "../../package.json";
import {basename, dirname, extname} from "path";
import getTemporaryFile from "../utils/getTemporaryFile";
import {unlink, writeFile} from "fs/promises";
import {generateDtsBundle} from "dts-bundle-generator";
import resolveUserFile from "../utils/resolveUserFile";

async function buildRef(file: string, enabled: boolean) {
    if (!enabled) return "";
    const {name: theirName} = await readPackageInformation();
    if (theirName === name) return `/// <reference path="../${file}.d.ts" />`;
    return `/// <reference types="${name}/${file}" />`;
}

const typescriptDeclTasks: ListrTask<ListrContext> = {
    title: "Typescript declaration",
    enabled: () => readTsconfig().then(r => !!r),
    async task(_, task) {
        return task.newListr([
            {
                title: "Create temporary entrypoint",
                async task(ctx) {
                    const {config} = ctx;

                    const devRef = await buildRef("dev", config.dev);

                    const realEntrypointModulePath = "./" + basename(config.entrypoint, extname(config.entrypoint));

                    const entrypointFileName = getTemporaryFile(dirname(config.entrypoint), "index", "ts");
                    const entrypointContent = `${devRef}
export * from ${JSON.stringify(realEntrypointModulePath)};`;
                    await writeFile(entrypointFileName, entrypointContent);

                    ctx.tsDeclTempFile = entrypointFileName;
                }
            },
            {
                title: "Build declaration",
                async task({config, tsDeclTempFile}) {
                    const dtsBundle = generateDtsBundle([{
                        filePath: tsDeclTempFile
                    }], {
                        preferredConfigPath: await resolveUserFile("tsconfig.json")
                    })[0];

                    await writeFile(config.typings, dtsBundle);
                }
            },
            {
                title: "Cleanup",
                async task(ctx) {
                    await unlink(ctx.tsDeclTempFile);
                    ctx.tsDeclTempFile = undefined;
                }
            }
        ]);
    },
    async rollback(ctx) {
        if (ctx.tsDeclTempFile) {
            await unlink(ctx.tsDeclTempFile);
        }
    }
};

export default typescriptDeclTasks;
