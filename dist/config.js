"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
require("dotenv").config();
function getConfig() {
    checkAndThrowIfMissing(process.env.ORGAN_NAME, "ORGAN_NAME");
    checkAndThrowIfMissing(process.env.USER_ID, "USER_ID");
    checkAndThrowIfMissing(process.env.PASSWORD, "PASSWORD");
    checkAndThrowIfMissing(process.env.PROTOCOL, "PROTOCOL");
    checkAndThrowIfMissing(process.env.HOST, "HOST");
    checkAndThrowIfMissing(process.env.PORT, "PORT");
    checkAndThrowIfMissing(process.env.ORGAN_FOLDER_PATH, "ORGAN_FOLDER_PATH");
    return {
        spinalConnector: {
            name: process.env.ORGAN_NAME,
            userId: process.env.USER_ID,
            password: process.env.PASSWORD,
            protocol: process.env.PROTOCOL,
            host: process.env.HOST,
            port: process.env.PORT,
            path: process.env.ORGAN_FOLDER_PATH,
        },
    };
}
function checkAndThrowIfMissing(envVar, varName) {
    if (!envVar) {
        throw new Error(`Environment variable ${varName} is missing`);
    }
}
exports.default = getConfig;
//# sourceMappingURL=config.js.map