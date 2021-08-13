import readTsconfig from "./readTsconfig";
import ListrContext from "../tasks/ListrContext";
import logger from "consola";

export default async function getListrContext(): Promise<Pick<ListrContext, "jsx">> {
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

    return {
        jsx: jsxTransform
    };
}
