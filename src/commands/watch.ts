import {prompt} from "enquirer";
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

class Watcher {
    private lastFilesToWatch: string[] = this.getFilesToWatch();
    private configWatcher = chokidar([this.context.paths.config, this.context.paths.packageJson]);
    private codeWatcher = chokidar(this.getFilesToWatch());
    private docsWatcher = this.context.customDocumenter && chokidar(this.context.customDocumenter);

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
        this.docsWatcher?.on("change", () => this.triggerDocs());
    }

    async triggerCode(): Promise<void> {
        await bundle(this.then);
        this.setupManualTrigger();
    }

    async triggerDocs(): Promise<void> {
        await documentation(this.then);
        this.setupManualTrigger();
    }

    async triggerAll(): Promise<void> {
        await prepare(this.then);
        await bundle(this.then);
        this.setupManualTrigger();
    }

    updateWatcher() {
        const filesToWatch = this.getFilesToWatch();
        const additions = filesToWatch.filter(it => !this.lastFilesToWatch.includes(it));
        const removals = this.lastFilesToWatch.filter(it => !filesToWatch.includes(it));

        this.codeWatcher.add(additions);
        this.codeWatcher.unwatch(removals);
    }

    async cleanup() {
        await Promise.all([
            this.configWatcher.close(),
            this.codeWatcher.close(),
            this.docsWatcher?.close(),
            this.context.commonJsDevBuildResult?.rebuild.dispose(),
            this.context.commonJsProdBuildResult?.rebuild.dispose(),
            this.context.esmBuildResult?.rebuild.dispose()
        ]);
    }

    setupManualTrigger() {
        return prompt<{action: string}>({
            type: "select",
            name: "action",
            message: "What do you want to do?",
            choices: ["Manual Trigger", "Exit"]
        }).then(({action}) => {
            if (action === "Manual Trigger") {
                return this.triggerAll();
            } else if (action === "Exit") {
                return this.cleanup();
            }
        });
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
            watcher.updateWatcher();
            await watcher.setupManualTrigger();
        });
    });
}
