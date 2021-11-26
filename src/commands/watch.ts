import EventEmitter from "events";
import {mkdir, rm} from "fs/promises";
import {Mutex} from "async-mutex";
import {watch as chokidar} from "chokidar";
import logger, {LogLevel} from "consola";
import {Metafile} from "esbuild";
import TaskContext from "../tasks/TaskContext";
import bundle from "../tasks/bundle";
import prepare from "../tasks/prepare";
import typescriptFeatures, {
    CUSTOM_DOCUMENTER_EXTS,
    CUSTOM_DOCUMENTER_FILE
} from "../tasks/typescript";
import createResolvablePromise from "../utils/createResolvablePromise";
import getListrContext from "../utils/getListrContext";
import resolveUserFile from "../utils/resolveUserFile";
import run, {ThenFunction, ThenResult} from "../utils/tasks";
import {BuildOpts} from "./build";

export type WatchOpts = BuildOpts;

const enum BuildState {
    None,
    Queued,
    Building
}

// Note: first letter must be unique
interface QueuedBuilds extends Record<string, BuildState> {
    prepare?: BuildState;
    code?: BuildState;
    typescript?: BuildState;
}

class Watcher extends EventEmitter {
    private lastRun?: ThenResult<TaskContext, void>;
    private queuedBuilds: QueuedBuilds = {};
    private completePromise: Promise<void>;
    private resolveCompletePromise: () => void;
    private readonly watcher = chokidar(this.context.paths.userDir, {
        ignored: /[/\\]node_modules[/\\]|[/\\]\.git[/\\]/,
        ignoreInitial: true
    });
    private readonly buildMutex = new Mutex();

    constructor(
        private readonly context: TaskContext,
        private readonly then: ThenFunction<TaskContext>
    ) {
        super();
        const {promise, resolve} = createResolvablePromise<void>();
        this.completePromise = promise;
        this.resolveCompletePromise = resolve;
    }

    /**
     * Resolves when the watcher has been cleaned up
     */
    get complete() {
        return this.completePromise;
    }

    private get configurationFiles() {
        return [this.context.paths.config, this.context.paths.packageJson];
    }

    private static getInputsFromMetafile(metafile: Metafile) {
        if (!metafile) return [];
        return Object.keys(metafile.inputs);
    }

    /**
     * Converts the state to a string. `Queued` states are signified by the
     * first letter of the state name, in lower case. Any other states are
     * ignored.
     */
    private static makeQueuedBuildsString(builds: QueuedBuilds) {
        return Object.entries<BuildState>(builds)
            .filter(([, state]) => state === BuildState.Queued)
            .map(([name]) => name[0].toLowerCase())
            .join("");
    }

    init() {
        this.watcher.on("change", path => this.handleUpdate(path));
        this.watcher.on("add", path => this.handleUpdate(path));
        this.watcher.on("unlink", path => this.handleUpdate(path));
    }

    initialiseInteraction() {
        let isRunning = false;

        const queuedBuilds = this.queuedBuilds;

        function handleBuildStart() {
            isRunning = true;

            if (!process.stdin.isTTY) {
                const newBuildState = Watcher.makeQueuedBuildsString(
                    queuedBuilds
                );

                process.stdout.write(
                    `@pl[w:b:${newBuildState}] Beginning new watch mode build.\n`
                );
            }
        }

        function handleBuildComplete() {
            isRunning = false;

            if (process.stdin.isTTY) {
                logger.info("Press `r` to build again, or `q` to quit.");
            } else {
                const newBuildState = Watcher.makeQueuedBuildsString(
                    queuedBuilds
                );

                process.stdout.write(
                    `@pl[w:c:${newBuildState}] Watch mode build complete. Type r+enter to build again, or q+enter to quit.\n`
                );
            }
        }

        const handleData = (chunk: Buffer) => {
            if (isRunning) return;

            const action = String.fromCharCode(chunk[0]);

            switch (action) {
                case "r":
                    queuedBuilds.prepare = BuildState.Queued;
                    queuedBuilds.code = BuildState.Queued;
                    this.trigger();
                    break;
                case "q":
                case "\x03" /* ctrl z */
                :
                    this.cleanup();
                    console.log("Goodbye!");
                    break;
            }
        };

        function handleCleanup() {
            logger.debug("Removing event listeners");
            process.stdin.off("data", handleData);
            this.off("build:start", handleBuildStart);
            this.off("build:complete", handleBuildComplete);
            this.off("cleanup", handleCleanup);
            process.stdin.pause();
        }

        process.stdin.on("data", handleData);
        this.on("build:start", handleBuildStart);
        this.on("build:complete", handleBuildComplete);
        this.on("cleanup", handleCleanup);

        handleBuildComplete();
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

        const documenterFiles = await Promise.all(
            CUSTOM_DOCUMENTER_EXTS.map(ext =>
                resolveUserFile(`${CUSTOM_DOCUMENTER_FILE}.${ext}`)
            )
        );

        if (documenterFiles.includes(path)) {
            this.queuedBuilds.typescript = BuildState.Queued;
            return await this.trigger();
        }
    }

    private async trigger(): Promise<void> {
        this.lastRun?.cancel();

        this.emit("build:start");

        await this.buildMutex.runExclusive(async () => {
            const {promise, resolve} = createResolvablePromise<void>();

            const handleGotInnerTask = async (
                innerTask: ThenResult<TaskContext, void>
            ) => {
                this.lastRun = innerTask;
                await innerTask;

                if (innerTask.wasCancelled === "exception") {
                    // assume all builds failed, set them back to the `Queued` state
                    if (this.queuedBuilds.prepare === BuildState.Building)
                        this.queuedBuilds.prepare = BuildState.Queued;
                    if (this.queuedBuilds.code === BuildState.Building)
                        this.queuedBuilds.code = BuildState.Queued;
                    if (this.queuedBuilds.typescript === BuildState.Building)
                        this.queuedBuilds.typescript = BuildState.Queued;
                } else {
                    // any builds that were building and have not been queued again will be in the `Building` state
                    // so we will set them to `None`.
                    if (this.queuedBuilds.prepare === BuildState.Building)
                        this.queuedBuilds.prepare = BuildState.None;
                    if (this.queuedBuilds.code === BuildState.Building)
                        this.queuedBuilds.code = BuildState.None;
                    if (this.queuedBuilds.typescript === BuildState.Building)
                        this.queuedBuilds.typescript = BuildState.None;
                }

                resolve();
            };

            this.then("Rebuild", async ctx => {
                try {
                    await run(ctx, async (_, then) => {
                        const innerThenResult = then(
                            "Rebuild",
                            async (_, then) => {
                                if (
                                    this.queuedBuilds.prepare &&
                                    this.queuedBuilds.code
                                ) {
                                    this.queuedBuilds.prepare =
                                        BuildState.Building;
                                    this.queuedBuilds.code =
                                        BuildState.Building;

                                    // subsets of `code` build
                                    this.queuedBuilds.typescript =
                                        BuildState.Building;

                                    // rebuild everything
                                    await prepare(then);
                                    await bundle(then);
                                } else if (this.queuedBuilds.code) {
                                    this.queuedBuilds.code =
                                        BuildState.Building;

                                    // subsets of `code` build
                                    this.queuedBuilds.typescript =
                                        BuildState.Building;

                                    await bundle(then);
                                } else if (this.queuedBuilds.typescript) {
                                    this.queuedBuilds.typescript =
                                        BuildState.Building;

                                    await typescriptFeatures(then);
                                }
                            }
                        );

                        handleGotInnerTask(innerThenResult);
                    });
                } catch (err) {
                    logger.error(err);
                }
            });

            await promise;
        });

        this.emit("build:complete");
    }

    private async cleanup() {
        this.emit("cleanup");

        this.context.commonJsDevBuildResult?.rebuild.dispose();
        this.context.commonJsProdBuildResult?.rebuild.dispose();
        this.context.esmBuildResult?.rebuild.dispose();

        await this.watcher.close();

        this.resolveCompletePromise();
    }

    private getWatchedCodePaths() {
        return Promise.all(
            [
                Watcher.getInputsFromMetafile(
                    this.context.commonJsDevBuildResult?.metafile
                ).map(key => resolveUserFile(key)),
                Watcher.getInputsFromMetafile(
                    this.context.commonJsProdBuildResult?.metafile
                ).map(key => resolveUserFile(key)),
                Watcher.getInputsFromMetafile(
                    this.context.esmBuildResult?.metafile
                ).map(key => resolveUserFile(key))
            ].map(list => Promise.all(list))
        ).then(res => res.flat());
    }
}

export default async function watch(opts: WatchOpts): Promise<void> {
    logger.level = opts.verbose ? LogLevel.Verbose : LogLevel.Info;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    const context: TaskContext = {
        watch: true,
        ...(await getListrContext(opts))
    };

    await mkdir(context.cacheDir, {recursive: true});

    try {
        await run<TaskContext>(context, async (ctx, then) => {
            await then(
                "",
                async (_, then) => {
                    await then("Initial build", async (_, then) => {
                        await prepare(then);
                        await bundle(then);
                    });

                    await then("Watch for changes", async (ctx, then) => {
                        const watcher = new Watcher(ctx, then);
                        watcher.init();
                        watcher.initialiseInteraction();
                        await watcher.complete;
                    });
                },
                {
                    async cleanup(ctx) {
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
