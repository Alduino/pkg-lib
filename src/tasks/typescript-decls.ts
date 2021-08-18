import {ListrTask} from "listr2";
import ListrContext from "./ListrContext";
import readTsconfig from "../utils/readTsconfig";
import readPackageInformation from "../utils/readPackageInformation";
import {name} from "../../package.json";
import {basename, dirname, extname, join, relative} from "path";
import getTemporaryFile from "../utils/getTemporaryFile";
import {rm, writeFile} from "fs/promises";
import resolveUserFile, {getUserDirectory} from "../utils/resolveUserFile";
import execa from "execa";
import {Extractor, ExtractorConfig} from "@microsoft/api-extractor";

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
                title: "Clean output directory",
                async task({config}) {
                    const outputDir = join(dirname(config.typings), "typings");
                    await rm(outputDir, {recursive: true, force: true});
                    await rm(config.typings, {force: true});
                }
            },
            {
                title: "Create temporary entrypoint",
                async task(ctx) {
                    const {config} = ctx;
                    const userDir = await getUserDirectory();

                    const devRef = await buildRef("dev", config.dev);

                    const realEntrypointModulePath = "./" + basename(config.entrypoint, extname(config.entrypoint));

                    const entrypointFileName = getTemporaryFile(dirname(config.entrypoint), "index", "ts");
                    const entrypointContent = `${devRef}
export * from ${JSON.stringify(realEntrypointModulePath)};`;
                    await writeFile(entrypointFileName, entrypointContent);

                    ctx.tsDeclTempEntry = entrypointFileName;
                    ctx.tsDeclTempOut = getTemporaryFile(userDir, "declarations", "tmp");
                }
            },
            {
                title: "Build declaration",
                async task(ctx, task) {
                    const {tsDeclTempOut: typingsDir} = ctx;

                    const userDir = await getUserDirectory();
                    const tsconfigPath = relative(userDir, await resolveUserFile("tsconfig.json"));

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
                async rollback({tsDeclTempEntry, tsDeclTempOut}) {
                    await Promise.all([
                        rm(tsDeclTempEntry),
                        rm(tsDeclTempOut, {recursive: true})
                    ]);
                },
                options: {
                    persistentOutput: true
                }
            },
            {
                title: "Bundle declaration",
                async task({config, opts, tsDeclTempOut}, task) {
                    const userDir = await getUserDirectory();

                    const extractorConfig = ExtractorConfig.prepare({
                        configObject: {
                            mainEntryPointFilePath: relative(userDir, join(tsDeclTempOut, relative(userDir, join(dirname(config.entrypoint), basename(config.entrypoint, extname(config.entrypoint)) + ".d.ts")))),
                            projectFolder: userDir,
                            dtsRollup: {
                                enabled: true,
                                untrimmedFilePath: config.typings
                            },
                            compiler: {
                                tsconfigFilePath: await resolveUserFile("tsconfig.json")
                            }
                        },
                        packageJsonFullPath: await resolveUserFile("package.json"),
                        configObjectFullPath: undefined
                    });

                    const extractorResult = Extractor.invoke(extractorConfig, {
                        localBuild: process.env.CI === "true",
                        showVerboseMessages: opts.verbose
                    });

                    if (!extractorResult.succeeded) {
                        const message = `Bundling failed with ${extractorResult.errorCount} errors and ${extractorResult.warningCount} warnings`;
                        task.output = message;
                        throw new Error(message);
                    }
                },
                async rollback({tsDeclTempEntry, tsDeclTempOut}) {
                    await Promise.all([
                        rm(tsDeclTempEntry),
                        rm(tsDeclTempOut, {recursive: true})
                    ]);
                },
                options: {
                    persistentOutput: true
                }
            },
            {
                title: "Cleanup",
                async task({config, tsDeclTempEntry, tsDeclTempOut}) {
                    await Promise.all([
                        rm(tsDeclTempEntry),
                        rm(tsDeclTempOut, {recursive: true})
                    ]);
                }
            }
        ]);
    }
};

export default typescriptDeclTasks;
