import {ListrTask} from "listr2";
import ListrContext from "./ListrContext";
import bundleCommonjsTasks from "./bundle-commonjs";
import bundleEsmTasks from "./bundle-esm";
import typescriptDeclTasks from "./typescript-decls";

const bundleTasks: ListrTask<ListrContext> = {
    title: "Bundle",
    task(_, task) {
        return task.newListr([
            bundleCommonjsTasks,
            bundleEsmTasks,
            typescriptDeclTasks
        ], {
            rendererOptions: {
                clearOutput: false,
                collapse: false
            }
        });
    }
};

export default bundleTasks;
