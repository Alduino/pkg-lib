import {Listr} from "listr2";
import StandardOpts from "./StandardOpts";
import ListrContext from "../tasks/ListrContext";
import prepareTasks from "../tasks/prepare";
import bundleTasks from "../tasks/bundle";
import getListrContext from "../utils/getListrContext";

export interface BuildOpts extends StandardOpts {
}

export default async function build(opts: BuildOpts) {
    const tasks = new Listr<ListrContext, "default" | "verbose">([
        prepareTasks,
        bundleTasks
    ], {
        renderer: opts.verbose ? "verbose" : "default"
    });

    await tasks.run({opts, ...await getListrContext()});
}
