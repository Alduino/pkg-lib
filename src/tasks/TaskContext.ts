import Config from "../Config";
import {BuildOpts} from "../commands/build";

export default interface TaskContext {
    opts: BuildOpts;
    paths?: {
        config: string;
        packageJson: string;
        tsconfig: string;
    };
    jsx?: "react-jsx" | "createElement";
    config?: Config;
    watch?: boolean;
    tsDeclTempEntry?: string;
    tsDeclTempOut?: string;
    tsDocsTempJson?: string;
    customDocGenTempCleanup?: () => Promise<void>;
    customDocumenter?: string;
    filesToWatch?: string[];
}
