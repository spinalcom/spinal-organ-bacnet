const fs = require("fs");
const dotenv = require("dotenv");


module.exports.getAllEnvPath = function () {
    const envFiles = fs.readdirSync(__dirname).filter(file => file.endsWith(".env"));
    return envFiles.map(file => `${__dirname}/${file}`);
}


module.exports.getProcessName = function (envPath) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath, "utf-8"));
    const match = envConfig["ORGAN_NAME"];
    return match ? match : null;
}