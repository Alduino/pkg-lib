import {watch as chokidar} from "chokidar";
import {BuildOpts} from "./build";
import TaskContext from "../tasks/TaskContext";
import logger, {LogLevel} from "consola";
import getListrContext from "../utils/getListrContext";
import run, {ThenFunction, ThenResult} from "../utils/tasks";
import prepare from "../tasks/prepare";
import bundle from "../tasks/bundle";
import typescriptFeatures, {CUSTOM_DOCUMENTER_EXTS, CUSTOM_DOCUMENTER_FILE} from "../tasks/typescript";
import {Metafile} from "esbuild";
import resolveUserFile from "../utils/resolveUserFile";
import {Mutex} from "async-mutex";
import createResolvablePromise from "../utils/createResolvablePromise";

export interface WatchOpts extends BuildOpts {
}

interface ManualTriggerResult {
    cancel(): void;
}

const enum BuildState {
    None,
    Queued,
    Building
}

interface QueuedBuilds {
    prepare?: BuildState;
    code?: BuildState;
    typescript?: BuildState;
}

class Watcher {
    private lastManualTrigger?: ManualTriggerResult;
    private lastRun?: ThenResult<TaskContext, void>;
    private queuedBuilds: QueuedBuilds = {};
    private readonly watcher = chokidar(this.context.paths.userDir, {
        ignored: /[\/\\]node_modules[\/\\]|[\/\\]\.git[\/\\]/,
        ignoreInitial: true
    });
    private readonly buildMutex = new Mutex();

    constructor(private readonly context: TaskContext, private readonly then: ThenFunction<TaskContext>) {
    }

    private get configurationFiles() {
        return [this.context.paths.config, this.context.paths.packageJson];
    }

    private static getInputsFromMetafile(metafile: Metafile) {
        if (!metafile) return [];
        return Object.keys(metafile.inputs);
    }

    init() {
        this.watcher.on("change", path => this.handleUpdate(path));
        this.watcher.on("add", path => this.handleUpdate(path));
        this.watcher.on("unlink", path => this.handleUpdate(path));
    }

    setupManualTrigger() {
        // only allow one manual trigger-er at once
        this.lastManualTrigger?.cancel();

        process.stdin.resume();
        logger.info("Press `r` to build again, or `q` to quit gracefully.");

        const handler = (chunk: Buffer) => {
            switch (chunk.toString("ascii")[0]) {
                case "r":
                    cancel();
                    this.queuedBuilds.prepare = BuildState.Queued;
                    this.queuedBuilds.code = BuildState.Queued;
                    this.trigger();
                    break;
                case "q":
                case "\x03":
                    cancel();
                    this.cleanup();
                    console.log("Goodbye!");
                    break;
            }
        };

        process.stdin.on("data", handler);

        const cancel = () => {
            // erase the log line and stop listening
            process.stdout.write("\x1b[1A\x1b[K");
            process.stdin.off("data", handler);
            process.stdin.pause();
        }

        return {cancel} as ManualTriggerResult;
    }

    private async handleUpdate(path: string) {
        if (this.configurationFiles.includes(path)) {
            this.queuedBuilds.prepare = BuildState.Queued;
            this.queuedBuilds.code = BuildState.Queued;
            return await this.trigger();
        }

        const watchedCodePaths = await this.getWatchedCodePaths();
        if (watchedCodePaths.includes(path)) {
            this.queuedBuilds.code = BuildState.Queued;
            return await this.trigger();
        }

        if (path === this.context.paths.tsconfig) {
            this.queuedBuilds.typescript = BuildState.Queued;
            return await this.trigger();
        }

        const documenterFiles = await Promise.all(CUSTOM_DOCUMENTER_EXTS.map(ext => resolveUserFile(`${CUSTOM_DOCUMENTER_FILE}.${ext}`)));

        if (documenterFiles.includes(path)) {
            this.queuedBuilds.typescript = BuildState.Queued;
            return await this.trigger();
        }
    }

    private async trigger(): Promise<void> {
        this.lastRun?.cancel();

        await this.buildMutex.runExclusive(async () => {
            this.lastManualTrigger?.cancel();

            const {promise, resolve} = createResolvablePromise<void>();

            const handleGotInnerTask = async (innerTask: ThenResult<TaskContext, void>) => {
                this.lastRun = innerTask;
                await innerTask;
                this.setupManualTrigger();
                resolve();

                if (innerTask.wasCancelled === "exception") {
                    // assume all builds failed, set them back to the `Queued` state
                    if (this.queuedBuilds.prepare === BuildState.Building) this.queuedBuilds.prepare = BuildState.Queued;
                    if (this.queuedBuilds.code === BuildState.Building) this.queuedBuilds.code = BuildState.Queued;
                    if (this.queuedBuilds.typescript === BuildState.Building) this.queuedBuilds.typescript = BuildState.Queued;
                } else {
                    // any builds that were building and have not been queued again will be in the `Building` state
                    // so we will set them to `None`.
                    if (this.queuedBuilds.prepare === BuildState.Building) this.queuedBuilds.prepare = BuildState.None;
                    if (this.queuedBuilds.code === BuildState.Building) this.queuedBuilds.code = BuildState.None;
                    if (this.queuedBuilds.typescript === BuildState.Building) this.queuedBuilds.typescript = BuildState.None;
                }
            }

            this.then("Rebuild", async ctx => {
                try {
                    await run(ctx, async (_, then) => {
                        const innerThenResult = then("Rebuild", async (_, then) => {
                            if (this.queuedBuilds.prepare && this.queuedBuilds.code) {
                                this.queuedBuilds.prepare = BuildState.Building;
                                this.queuedBuilds.code = BuildState.Building;

                                // subsets of `code` build
                                this.queuedBuilds.typescript = BuildState.Building;

                                // rebuild everything
                                await prepare(then);
                                await bundle(then);
                            } else if (this.queuedBuilds.code) {
                                this.queuedBuilds.code = BuildState.Building;

                                // subsets of `code` build
                                this.queuedBuilds.typescript = BuildState.Building;

                                await bundle(then);
                            } else if (this.queuedBuilds.typescript) {
                                this.queuedBuilds.typescript = BuildState.Building;

                                await typescriptFeatures(then);
                            }
                        });

                        handleGotInnerTask(innerThenResult);
                    });
                } catch (err) {
                    logger.error(err);
                }
            });

            await promise;
        });
    }

    private async cleanup() {
        this.lastManualTrigger?.cancel();

        this.context.commonJsDevBuildResult?.rebuild.dispose();
        this.context.commonJsProdBuildResult?.rebuild.dispose();
        this.context.esmBuildResult?.rebuild.dispose();

        await this.watcher.close();
    }

    private getWatchedCodePaths() {
        return Promise.all([
            Watcher.getInputsFromMetafile(this.context.commonJsDevBuildResult?.metafile).map(key => resolveUserFile(key)),
            Watcher.getInputsFromMetafile(this.context.commonJsProdBuildResult?.metafile).map(key => resolveUserFile(key)),
            Watcher.getInputsFromMetafile(this.context.esmBuildResult?.metafile).map(key => resolveUserFile(key))
        ].map(list => Promise.all(list))).then(res => res.flat());
    }
}

export default async function watch(opts: WatchOpts) {
    logger.level = opts.verbose ? LogLevel.Verbose : LogLevel.Info;
    process.stdin.setRawMode(true);

    const context: TaskContext = {
        opts,
        watch: true,
        ...await getListrContext()
    };

    await run<TaskContext>(context, async (ctx, then) => {
        await then("Initial build", async (_, then) => {
            await prepare(then);
            await bundle(then);
        });

        await then("Watch for changes", async (ctx, then) => {
            const watcher = new Watcher(ctx, then);
            watcher.init();
            watcher.setupManualTrigger();
        });
    });
}
