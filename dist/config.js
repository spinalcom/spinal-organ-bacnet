"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv").config();
const config = {
    spinalConnector: {
        name: process.env.ORGAN_NAME || "EDIT_ME",
        userId: process.env.USER_ID || "EDIT_ME",
        password: process.env.PASSWORD || "EDIT_ME",
        protocol: process.env.PROTOCOL || "EDIT_ME",
        host: process.env.HOST || "EDIT_ME",
        port: process.env.PORT || "EDIT_ME",
        path: process.env.ORGAN_FOLDER_PATH || "EDIT_ME",
    },
};
exports.config = config;
exports.default = config;
//# sourceMappingURL=config.js.map