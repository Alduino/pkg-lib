import Config from "../Config";
import {BuildOpts} from "../commands/build";

export default interface ListrContext {
    opts: BuildOpts;
    jsx?: "react-jsx" | "createElement";
    config?: Config;
}
