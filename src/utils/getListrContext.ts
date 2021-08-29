import logger from "consola";
import invariant from "tiny-invariant";
import TaskContext from "../tasks/TaskContext";
import getTemporaryFile from "./getTemporaryFile";
import readTsconfig from "./readTsconfig";
import {getUserDirectory} from "./resolveUserFile";
import {BuildOpts} from "../commands/build";

export default async function getListrContext(opts: BuildOpts): Promise<TaskContext> {
    logger.log(
        "Hint: Add `.pkglib-cache.*.tmp` to your ignore file to ignore pkg-lib's cache"
    );

    const tsconfig = await readTsconfig();
    const cacheDir = getTemporaryFile(
        await getUserDirectory(),
        ".pkglib-cache",
        "tmp"
    );

    const jsxOpt = tsconfig?.compilerOptions?.jsx;
    const jsxTransform: TaskContext["jsx"] = jsxOpt?.startsWith("react-jsx")
        ? "react-jsx"
        : "createElement";

    invariant(!tsconfig || tsconfig.compilerOptions?.isolatedModules, "compilerOptions.isolatedModules must be `true` in your tsconfig");

    if (jsxOpt === "react-jsx") {
        logger.warn(
            "compilerOptions.jsx in your tsconfig should not be `react-jsx`, use `react-jsxdev` instead"
        );
    }

    if (!tsconfig && /\.tsx?$/.test(opts.entrypoint)) {
        logger.warn("Entrypoint is a Typescript file but there is no tsconfig.json file. Typescript-specific features will not run.");
    }

    return {
        jsx: jsxTransform,
        cacheDir,
        opts
    };
}
