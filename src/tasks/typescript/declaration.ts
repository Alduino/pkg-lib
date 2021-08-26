import {createStaticTask} from "../utils";
import resolveUserFile, {getUserDirectory} from "../../utils/resolveUserFile";
import {basename, dirname, extname, join, relative, resolve} from "path";
import execa from "execa";
import logger from "consola";
import {Extractor, ExtractorConfig} from "@microsoft/api-extractor";
import {mkdir} from "fs/promises";
import readTsconfig from "../../utils/readTsconfig";
import invariant from "tiny-invariant";
import warning from "tiny-warning";

export const buildDeclaration = createStaticTask("Build declaration", async ({tsDeclTempOut, watch, cacheDir, opts}) => {
    const userDir = await getUserDirectory();
    const tsconfigPath = relative(userDir, await resolveUserFile("tsconfig.json"));

    // require tsconfig to have `include` or `files` set
    const tsconfig = await readTsconfig();
    invariant(tsconfig.include || tsconfig.files, "tsconfig must have `include` or `files` keys, to exclude temporary build files");
    invariant(!tsconfig.include?.some(it => it.startsWith("**/")), "`include` in tsconfig should restrict to a subdirectory of the project, otherwise temporary build files will be matched");
    invariant(!tsconfig.files?.some(it => it.startsWith("**/")), "`files` in tsconfig should restrict to a subdirectory of the project, otherwise temporary build files will be matched");

    const expectedExcludeItems = [
        "**/node_modules",
        "**/.*/"
    ];

    warning(expectedExcludeItems.every(item => tsconfig.exclude.includes(item)), `\`exclude\` in tsconfig should contain ${expectedExcludeItems.map(item => `\`${item}\``).join(", ")} for the best performance. See https://github.com/microsoft/TypeScript/wiki/Performance#misconfigured-include-and-exclude.`);

    const args = [
        "--declaration", "--emitDeclarationOnly",
        "--rootDir", ".",
        "--project", tsconfigPath,
        "--outDir", tsDeclTempOut
    ];

    if (opts.verbose) {
        args.push("--extendedDiagnostics");
    }

    if (watch) {
        args.push(
            "--incremental",
            "--tsBuildInfoFile", resolve(cacheDir, "typescript.json")
        );
    }

    const cp = execa(
        "tsc",
        args,
        {
            preferLocal: true,
            cwd: userDir
        }
    );

    if (opts.verbose) cp.stdout.pipe(process.stdout);

    logger.debug("Executing `%s`", cp.spawnargs.join(" "));
    await cp;
});

export const bundleDeclaration = createStaticTask("Bundle declaration", async ({config, opts, tsDeclTempOut, tsDocsTempJson, watch, cacheDir}) => {
    const userDir = await getUserDirectory();
    const tsconfig = await readTsconfig(true);

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
                overrideTsconfig: {
                    ...tsconfig,
                    compilerOptions: watch ? {
                        ...tsconfig.compilerOptions,
                        incremental: true,
                        tsBuildInfoFile: resolve(cacheDir, "typescript.json")
                    } : tsconfig.compilerOptions
                }
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
