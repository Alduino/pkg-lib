import {ListrTask} from "listr2";
import ListrContext from "./ListrContext";
import bundleCommonjsTasks from "./bundle-commonjs";
import bundleEsmTasks from "./bundle-esm";
import readTsconfig from "../utils/readTsconfig";
import {generateDtsBundle} from "dts-bundle-generator";
import resolveUserFile from "../utils/resolveUserFile";
import {unlink, writeFile} from "fs/promises";
import {basename, dirname, extname} from "path";
import getTemporaryFile from "../utils/getTemporaryFile";
import readPackageInformation from "../utils/readPackageInformation";
import {name} from "../../package.json";

const bundleTasks: ListrTask<ListrContext> = {
    title: "Bundle",
    task(_, task) {
        return task.newListr([
            bundleCommonjsTasks,
            bundleEsmTasks,
            {
                title: "Typescript declarations",
                enabled: () => readTsconfig().then(r => !!r),
                async task({config}) {
                    const {name: theirName} = await readPackageInformation();
                    const refProp = theirName === name ? `path="../dev.d.ts"` : `types="${name}/dev"`;

                    const realEntrypointModulePath = "./" + basename(config.entrypoint, extname(config.entrypoint));

                    const entrypointFileName = getTemporaryFile(dirname(config.entrypoint), "index", "ts");
                    const entrypointContent = `/// <reference ${refProp} />
export * from ${JSON.stringify(realEntrypointModulePath)};`;
                    await writeFile(entrypointFileName, entrypointContent);

                    try {
                        const dtsBundle = generateDtsBundle([{
                            filePath: entrypointFileName
                        }], {
                            preferredConfigPath: await resolveUserFile("tsconfig.json")
                        })[0];

                        await writeFile(config.typings, dtsBundle);
                    } finally {
                        await unlink(entrypointFileName);
                    }
                }
            }
        ]);
    }
};

export default bundleTasks;
