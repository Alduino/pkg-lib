import {mkdir} from "fs/promises";
import {basename, dirname, extname, join, relative, resolve} from "path";
import {Extractor, ExtractorConfig} from "@microsoft/api-extractor";
import logger from "consola";
import execa from "execa";
import invariant from "tiny-invariant";
import fillNameTemplate from "../../utils/fillNameTemplate";
import readTsconfig from "../../utils/readTsconfig";
import resolveUserFile, {getUserDirectory} from "../../utils/resolveUserFile";
import {createStaticTask} from "../utils";

export const buildDeclaration = createStaticTask(
    "Build declaration",
    async ({tsDeclTempOut, cacheDir, opts}) => {
        const userDir = await getUserDirectory();
        const tsconfigPath = relative(
            userDir,
            await resolveUserFile("tsconfig.json")
        );

        // require tsconfig to have `include` or `files` set
        const tsconfig = await readTsconfig(true);
        invariant(
            tsconfig.include || tsconfig.files,
            "tsconfig must have `include` or `files` keys, to exclude temporary build files"
        );
        invariant(
            !tsconfig.include?.some(it => it.startsWith("**/")),
            "`include` in tsconfig should restrict to a subdirectory of the project, otherwise temporary build files will be matched"
        );
        invariant(
            !tsconfig.files?.some(it => it.startsWith("**/")),
            "`files` in tsconfig should restrict to a subdirectory of the project, otherwise temporary build files will be matched"
        );

        const expectedExcludeItems = ["**/node_modules", "**/.*/"];

        if (
            !expectedExcludeItems.every(item =>
                tsconfig.exclude?.includes(item)
            )
        ) {
            logger.warn(
                `\`exclude\` in tsconfig should contain ${expectedExcludeItems
                    .map(item => `\`${item}\``)
                    .join(
                        ", "
                    )} for the best performance. See https://github.com/microsoft/TypeScript/wiki/Performance#misconfigured-include-and-exclude.`
            );
        }

        const args = [
            "--declaration",
            "--emitDeclarationOnly",
            "--rootDir",
            ".",
            "--project",
            tsconfigPath,
            "--outDir",
            tsDeclTempOut,
            "--incremental",
            "--tsBuildInfoFile",
            resolve(cacheDir, "typescript.json")
        ];

        if (opts.verbose) {
            args.push("--extendedDiagnostics");
        }

        const cp = execa("tsc", args, {
            preferLocal: true,
            cwd: userDir
        });

        if (opts.verbose) cp.stdout.pipe(process.stdout);

        logger.debug("Executing `%s`", cp.spawnargs.join(" "));
        await cp;
    }
);

export const bundleDeclaration = createStaticTask(
    "Bundle declaration",
    async ({
        config,
        opts,
        tsDeclTempOut,
        tsDocsTempJson,
        tsDeclTempEntry,
        watch,
        cacheDir
    }) => {
        const userDir = await getUserDirectory();
        const tsconfig = await readTsconfig(true);

        for (const name of Object.keys(config.entrypoints)) {
            const tempEntryPath = tsDeclTempEntry[name];

            const extractorConfig = ExtractorConfig.prepare({
                configObject: {
                    mainEntryPointFilePath: relative(
                        userDir,
                        join(
                            tsDeclTempOut,
                            relative(
                                userDir,
                                join(
                                    dirname(tempEntryPath),
                                    basename(
                                        tempEntryPath,
                                        extname(tempEntryPath)
                                    ) + ".d.ts"
                                )
                            )
                        )
                    ),
                    projectFolder: userDir,
                    dtsRollup: {
                        enabled: true,
                        untrimmedFilePath: fillNameTemplate(config.typings, {entrypoint: name})
                    },
                    ...(config.docsDir && {
                        docModel: {
                            enabled: true,
                            apiJsonFilePath: join(
                                tsDocsTempJson,
                                name + ".json"
                            )
                        }
                    }),
                    compiler: {
                        overrideTsconfig: {
                            ...tsconfig,
                            compilerOptions: watch
                                ? {
                                      ...tsconfig.compilerOptions,
                                      incremental: true,
                                      tsBuildInfoFile: resolve(
                                          cacheDir,
                                          "typescript.json"
                                      )
                                  }
                                : tsconfig.compilerOptions
                        }
                    }
                },
                packageJsonFullPath: await resolveUserFile("package.json"),
                configObjectFullPath: undefined
            });

            const extractorResult = Extractor.invoke(extractorConfig, {
                localBuild: process.env.CI !== "true",
                showVerboseMessages: opts.verbose
            });

            invariant(
                extractorResult.succeeded,
                `Bundling failed with ${extractorResult.errorCount} errors and ${extractorResult.warningCount} warnings`
            );
        }

        await mkdir(tsDocsTempJson, {recursive: true});
    }
);

export default createStaticTask("Declaration", async (_, then) => {
    await buildDeclaration(then);
    await bundleDeclaration(then);
});
