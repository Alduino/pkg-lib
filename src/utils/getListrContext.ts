import logger from "consola";
import TaskContext from "../tasks/TaskContext";
import getTemporaryFile from "./getTemporaryFile";
import readTsconfig from "./readTsconfig";
import {getUserDirectory} from "./resolveUserFile";

export default async function getListrContext(): Promise<
    Pick<TaskContext, "jsx" | "cacheDir">
> {
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

    if (!tsconfig.compilerOptions?.isolatedModules) {
        logger.error(
            "compilerOptions.isolatedModules must be `true` in your tsconfig"
        );
        process.exit(1);
    }

    if (jsxOpt === "react-jsx") {
        logger.warn(
            "compilerOptions.jsx in your tsconfig should not be `react-jsx`, use `react-jsxdev` instead"
        );
    }

    return {
        jsx: jsxTransform,
        cacheDir
    };
}
