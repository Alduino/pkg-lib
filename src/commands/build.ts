import StandardOpts from "./StandardOpts";
import TaskContext from "../tasks/TaskContext";
import getListrContext from "../utils/getListrContext";
import run from "../utils/tasks";
import prepare from "../tasks/prepare";
import bundle from "../tasks/bundle";
import logger from "consola";
import Config from "../Config";

interface BuildOptsChanges extends StandardOpts {
    config?: string;
    noDev?: boolean;
    noInvariant?: boolean;
    noWarning?: boolean;
    invariant?: string;
    warning?: string;
}

export type BuildOpts = Partial<Omit<Config, keyof BuildOptsChanges>> & BuildOptsChanges;

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
