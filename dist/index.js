"use strict";
/*
 * Copyright 2022 SpinalCom - www.spinalcom.com
 *
 * This file is part of SpinalCore.
 *
 * Please read all of the following terms and conditions
 * of the Free Software license Agreement ("Agreement")
 * carefully.
 *
 * This Agreement is a legally binding contract between
 * the Licensee (as defined below) and SpinalCom that
 * sets forth the terms and conditions that govern your
 * use of the Program. By installing and/or using the
 * Program, you agree to abide by all the terms and
 * conditions stated or referenced herein.
 *
 * If you do not agree to abide by these terms and
 * conditions, do not demonstrate your acceptance and do
 * not install or use the Program.
 * You should have received a copy of the license along
 * with this file. If not, see
 * <http://resources.spinalcom.com/licenses.pdf>.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("json5/lib/register");
const spinal_core_connectorjs_type_1 = require("spinal-core-connectorjs_type");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const spinal_connector_service_1 = require("spinal-connector-service");
const Functions_1 = require("./utilities/Functions");
const spinal_lib_organ_monitoring_1 = require("spinal-lib-organ-monitoring");
const nodePath = require("path");
const pm2 = require("pm2");
const config = require("../config.js");
const { protocol, host, port, userId, password, path, name } = config.spinalConnector;
const url = `${protocol}://${userId}:${password}@${host}:${port}/`;
const connect = spinal_core_connectorjs_type_1.spinalCore.connect(url);
const organInfo = {
    name,
    type: spinal_model_bacnet_1.BACNET_ORGAN_TYPE,
    path: nodePath.normalize(`${path}/${name}`),
    model: new spinal_model_bacnet_1.SpinalOrganConfigModel(name, spinal_model_bacnet_1.BACNET_ORGAN_TYPE)
};
const spinalConnectorService = spinal_connector_service_1.SpinalConnectorService.getInstance();
spinalConnectorService.initialize(connect, organInfo).then((_a) => __awaiter(void 0, [_a], void 0, function* ({ alreadyExists, node }) {
    yield node.initializeModelsList(); // initialize the list of models in the organ
    yield spinal_lib_organ_monitoring_1.default.init(connect, name, host, protocol, port); // API health
    const pm2_instance = yield (0, Functions_1.GetPm2Instance)(name);
    const pm2_id = pm2_instance ? pm2_instance.pm_id : null;
    if (pm2_id)
        node.restart.bind(() => (0, Functions_1.restartProcessById)(pm2_id));
    const message = alreadyExists ? "organ found !" : "organ not found, creating new organ !";
    console.log(message);
    (0, Functions_1.bindAllModels)(node);
})).catch((err) => {
    console.error("Error", err);
});
//# sourceMappingURL=index.js.map