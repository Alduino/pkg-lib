import {Platform} from "esbuild";

export default interface Config {
    hasMainEntrypoint?: boolean;
    entrypoint?: string;
    entrypoints?: Record<string, string>;
    typings: string;
    mainEntry?: string;
    cjsOut: string;
    cjsDevOut: string;
    cjsProdOut: string;
    esmOut: string;
    platform: Platform;
    target: string;
    dev: boolean;
    invariant: string[];
    warning: string[];
    recommendedExprCheck: boolean;
    docsDir: string;
}
