import {readdir, rm} from "fs/promises";
import {resolve} from "path";
import {build} from "esbuild";
import {node} from "execa";
import {createCommonJsDevBuild} from "./build-configs";
import Config from "../Config";
import getTemporaryFile from "./getTemporaryFile";
import {getUserDirectory} from "./resolveUserFile";
import { basename } from "path";
import {Serializable} from "child_process";
import {ApiModel} from "@microsoft/api-extractor-model";
import generateMarkdownDocs from "./generateMarkdownDocs";

interface CompileNodeScriptResult {
    path: string;
    cleanup(): Promise<void>;
}

async function runNodeScript(scriptPath: string, env: Record<string, string>, context?: Serializable): Promise<Serializable | undefined> {
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

async function compileNodeScript(config: Config, source: string): Promise<CompileNodeScriptResult> {
    const root = await getUserDirectory();
    const tempFile = getTemporaryFile(root, "docgen-build", "js");

    await build({
        ...await createCommonJsDevBuild(config),
        entryPoints: [source],
        outfile: tempFile,
        sourcemap: "inline"
    });

    return {
        path: tempFile,
        cleanup: () => rm(tempFile)
    };
}

export default async function runDocumentationGenerator(config: Config, sourceDirectory: string, customGeneratorPath: string) {
    const sourceFiles = await readdir(sourceDirectory);

    if (customGeneratorPath) {
        const {path: scriptPath, cleanup} = await compileNodeScript(config, customGeneratorPath);
        let context: Serializable = null;

        const note = {
            DOCGEN_NOTE: "These environment variables are internal and may change without a major release",
        };

        try {
            context = await runNodeScript(scriptPath, {
                ...note,
                DOCGEN_HOOK: "start",
                DOCGEN_CONTEXT: JSON.stringify(context ?? null)
            });

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

            await runNodeScript(scriptPath, {
                ...note,
                DOCGEN_HOOK: "end",
                DOCGEN_CONTEXT: JSON.stringify(context ?? null)
            }, context);
        } finally {
            await cleanup();
        }
    } else {
        for (const sourceFile of sourceFiles) {
            const fullPath = resolve(sourceDirectory, sourceFile);
            const outputFile = resolve(config.docsDir, basename(sourceFile, ".json") + ".md");

            const apiModel = new ApiModel();
            const apiPackage = apiModel.loadPackage(fullPath);
            await generateMarkdownDocs(config, outputFile, apiPackage);
        }
    }
}