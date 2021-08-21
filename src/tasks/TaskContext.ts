import Config from "../Config";
import {BuildOpts} from "../commands/build";

export default interface TaskContext {
    opts: BuildOpts;
    jsx?: "react-jsx" | "createElement";
    config?: Config;
    watch?: boolean;
    tsDeclTempEntry?: string;
    tsDeclTempOut?: string;
    tsDocsTempJson?: string;
}
