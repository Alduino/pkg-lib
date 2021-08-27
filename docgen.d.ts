import {Serializable} from "child_process";
import {ApiPackage} from "@microsoft/api-extractor-model";

interface DocArg {
    fileName: string;
    outputDirectory: string;
    source: ApiPackage;
}

/**
 * Returns the context object, previously set with `setContext()`.
 * @remarks Don't edit the result of this function, it will not be saved.
 */
export function getContext(): Serializable | undefined;

/**
 * Sets some context that can be retrieved using `getContext()`.
 * This value persists over the whole docs generation phase.
 * @param value The value to save to the context
 * @remarks If you edit the object, remember to call `setContext` again.
 */
export function setContext(value: Serializable): void;

/**
 * Called for each docs file
 */
export function hook(name: "doc", callback: (arg: DocArg) => void): void;

/**
 * Called before any other hooks
 */
export function hook(name: "start", callback: () => void): void;

/**
 * Called after all other hooks
 */
export function hook(name: "end", callback: () => void): void;
