import StandardOpts from "./StandardOpts";
import TaskContext from "../tasks/TaskContext";
import getListrContext from "../utils/getListrContext";
import run from "../utils/tasks";
import prepare from "../tasks/prepare";
import bundle from "../tasks/bundle";
import logger, {LogLevel} from "consola";
import Config from "../Config";
import {mkdir, rm} from "fs/promises";

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
    logger.level = opts.verbose ? LogLevel.Verbose : LogLevel.Info;

    const context: TaskContext = {
        opts,
        ...await getListrContext()
    };

    await mkdir(context.cacheDir, {recursive: true});

    try {
        await run<TaskContext>(context, async (ctx, then) => {
            await then("", async (_, then) => {
                await prepare(then);
                await bundle(then);
            }, {
                async cleanup(ctx) {
                    await rm(ctx.cacheDir, {force: true, recursive: true})
                }
            });
        });
    } catch (err) {
        logger.error(err);
        process.exit(1);
    }
}
