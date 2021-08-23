import {createStaticTask} from "../utils";
import resolveUserFile, {getUserDirectory} from "../../utils/resolveUserFile";
import {basename, dirname, extname, join, relative} from "path";
import execa from "execa";
import logger from "consola";
import {Extractor, ExtractorConfig} from "@microsoft/api-extractor";
import {mkdir} from "fs/promises";

export const buildDeclaration = createStaticTask("Build declaration", async ({tsDeclTempOut}) => {
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

export const bundleDeclaration = createStaticTask("Bundle declaration", async ({config, opts, tsDeclTempOut, tsDocsTempJson}) => {
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

export default createStaticTask("Declaration", async (_, then) => {
    await buildDeclaration(then);
    await bundleDeclaration(then);
});