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
                async task({config, jsx}) {
                    await build(createEsmBuild(config, jsx));
                }
            }
        ]);
    }
};

export default bundleEsmTasks;
