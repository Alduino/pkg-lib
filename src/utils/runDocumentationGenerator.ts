import {Serializable} from "child_process";
import {readdir, rm} from "fs/promises";
import {basename, resolve} from "path";
import {ApiModel} from "@microsoft/api-extractor-model";
import {build} from "esbuild";
import {node} from "execa";
import Config from "../Config";
import TaskContext from "../tasks/TaskContext";
import {createCommonJsDevBuild} from "./build-configs";
import generateMarkdownDocs from "./generateMarkdownDocs";
import getTemporaryFile from "./getTemporaryFile";
import {getUserDirectory} from "./resolveUserFile";
import {ThenFunction} from "./tasks";

interface CompileNodeScriptResult {
    path: string;

    cleanup(): Promise<void>;
}

async function runNodeScript(
    scriptPath: string,
    env: Record<string, string>,
    context?: Serializable
): Promise<Serializable | undefined> {
    const cp = node(scriptPath, {
        env,
        stdout: "inherit",
        stderr: "inherit"
    });

    cp.on("message", msg => {
        context = msg;
    });

    await cp;

    return context;
}

async function compileNodeScript(
    config: Config,
    source: string
): Promise<CompileNodeScriptResult> {
    const root = await getUserDirectory();
    const tempFile = getTemporaryFile(root, "docgen-build", "js");

    await build({
        ...(await createCommonJsDevBuild(config)),
        entryPoints: [source],
        outfile: tempFile,
        sourcemap: "inline"
    });

    return {
        path: tempFile,
        cleanup: () => rm(tempFile)
    };
}

export default async function runDocumentationGenerator(
    then: ThenFunction<TaskContext>,
    config: Config,
    sourceDirectory: string,
    customGeneratorPath: string
): Promise<void> {
    const sourceFiles = await readdir(sourceDirectory);

    await then(
        "Custom generator",
        async (ctx, then) => {
            let context: Serializable = null;

            const note = {
                DOCGEN_NOTE:
                    "These environment variables are internal and may change without a major release"
            };

            const {path: scriptPath, cleanup} = await then("Compile", () =>
                compileNodeScript(config, customGeneratorPath)
            );
            ctx.customDocGenTempCleanup = cleanup;

            context = await then("Run start hook", () =>
                runNodeScript(scriptPath, {
                    ...note,
                    DOCGEN_HOOK: "start",
                    DOCGEN_CONTEXT: JSON.stringify(context ?? null)
                })
            );

            await then("Run doc hooks", async () => {
                for (const sourceFile of sourceFiles) {
                    const fullPath = resolve(sourceDirectory, sourceFile);

                    context = await runNodeScript(scriptPath, {
                        ...note,
                        DOCGEN_HOOK: "doc",
                        DOCGEN_FILE_PATH: fullPath,
                        DOCGEN_FILE_NAME: basename(sourceFile, ".json"),
                        DOCGEN_OUTPUT_DIR: config.docsDir,
                        DOCGEN_CONTEXT: JSON.stringify(context ?? null)
                    });
                }
            });

            await then("Run end hook", () =>
                runNodeScript(
                    scriptPath,
                    {
                        ...note,
                        DOCGEN_HOOK: "end",
                        DOCGEN_CONTEXT: JSON.stringify(context ?? null)
                    },
                    context
                )
            );
        },
        {
            enabled: !!customGeneratorPath,
            cleanup: ({customDocGenTempCleanup}) => customDocGenTempCleanup()
        }
    );

    await then(
        "Default generator",
        async () => {
            for (const sourceFile of sourceFiles) {
                const fullPath = resolve(sourceDirectory, sourceFile);
                const outputFile = resolve(
                    config.docsDir,
                    basename(sourceFile, ".json") + ".md"
                );

                const apiModel = new ApiModel();
                const apiPackage = apiModel.loadPackage(fullPath);
                await generateMarkdownDocs(config, outputFile, apiPackage);
            }
        },
        {
            enabled: !customGeneratorPath
        }
    );
}
