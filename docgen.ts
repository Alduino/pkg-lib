import {Serializable} from "child_process";
import {ApiModel, ApiPackage} from "@microsoft/api-extractor-model";
const apiModel = new ApiModel();

interface DocArg {
    fileName: string;
    outputDirectory: string;
    source: ApiPackage;
}

let context = JSON.parse(process.env.DOCGEN_CONTEXT);

function docHook(callback: (arg: DocArg) => void) {
    const sourcePath = process.env.DOCGEN_FILE_PATH;
    const fileName = process.env.DOCGEN_FILE_NAME;
    const outputDir = process.env.DOCGEN_OUTPUT_DIR;

    callback({
        fileName,
        outputDirectory: outputDir,
        source: apiModel.loadPackage(sourcePath)
    });
}

function defaultHook(callback: () => void) {
    callback();
}

/**
 * Returns the context object, previously set with `setContext()`.
 * @remarks Don't edit the result of this function, it will not be saved.
 */
export function getContext(): Serializable | undefined {
    return context;
}

/**
 * Sets some context that can be retrieved using `getContext()`.
 * This value persists over the whole docs generation phase.
 * @param value The value to save to the context
 * @remarks If you edit the object, remember to call `setContext` again.
 */
export function setContext(value: Serializable): void {
    context = value;
    process.send(value);
}

interface HookFunction {
    /**
     * Called for each docs file
     */
    (name: "doc", callback: (arg: DocArg) => void): void;

    /**
     * Called before any other hooks
     */
    (name: "start", callback: () => void): void;

    /**
     * Called after all other hooks
     */
    (name: "end", callback: () => void): void;
}

function hookFn(name: string, callback: (...args: unknown[]) => void) {
    if (name !== process.env.DOCGEN_HOOK) return;

    switch (name) {
        case "doc": return docHook(callback);
        case "start": return defaultHook(callback);
        case "end": return defaultHook(callback);
    }
}

export const hook: HookFunction = hookFn as HookFunction;
