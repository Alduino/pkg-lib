import {mkdir, rm} from "fs/promises";
import logger, {LogLevel} from "consola";
import Config from "../Config";
import TaskContext from "../tasks/TaskContext";
import bundle from "../tasks/bundle";
import prepare from "../tasks/prepare";
import getListrContext from "../utils/getListrContext";
import run from "../utils/tasks";
import StandardOpts from "./StandardOpts";

interface BuildOptsChanges extends StandardOpts {
    config?: string;
    noDev?: boolean;
    noInvariant?: boolean;
    noWarning?: boolean;
    invariant?: string;
    warning?: string;
    entrypoints?: string;
    noCleanup?: string;
    cache?: string;
}

export type BuildOpts = Partial<Omit<Config, keyof BuildOptsChanges>> &
    BuildOptsChanges;

export default async function build(opts: BuildOpts): Promise<void> {
    logger.level = opts.verbose ? LogLevel.Verbose : LogLevel.Info;
    logger.trace("Running with CLI args: %s", opts);

    const context: TaskContext = await getListrContext(opts);

    await mkdir(context.cacheDir, {recursive: true});

    try {
        await run<TaskContext>(context, async (ctx, then) => {
            await then(
                "",
                async (_, then) => {
                    await prepare(then);
                    await bundle(then);
                },
                {
                    async cleanup(ctx) {
                        if (ctx.opts.noCleanup) return logger.debug("Not cleaning up as it is disabled");
                        await rm(ctx.cacheDir, {force: true, recursive: true});
                    }
                }
            );
        });
    } catch (err) {
        logger.error(err);
        process.exit(1);
    }
}
