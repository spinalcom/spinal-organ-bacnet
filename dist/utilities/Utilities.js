"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadFile = exports.saveAsFile = exports.waitModelReady = void 0;
const spinal_core_connectorjs_type_1 = require("spinal-core-connectorjs_type");
const fs_1 = require("fs");
// import { Transform } from "stream";
// import { inherits } from "util";
const Q = require('q');
const waitModelReady = (spinalContext) => {
    const deferred = Q.defer();
    const waitModelReadyLoop = (f, defer) => {
        if (spinal_core_connectorjs_type_1.FileSystem._sig_server === false) {
            setTimeout(() => {
                defer.resolve(waitModelReadyLoop(f, defer));
            }, 100);
        }
        else {
            defer.resolve(f);
        }
        return defer.promise;
    };
    return waitModelReadyLoop(spinalContext, deferred);
};
exports.waitModelReady = waitModelReady;
const saveAsFile = (obj) => {
    const data = obj.convertToString();
    const folder = `${process.cwd()}/db`;
    const fileName = `${obj.node.id.get()}.db`;
    if (!fs_1.existsSync(folder)) {
        fs_1.mkdirSync(folder);
    }
    return new Promise((resolve, reject) => {
        fs_1.writeFile(`${folder}/${fileName}`, data, (err) => {
            if (err) {
                console.error(err);
                reject(err);
                return;
            }
            resolve(true);
        });
    });
};
exports.saveAsFile = saveAsFile;
const loadFile = (id) => {
    return new Promise((resolve, reject) => {
        const path = `${process.cwd()}/db/${id}.db`;
        if (!fs_1.existsSync(path)) {
            reject("file not exist");
            return;
        }
        ;
        const data = [];
        const readStream = fs_1.createReadStream(path, { highWaterMark: 16 });
        readStream.on('data', function (chunk) {
            data.push(chunk);
        });
        readStream.on('end', () => {
            const x = Buffer.concat(data).toString();
            resolve(JSON.parse(x));
        });
        readStream.on('error', (err) => {
            reject(err);
        });
    });
};
exports.loadFile = loadFile;
//# sourceMappingURL=Utilities.js.map