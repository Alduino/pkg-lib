import {createStaticTask} from "./utils";
import readTsconfig from "../utils/readTsconfig";
import {basename, dirname, extname, join, relative} from "path";
import {mkdir, rm, writeFile} from "fs/promises";
import resolveUserFile, {getUserDirectory} from "../utils/resolveUserFile";
import getTemporaryFile from "../utils/getTemporaryFile";
import readPackageInformation from "../utils/readPackageInformation";
import {name} from "../../package.json";
import execa from "execa";
import logger from "consola";
import {Extractor, ExtractorConfig} from "@microsoft/api-extractor";
import runDocumentationGenerator from "../utils/runDocumentationGenerator";

async function buildRef(file: string, enabled: boolean) {
    if (!enabled) return "";
    const {name: theirName} = await readPackageInformation();
    if (theirName === name) return `/// <reference path="../${file}.d.ts" />`;
    return `/// <reference types="${name}/${file}" />`;
}

export default createStaticTask("Typescript declaration", async (_, then) => {
    await then("Clean output directory", async ({config}) => {
        const outputDir = join(dirname(config.typings), "typings");
        await rm(outputDir, {recursive: true, force: true});
        await rm(config.typings, {force: true});
    });

    await then("Create temporary files", async ctx => {
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
        ctx.tsDocsTempJson = getTemporaryFile(userDir, "docs-json", "tmp");
    });

    await then("Build declaration", async ({tsDeclTempOut}) => {
        const userDir = await getUserDirectory();
        const tsconfigPath = relative(userDir, await resolveUserFile("tsconfig.json"));

        const args = [
            "--declaration", "--emitDeclarationOnly",
            "--rootDir", ".",
            "--project", tsconfigPath,
            "--outDir", tsDeclTempOut
        ];

        const cp = execa(
            "tsc",
            args,
            {
                preferLocal: true,
                cwd: userDir
            }
        );

        logger.debug("Executing `%s`", cp.spawnargs.join(" "));
        await cp;
    });

    await then("Bundle declaration", async ({config, opts, tsDeclTempOut, tsDocsTempJson}) => {
        const userDir = await getUserDirectory();

        const extractorConfig = ExtractorConfig.prepare({
            configObject: {
                mainEntryPointFilePath: relative(userDir, join(tsDeclTempOut, relative(userDir, join(dirname(config.entrypoint), basename(config.entrypoint, extname(config.entrypoint)) + ".d.ts")))),
                projectFolder: userDir,
                dtsRollup: {
                    enabled: true,
                    untrimmedFilePath: config.typings
                },
                ...config.docsDir && {
                    docModel: {
                        enabled: true,
                        apiJsonFilePath: join(tsDocsTempJson, "<unscopedPackageName>.json")
                    }
                },
                compiler: {
                    tsconfigFilePath: await resolveUserFile("tsconfig.json")
                }
            },
            packageJsonFullPath: await resolveUserFile("package.json"),
            configObjectFullPath: undefined
        });

        await mkdir(tsDocsTempJson, {recursive: true});

        const extractorResult = Extractor.invoke(extractorConfig, {
            localBuild: process.env.CI !== "true",
            showVerboseMessages: opts.verbose
        });

        if (!extractorResult.succeeded) {
            throw new Error(`Bundling failed with ${extractorResult.errorCount} errors and ${extractorResult.warningCount} warnings`);
        }
    });

    await then("Generate API documentation", async ({config, tsDocsTempJson}, then) => {
        const customGenerator = await resolveUserFile("pkglib.documenter", ["js", "mjs", "ts"]);
        await runDocumentationGenerator(then, config, tsDocsTempJson, customGenerator);
    }, {
        enabled: ({config}) => !!config.docsDir
    })
}, {
    enabled: () => readTsconfig().then(r => !!r),
    async cleanup({tsDeclTempEntry, tsDeclTempOut, tsDocsTempJson}) {
        await Promise.all([
            rm(tsDeclTempEntry, {force: true}),
            rm(tsDeclTempOut, {recursive: true, force: true}),
            rm(tsDocsTempJson, {recursive: true, force: true})
        ]);
    }
});
