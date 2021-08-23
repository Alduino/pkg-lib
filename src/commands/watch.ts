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

export interface WatchOpts extends BuildOpts {}

class Watcher {
    constructor(private readonly context: TaskContext, private readonly then: ThenFunction<TaskContext>) {}

    private lastFilesToWatch: string[] = this.context.filesToWatch;
    private configWatcher = chokidar([this.context.paths.config, this.context.paths.packageJson]);
    private codeWatcher = chokidar(this.context.filesToWatch);
    private docsWatcher = this.context.customDocumenter && chokidar(this.context.customDocumenter);

    init() {
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
    }

    async triggerAll(): Promise<void> {
        await prepare(this.then);
        await bundle(this.then);
        this.setupManualTrigger();
    }

    updateWatcher() {
        const additions = this.context.filesToWatch.filter(it => !this.lastFilesToWatch.includes(it));
        const removals = this.lastFilesToWatch.filter(it => !this.context.filesToWatch.includes(it));

        this.codeWatcher.add(additions);
        this.codeWatcher.unwatch(removals);
    }

    async cleanup() {
        await this.codeWatcher.close();
    }

    private setupManualTrigger() {
        prompt<string>({
            type: "select",
            name: "what-to-do",
            message: "What do you want to do?",
            choices: ["Manual Trigger", "Exit"]
        }).then(answer => {
            if (answer === "Manual Trigger") {
                return this.triggerAll();
            } else if (answer === "Exit") {
                return this.cleanup();
            }
        });
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
        });
    });
}
