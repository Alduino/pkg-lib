import readConfig from "../utils/readConfig";
import {createStaticTask} from "./utils";

export default createStaticTask("Prepare", async (_, then) => {
    await then("Read configuration", async ctx => {
        ctx.config = await readConfig();
    });
});
