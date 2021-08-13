import logger from "consola";
import {Listr} from "listr2";
import StandardOpts from "./StandardOpts";
import readTsconfig from "../utils/readTsconfig";
import ListrContext from "../tasks/ListrContext";
import prepareTasks from "../tasks/prepare";
import bundleTasks from "../tasks/bundle";

export interface BuildOpts extends StandardOpts {
}

export default async function build(opts: BuildOpts) {
    const tasks = new Listr<ListrContext, "default" | "verbose">([
        prepareTasks,
        bundleTasks
    ], {
        renderer: opts.verbose ? "verbose" : "default"
    });

    const tsconfig = await readTsconfig();

    const jsxOpt = tsconfig?.compilerOptions?.jsx;
    const jsxTransform: ListrContext["jsx"] = jsxOpt?.startsWith("react-jsx") ? "react-jsx" : "createElement";

    if (!tsconfig.compilerOptions?.isolatedModules) {
        logger.error("compilerOptions.isolatedModules must be `true` in your tsconfig");
        process.exit(1);
    }

    if (jsxOpt === "react-jsx") {
        logger.warn("compilerOptions.jsx in your tsconfig should not be `react-jsx`, use `react-jsxdev` instead");
    }

    await tasks.run({opts, jsx: jsxTransform});
}
