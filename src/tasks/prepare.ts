import readConfig from "../utils/readConfig";
import {ListrTask} from "listr2";
import ListrContext from "./ListrContext";

const prepareTasks: ListrTask<ListrContext> = {
    title: "Prepare",
    task(_, task) {
        return task.newListr([
            {
                title: "Read configuration",
                async task(ctx) {
                    ctx.config = await readConfig();
                }
            }
        ]);
    }
};

export default prepareTasks;
