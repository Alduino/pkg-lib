import {build} from "esbuild";
import {createEsmBuild} from "../utils/build-configs";
import ListrContext from "./ListrContext";
import {ListrTask} from "listr2";

const bundleEsmTasks: ListrTask<ListrContext> = {
    title: "ESM",
    task(_, task) {
        return task.newListr([
            {
                title: "Module",
                async task({config, jsx}, task) {
                    const log: string[] = [];
                    await build(await createEsmBuild(config, jsx, log));
                    task.output = log.join("\n");
                },
                options: {
                    persistentOutput: true
                }
            }
        ], {
            rendererOptions: {
                clearOutput: false,
                collapse: false
            }
        });
    }
};

export default bundleEsmTasks;
