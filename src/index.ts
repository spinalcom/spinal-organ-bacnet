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

require("json5/lib/register");

import { FileSystem, spinalCore } from "spinal-core-connectorjs_type";
import { SpinalOrganConfigModel } from "spinal-model-bacnet";
import { CreateOrganConfigFile, bindAndRestartOrgan } from './utilities/Functions';

import ConfigFile from "spinal-lib-organ-monitoring";
const pm2 = require("pm2");
const config = require("../config.js");

const { protocol, host, port, userId, password, path, name } = config.spinalConnector;
const url = `${protocol}://${userId}:${password}@${host}:${port}/`;
const connect = spinalCore.connect(url);


// Cette fonction est executée en cas de deconnexion au hub
FileSystem.onConnectionError = (error_code: number) => {
   setTimeout(() => {
      console.log('disconned from hub, exit with process');
      process.exit(error_code); // kill le process;
   }, 5000);
}


CreateOrganConfigFile(connect, path, name)
   .then(async (organModel: SpinalOrganConfigModel) => {
      await ConfigFile.init(connect, name, host, protocol, port); // API health
      bindAndRestartOrgan(connect, name, organModel);
   }).catch((err) => process.exit(0))




