import {ListrTask} from "listr2";
import ListrContext from "./ListrContext";
import readTsconfig from "../utils/readTsconfig";
import readPackageInformation from "../utils/readPackageInformation";
import {name} from "../../package.json";
import {basename, dirname, extname, join, relative} from "path";
import getTemporaryFile from "../utils/getTemporaryFile";
import {unlink, writeFile} from "fs/promises";
import resolveUserFile, {getUserDirectory} from "../utils/resolveUserFile";
import execa from "execa";

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
                async task(ctx, task) {
                    const {config, tsDeclTempFile} = ctx;

                    const userDir = await getUserDirectory();
                    const tsconfigPath = relative(userDir, await resolveUserFile("tsconfig.json"));
                    const typingsDir = join(relative(userDir, dirname(config.typings)), "typings");

                    const args = [
                        "--declaration", "--emitDeclarationOnly",
                        "--rootDir", ".",
                        "--project", tsconfigPath,
                        "--outDir", typingsDir
                    ];

                    try {
                        const cp = execa(
                            "tsc",
                            args,
                            {
                                preferLocal: true,
                                cwd: userDir
                            }
                        );

                        task.output = `Executing \`${cp.spawnargs.join(" ")}\``;
                        await cp;
                        task.output = "";
                    } catch (err) {
                        task.output = err.message;
                        throw err;
                    }
                },
                rollback({tsDeclTempFile}) {
                    return unlink(tsDeclTempFile);
                },
                options: {
                    persistentOutput: true
                }
            },
            {
                title: "Cleanup",
                async task({config, tsDeclTempFile}) {
                    await unlink(tsDeclTempFile);
                    await unlink(join(
                        dirname(config.typings),
                        "typings",
                        relative(
                            await getUserDirectory(),
                            join(dirname(tsDeclTempFile), basename(tsDeclTempFile, ".ts") + ".d.ts")
                        )
                    ));
                }
            },
            {
                title: "Create entrypoint",
                async task({config}) {
                    const entrypointTs = relative(await getUserDirectory(), config.entrypoint);
                    const entrypointDts = `./typings/${join(dirname(entrypointTs), basename(entrypointTs, ".ts"))}`;
                    await writeFile(config.typings, `export * from ${JSON.stringify(entrypointDts)};`);
                }
            }
        ]);
    }
};

export default typescriptDeclTasks;
