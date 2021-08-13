import {ListrTask} from "listr2";
import ListrContext from "./ListrContext";
import bundleCommonjsTasks from "./bundle-commonjs";
import bundleEsmTasks from "./bundle-esm";

const bundleTasks: ListrTask<ListrContext> = {
    title: "Bundle",
    task(_, task) {
        return task.newListr([
            bundleCommonjsTasks,
            bundleEsmTasks
        ], {
            concurrent: true
        });
    }
};

export default bundleTasks;
