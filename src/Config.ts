import {Platform} from "esbuild";

export default interface Config {
    entrypoint: string;
    typings: string;
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
}
