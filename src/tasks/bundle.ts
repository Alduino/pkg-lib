import {ListrTask} from "listr2";
import ListrContext from "./ListrContext";
import bundleCommonjsTasks from "./bundle-commonjs";
import bundleEsmTasks from "./bundle-esm";
import readTsconfig from "../utils/readTsconfig";
import {generateDtsBundle} from "dts-bundle-generator";
import resolveUserFile from "../utils/resolveUserFile";
import {writeFile} from "fs/promises";

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
                    const dtsBundle = generateDtsBundle([{
                        filePath: config.entrypoint
                    }], {
                        preferredConfigPath: await resolveUserFile("tsconfig.json")
                    })[0];

                    await writeFile(config.typings, dtsBundle);
                }
            }
        ]);
    }
};

export default bundleTasks;
