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
import { BACNET_ORGAN_TYPE, SpinalOrganConfigModel } from "spinal-model-bacnet";
import { SpinalConnectorService } from "spinal-connector-service";
import { GetPm2Instance, bindAllModels, restartProcessById } from "./utilities/Functions";

import ConfigFile from "spinal-lib-organ-monitoring";
import * as nodePath from "path";
import BacnetUtilities from "./utilities/BacnetUtilities";
import { launchBacnetService } from "spinal-bacnet-service";
import { clearOrgan } from "./utilities/clearOrgan";

const config = require("../config.js");

const { protocol, host, port, userId, password, path, name } = config.spinalConnector;
const url = `${protocol}://${userId}:${password}@${host}:${port}/`;
const connect = spinalCore.connect(url);

const organInfo = {
	name,
	type: BACNET_ORGAN_TYPE,
	path: nodePath.normalize(`${path}/${name}`),
	model: new SpinalOrganConfigModel(name, BACNET_ORGAN_TYPE),
};

const spinalConnectorService = SpinalConnectorService.getInstance();

spinalConnectorService
	.initialize(connect, organInfo)
	.then(async ({ alreadyExists, node: organModel }) => {
		await organModel.initializeModelsList(); // initialize the list of models in the organ

		if (alreadyExists) {
			const { valid, message } = await organModel.checkOrganDataValidity();
			if (!valid) {
				const clear = process.env.CLEAR_ORGAN_IF_NOT_COMPATIBLE == "1" || process.env.CLEAR_ORGAN_IF_NOT_COMPATIBLE == "true";

				// if the organ is not compatible and the clear flag is not set, throw an error
				if (!clear) throw new Error(message);

				await clearOrgan(organModel as SpinalOrganConfigModel);
			}
		}

		await launchBacnetService(); // launch the bacnet service

		await BacnetUtilities.initAndConnect(); // initialize and connect to the bacnet server
		await ConfigFile.init(connect, name, host, protocol, port); // API health

		const pm2_instance = await GetPm2Instance(name);
		const pm2_id = pm2_instance ? (pm2_instance as any).pm_id : null;

		// if it is running by pm2, bind the restart function to restart the process
		if (pm2_id) {
			organModel.restart.bind(() => {
				if (!organModel.restart?.get()) return;
				restartProcessById(pm2_id);
			});
		}

		const message = alreadyExists ? "organ found !" : "organ not found, creating new organ !";
		console.log(message);

		bindAllModels(organModel as SpinalOrganConfigModel);
	})
	.catch((err) => {
		console.error("Error", err);
	});
