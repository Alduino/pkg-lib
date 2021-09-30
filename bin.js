if (process.env.NODE_ENV === "production") {
    module.exports = require("./dist/bin.prod.min.js");
} else {
    module.exports = require("./dist/bin.dev.js");
}
