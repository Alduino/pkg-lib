import logger from "consola";
import {AbortController, AbortSignal} from "node-abort-controller";

export interface TaskConfig<Context> {
    /**
     * If this is false (or a function that resolves to false), the task will not run,
     * and it will resolve with `undefined`.
     */
    enabled?: boolean | ((ctx: Context) => boolean | Promise<boolean>);

    /**
     * If this is set to `true`, an exception will not cause the whole tree to be aborted.
     * Otherwise, if an exception is thrown, everything will stop and the exception will
     * propagate to the original `run` call.
     */
    ignoreExceptions?: boolean;

    /**
     * Called after the task completes, even if it threw an exception
     * @param ctx The context of the task
     */
    cleanup?(ctx: Context): void | Promise<void>;
}

export interface ThenResult<Context, Result, IsFirst extends boolean = true>
    extends Promise<Result> {
    /**
     * If `cancel()` was called on this task or a parent task, this value will be `user`.
     * If an exception was thrown by this task or a parent task (and that task is not set to ignore exceptions), this
     * value will be `exception`.
     * Otherwise, it will be `false`.
     */
    readonly wasCancelled: false | "exception" | "user";

    /**
     * Runs another task in parallel with the previous one
     * @param name A label to give to the task
     * @param fn The task itself
     * @param config Configuration for this task
     * @returns A promise that resolves to an array of each task's output, in the order you run them in
     */
    and<T>(
        name: string,
        fn: TaskFunction<Context, T>,
        config?: TaskConfig<Context>
    ): ThenResult<
        Context,
        IsFirst extends true
            ? [Result, T]
            : Result extends unknown[]
            ? [...Result, T]
            : "ERROR",
        false
    >;

    /**
     * Asks this task and its sub-tasks to cancel themselves. Will work best if they use their AbortSignals properly.
     */
    cancel(): void;
}

export interface ThenFunction<Context> {
    /**
     * Runs a sub task and returns a promise that resolves when it completes
     * @param name A label to give to the task
     * @param fn The task function itself
     * @param config Configuration for this task
     */
    <T>(
        name: string,
        fn: TaskFunction<Context, T>,
        config?: TaskConfig<Context>
    ): ThenResult<Context, T>;
}

/**
 * The task function, which is called when you run `then` or `and`.
 * @param ctx The context from `run`
 * @param then A function to call sub-tasks. Use `then(...).and` to run multiple tasks in parallel.
 * @param abortSignal If some exception happens and the task tree is aborted, this signal will be triggered
 */
export type TaskFunction<Context, Result> = (
    ctx: Context,
    then: ThenFunction<Context>,
    abortSignal: AbortSignal
) => Promise<Result>;

interface RootTaskContext<UserContext> {
    kind: "root";
    context: UserContext;
    abortController: AbortController;
    abortError?: Error;
}

interface TaskContext<UserContext> {
    kind: "child";
    name: string;
    parent: TaskContext<UserContext> | RootTaskContext<UserContext>;

    /**
     * An abort controller that cancels this task and its children
     */
    abortController: AbortController;
}

interface TaskContextGroupAbortControllerCache {
    groupedAbortController: AbortController;
}

function hasGroupedAbortController(
    taskContext: TaskContext<unknown>
): taskContext is TaskContext<unknown> & TaskContextGroupAbortControllerCache {
    if (!taskContext) return false;
    return (
        (taskContext as unknown as TaskContextGroupAbortControllerCache)
            .groupedAbortController instanceof AbortController
    );
}

function getUserContext<UserContext>(
    taskContext: TaskContext<UserContext> | RootTaskContext<UserContext>
): UserContext {
    if (taskContext.kind === "root") return taskContext.context;
    return getUserContext(taskContext.parent);
}

function getFqtn(
    taskContext: TaskContext<unknown>,
    names: string[] = []
): string {
    if (taskContext.parent.kind === "child") getFqtn(taskContext.parent, names);
    names.push(taskContext.name);
    return names.filter(n => n.trim()).join(" / ");
}

async function isEnabled<Context>(
    context: Context,
    config?: TaskConfig<Context>
): Promise<boolean> {
    if (!config) return true;
    if (typeof config.enabled === "function") return config.enabled(context);
    return config.enabled !== false;
}

/**
 * Creates an AbortController that triggers when either this task or its parent's AbortControllers signal.
 * Caches the abort controller to prevent event listener leaks.
 * @param taskContext The task to create the abort controller from
 */
function getGroupedAbortSignal(taskContext: TaskContext<unknown>) {
    if (hasGroupedAbortController(taskContext))
        return taskContext.groupedAbortController.signal;

    const parentSignal = getAbortSignal(taskContext.parent);
    const thisSignal = taskContext.abortController.signal;

    const groupedController = new AbortController();
    (
        taskContext as unknown as TaskContextGroupAbortControllerCache
    ).groupedAbortController = groupedController;

    thisSignal.addEventListener("abort", () => groupedController.abort());
    parentSignal.addEventListener("abort", () => groupedController.abort());

    if (thisSignal.aborted) groupedController.abort();
    if (parentSignal.aborted) groupedController.abort();

    return groupedController.signal;
}

function getAbortSignal<UserContext>(
    taskContext: TaskContext<UserContext> | RootTaskContext<UserContext>
): AbortSignal {
    if (taskContext.kind === "root") return taskContext.abortController.signal;
    return getGroupedAbortSignal(taskContext);
}

/**
 * Returns only the abort signal of the root task context, which is only triggered on an exception.
 * @param taskContext The task context to get the abort controller from
 */
function getRootAbortSignal(
    taskContext: TaskContext<unknown> | RootTaskContext<unknown>
): AbortSignal {
    if (taskContext.kind === "root") return taskContext.abortController.signal;
    return getRootAbortSignal(taskContext.parent);
}

function abort<UserContext>(
    taskContext: TaskContext<UserContext> | RootTaskContext<UserContext>,
    cause: string,
    causeErr?: Error
): void {
    if (taskContext.kind !== "root")
        return abort(taskContext.parent, cause, causeErr);
    logger.warn("Aborting task tree, as %s", cause);
    taskContext.abortController.abort();
    if (causeErr) taskContext.abortError = causeErr;
}

type PromisifyTuple<Tuple extends unknown[]> = {
    [Key in keyof Tuple]: Promise<Tuple[Key]>;
};

async function taskWrapper<UserContext, Result>(
    logDetail: string | null,
    task: TaskFunction<UserContext, Result>,
    taskContext: TaskContext<UserContext>,
    userContext: UserContext,
    thenFunction: ThenFunction<UserContext>,
    config?: TaskConfig<UserContext>
): Promise<Result> {
    const abortSignal = getAbortSignal(taskContext);

    const loggingEnabled = !!taskContext.name.trim();
    const fqtn = loggingEnabled ? getFqtn(taskContext) : "an unnamed task";

    if (abortSignal.aborted) {
        // Return without logging as the entire tree has been aborted (logging would be too verbose)
        if (taskContext.abortController.signal.aborted) {
            // if it was actually this specific task that was aborted we can log it
            logger.warn("Task `%s` was cancelled", fqtn);
        }

        return;
    }

    const enabled = await isEnabled(userContext, config);

    if (!enabled) {
        if (loggingEnabled)
            logger.debug("Skipping `%s` as it is disabled", fqtn);
        return;
    }

    if (loggingEnabled)
        logger.info("Running `%s`%s", fqtn, logDetail ? ` ${logDetail}` : "");

    try {
        return await task(userContext, thenFunction, abortSignal);
    } catch (err) {
        if (!config?.ignoreExceptions) {
            abort(
                taskContext,
                `an exception occurred in \`${fqtn}\`, and the task was not set to ignore exceptions`,
                err
            );
        } else {
            logger.warn(
                "An exception was thrown, but `%s` has `ignoreExceptions` set to `true`.",
                fqtn
            );
        }
    } finally {
        if (config?.cleanup) {
            if (loggingEnabled)
                logger.trace("Running cleanup function for `%s`", fqtn);

            try {
                await config.cleanup(userContext);
            } catch (err) {
                abort(
                    taskContext,
                    `an exception occurred in the cleanup function of \`${fqtn}\``,
                    err
                );
            }
        }
    }
}

function createThenResult<
    UserContext,
    Result extends unknown[],
    PickFirst extends boolean
>(
    context: TaskContext<UserContext> | RootTaskContext<UserContext>,
    promises: PromisifyTuple<Result>,
    pickFirst: PickFirst
): ThenResult<
    UserContext,
    PickFirst extends true
        ? Result extends [infer First, ...unknown[]]
            ? First
            : "ERROR"
        : Result,
    false
> {
    const userContext = getUserContext(context);

    const andFunction: ThenResult<UserContext, Result, false>["and"] = <T>(
        name: string,
        fn: TaskFunction<UserContext, T>,
        config?: TaskConfig<UserContext>
    ) => {
        const subContext: TaskContext<UserContext> = {
            kind: "child",
            name,
            parent: context,
            abortController: new AbortController()
        };

        const thenFunction = createThenFunction(subContext);
        const promise = taskWrapper(
            "in parallel with the previous task",
            fn,
            subContext,
            userContext,
            thenFunction,
            config
        );
        return createThenResult<UserContext, [...Result, T], false>(
            context,
            [...promises, promise],
            false
        ) as never;
    };

    const cancelFunction: ThenResult<UserContext, Result, false>["cancel"] =
        () => {
            context.abortController.abort();
        };

    const resultPromise = (
        pickFirst ? promises[0] : Promise.all(promises)
    ) as ThenResult<UserContext, Result, false>;
    resultPromise.and = andFunction;
    resultPromise.cancel = cancelFunction;

    Object.defineProperty(resultPromise, "wasCancelled", {
        get() {
            if (getRootAbortSignal(context).aborted) return "exception";
            if (getAbortSignal(context).aborted) return "user";
            return false;
        }
    });

    return resultPromise as never;
}

function createThenFunction<UserContext>(
    context?: TaskContext<UserContext> | RootTaskContext<UserContext>
): ThenFunction<UserContext> {
    const userContext = getUserContext(context);

    return <T>(
        name: string,
        fn: TaskFunction<UserContext, T>,
        config?: TaskConfig<UserContext>
    ): ThenResult<UserContext, T, true> => {
        const subContext: TaskContext<UserContext> = {
            kind: "child",
            name,
            parent: context,
            abortController: new AbortController()
        };

        const thenFunction = createThenFunction(subContext);
        const promise = taskWrapper(
            null,
            fn,
            subContext,
            userContext,
            thenFunction,
            config
        );
        return createThenResult<UserContext, [T], true>(
            context,
            [promise],
            true
        );
    };
}

/**
 * Returns a function that provides implicit typings for task functions
 */
export function createTaskTypingsHelper<Context>() {
    return <Result>(
        fn: TaskFunction<Context, Result>
    ): TaskFunction<Context, Result> => fn;
}

export interface CreateStaticTaskResult<Context, Result> {
    /**
     * For use with the `and` function, spread this value as its parameters (it passes the name and the `TaskFunction`)
     */
    and: [
        string,
        TaskFunction<Context, Result>,
        TaskConfig<Context> | undefined
    ];

    /**
     * Runs the task with the context from the `then`.
     */
    (then: ThenFunction<Context>): ThenResult<Context, Result, true>;
}

/**
 * Returns a function that creates a static task, with a set name.
 * To run the task, call it with the `then` function from the task you are in.
 */
export function createStaticTaskCurry<Context>() {
    return <Result>(
        name: string,
        fn: TaskFunction<Context, Result>,
        config?: TaskConfig<Context>
    ): CreateStaticTaskResult<Context, Result> => {
        const res = ((then: ThenFunction<Context>) => {
            return then(name, fn, config);
        }) as CreateStaticTaskResult<Context, Result>;

        res.and = [name, fn, config];
        return res;
    };
}

export default async function run<Context>(
    ctx: Context,
    fn: TaskFunction<Context, void>
): Promise<void> {
    const taskContext: RootTaskContext<Context> = {
        kind: "root",
        context: ctx,
        abortController: new AbortController()
    };

    const thenFn = createThenFunction(taskContext);

    const result = await thenFn("", fn);

    if (taskContext.abortController.signal.aborted) {
        throw taskContext.abortError ?? new Error("The task tree was aborted");
    }

    return result;
}
