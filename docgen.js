const {ApiModel} = require("@microsoft/api-extractor-model");
const apiModel = new ApiModel();

let context = JSON.parse(process.env.DOCGEN_CONTEXT);

function docHook(callback) {
    const sourcePath = process.env.DOCGEN_FILE_PATH;
    const fileName = process.env.DOCGEN_FILE_NAME;
    const outputDir = process.env.DOCGEN_OUTPUT_DIR;

    callback({
        fileName,
        outputDirectory: outputDir,
        source: apiModel.loadPackage(sourcePath)
    });
}

function defaultHook(callback) {
    callback();
}

module.exports = {
    hook(name, callback) {
        if (name !== process.env.DOCGEN_HOOK) return;

        switch(name) {
            case "doc": return docHook(callback);
            case "start": return defaultHook(callback);
            case "end": return defaultHook(callback);
            default: throw new Error(`Invalid hook, ${name}`);
        }
    },
    getContext() {
        return context;
    },
    setContext(value) {
        context = value;
        process.send(value);
    }
};
