import StandardOpts from "./StandardOpts";
import TaskContext from "../tasks/TaskContext";
import getListrContext from "../utils/getListrContext";
import run from "../utils/tasks";
import prepare from "../tasks/prepare";
import bundle from "../tasks/bundle";
import logger from "consola";

export interface BuildOpts extends StandardOpts {
}

export default async function build(opts: BuildOpts) {
    const context: TaskContext = {
        opts,
        ...await getListrContext()
    };

    try {
        await run<TaskContext>(context, async (ctx, then) => {
            await prepare(then);
            await bundle(then);
        });
    } catch (err) {
        logger.error(err);
    }
}
