import {watch as chokidar} from "chokidar";
import {BuildOpts} from "./build";
import TaskContext from "../tasks/TaskContext";
import logger, {LogLevel} from "consola";
import getListrContext from "../utils/getListrContext";
import run, {ThenFunction} from "../utils/tasks";
import prepare from "../tasks/prepare";
import bundle from "../tasks/bundle";
import {documentation} from "../tasks/typescript";
import {Metafile} from "esbuild";

export interface WatchOpts extends BuildOpts {
}

interface ManualTriggerResult {
    cancel(): void;
}

class Watcher {
    private lastManualTrigger?: ManualTriggerResult;
    private lastFilesToWatch = this.getFilesToWatch();
    private lastCustomDocs = this.context.customDocumenter;

    private configWatcher = chokidar([this.context.paths.config, this.context.paths.packageJson]);
    private codeWatcher = chokidar(this.getFilesToWatch());
    private docsWatcher = chokidar([]);

    constructor(private readonly context: TaskContext, private readonly then: ThenFunction<TaskContext>) {
    }

    private static getInputsFromMetafile(metafile: Metafile) {
        if (!metafile) return [];
        return Object.keys(metafile.inputs);
    }

    init() {
        logger.debug("Watching %s files", this.lastFilesToWatch.length);

        this.configWatcher.on("change", () => this.triggerAll());

        this.codeWatcher.on("change", () => this.triggerCode());

        this.docsWatcher?.on("add", () => this.triggerDocs());
        this.docsWatcher?.on("change", () => this.triggerDocs());
        this.docsWatcher?.on("unlink", () => this.triggerDocs());
    }

    async triggerCode(): Promise<void> {
        this.lastManualTrigger?.cancel();
        await bundle(this.then);
        this.setupManualTrigger();
    }

    async triggerDocs(): Promise<void> {
        this.lastManualTrigger?.cancel();
        await documentation(this.then);
        this.setupManualTrigger();
    }

    async triggerAll(): Promise<void> {
        this.lastManualTrigger?.cancel();
        await prepare(this.then);
        await bundle(this.then);
        this.updateDocsWatcher();
        this.setupManualTrigger();
    }

    updateCodeWatcher() {
        const filesToWatch = this.getFilesToWatch();
        const additions = filesToWatch.filter(it => !this.lastFilesToWatch.includes(it));
        const removals = this.lastFilesToWatch.filter(it => !filesToWatch.includes(it));

        this.codeWatcher.add(additions);
        this.codeWatcher.unwatch(removals);
    }

    async cleanup() {
        this.lastManualTrigger?.cancel();

        this.context.commonJsDevBuildResult?.rebuild.dispose();
        this.context.commonJsProdBuildResult?.rebuild.dispose();
        this.context.esmBuildResult?.rebuild.dispose();

        await Promise.all([
            this.configWatcher.close(),
            this.codeWatcher.close(),
            this.docsWatcher?.close()
        ]);
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
                    this.triggerAll();
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

    private updateDocsWatcher() {
        if (this.lastCustomDocs === this.context.customDocumenter) return;
        if (this.lastCustomDocs) this.docsWatcher.unwatch(this.lastCustomDocs);
        if (this.context.customDocumenter) this.docsWatcher.add(this.context.customDocumenter);
    }

    private getFilesToWatch() {
        return [
            ...Watcher.getInputsFromMetafile(this.context.commonJsDevBuildResult?.metafile),
            ...Watcher.getInputsFromMetafile(this.context.commonJsProdBuildResult?.metafile),
            ...Watcher.getInputsFromMetafile(this.context.esmBuildResult?.metafile)
        ];
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
            watcher.updateCodeWatcher();
            watcher.setupManualTrigger();
        });
    });
}
