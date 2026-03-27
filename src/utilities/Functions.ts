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

import { SpinalNode } from "spinal-env-viewer-graph-service";
import { addToGetAllBacnetValuesQueue } from "../modules/SpinalDevice";
import { SpinalDiscoverModel, SpinalListenerModel, SpinalOrganConfigModel, SpinalBacnetValueModel, SpinalPilotModel, BACNET_VALUES_STATE } from "spinal-model-bacnet";
import { STATES } from "spinal-connector-service";

import { SpinalNetworkUtilities } from "./SpinalNetworkUtilities";
import { spinalDiscover } from "../modules/SpinalDiscover";
import { spinalMonitoring } from "../modules/SpinalMonitoring";
import { spinalPilot } from "../modules/SpinalPilot";


import * as pm2 from "pm2";

const Q = require('q');

export function bindAllModels(organModel: SpinalOrganConfigModel) {

   const listenerAlreadyBinded = new Set<number>();
   const discoverAlreadyBinded = new Set<number>();

   ///////////////// listen discover model to browse bacnet network and get all devices (broadcast or unicast)
   organModel.discover.modification_date.bind(async () => {
      const discoverList = await organModel.getDiscoverModelFromGraph();

      for (const spinalDiscoverModel of discoverList) {
         if (discoverAlreadyBinded.has(spinalDiscoverModel._server_id)) continue;

         SpinalDiscoverCallback(spinalDiscoverModel, organModel);
         discoverAlreadyBinded.add(spinalDiscoverModel._server_id);
      }
   });

   ///////////////// listen pilot model to update bacnet value of devices
   organModel.pilot.modification_date.bind(async () => {
      const pilotList = await organModel.getPilotModelFromGraph();

      for (const spinalPilotModel of pilotList) {
         SpinalPilotCallback(spinalPilotModel, organModel);
      }
   }, true);


   ///////////////// listen listener model to monitor devices
   organModel.listener.modification_date.bind(async () => {
      const listenerList = await organModel.getListenerModelFromGraph();

      for (let i = 0; i < listenerList.length; i++) {
         const spinalListenerModel = listenerList[i];

         if (listenerAlreadyBinded.has(spinalListenerModel._server_id)) continue;

         SpinalListenerCallback(spinalListenerModel, organModel);
         listenerAlreadyBinded.add(spinalListenerModel._server_id);
      }
   }, true);

   ///////////////// listen allbacnetvalues model to get bacnet values of devices
   organModel.allBacnetValues.modification_date.bind(async () => {
      const allBacnetValuesList = await organModel.getBacnetValuesModelFromGraph();

      for (const spinalBacnetValueModel of allBacnetValuesList) {
         SpinalBacnetValueModelCallback(spinalBacnetValueModel, organModel);
      }
   }, true);
}

export const GetPm2Instance = (organName: string): Promise<pm2.ProcessDescription | undefined> => {
   return new Promise((resolve, reject) => {
      pm2.list((err: Error, apps: pm2.ProcessDescription[]) => {
         if (err) {
            return reject(err);
         }
         const instance = apps.find(app => app.name === organName);

         resolve(instance)
      })
   });
}

export function restartProcessById(instanceId: string | number): Promise<boolean> {

   return new Promise((resolve, reject) => {
      pm2.restart(instanceId, (err) => {
         if (err) return resolve(false);
         resolve(true);
      });
   });
}


////////////////////////////////////////////////
////                 CALLBACKS                //
////////////////////////////////////////////////

async function SpinalDiscoverCallback(spinalDiscoverModel: SpinalDiscoverModel, organModel: SpinalOrganConfigModel): Promise<void | boolean> {

   try {
      // await WaitModelReady();
      //// this check is not necessary when not using load_type
      // const itsForThisOrgan = await checkOrgan(spinalDiscoverModel, organModel.id?.get() || '');
      // if (!itsForThisOrgan) return;

      const actualState = spinalDiscoverModel.state.get();

      // if the state is different than initial that means that the discover model was already treated
      if (actualState !== STATES.discovering && actualState !== STATES.initial) {
         spinalDiscoverModel.changeState(STATES.error);
         return spinalDiscoverModel.removeFromGraph();
      }

      spinalDiscover.addToQueue(spinalDiscoverModel);
      // new SpinalDiscover(spinalDiscoverModel);
   } catch (error) {
      spinalDiscoverModel.removeFromGraph();
   }

}

async function SpinalBacnetValueModelCallback(spinalBacnetValueModel: SpinalBacnetValueModel, organModel: SpinalOrganConfigModel): Promise<void | boolean> {
   // await WaitModelReady();

   try {
      //// this check is not necessary when not using load_type 
      // const itsForThisOrgan = await checkOrgan(spinalBacnetValueModel, organModel.id?.get() || '');
      // if (!itsForThisOrgan) return;

      const { context, device } = await SpinalNetworkUtilities.initSpinalBacnetValueModel(spinalBacnetValueModel);

      if (spinalBacnetValueModel.state.get() === BACNET_VALUES_STATE.wait) addToGetAllBacnetValuesQueue(device.info.get(), device, context, spinalBacnetValueModel);

      else throw new Error('lost connection with bacnet network');

   } catch (error) {
      await spinalBacnetValueModel.changeState(BACNET_VALUES_STATE.error);
      return spinalBacnetValueModel.removeFromGraph();
   }

}

function SpinalListenerCallback(spinalListenerModel: SpinalListenerModel, organModel: SpinalOrganConfigModel): void {
   // await WaitModelReady();

   //// this check is not necessary when not using load_type
   // const itsForThisOrgan = await checkOrgan(spinalListenerModel, organModel.id?.get() || '');
   // if (itsForThisOrgan) spinalMonitoring.addToMonitoringList(spinalListenerModel);

   spinalMonitoring.addToMonitoringList(spinalListenerModel);
}

function SpinalPilotCallback(spinalPilotModel: SpinalPilotModel, organModel: SpinalOrganConfigModel): void {
   // await WaitModelReady();
   //// this check is not necessary when not using load_type
   // const itsForThisOrgan = await checkOrgan(spinalPilotModel, organModel.id?.get() || '');
   // if (itsForThisOrgan) spinalPilot.addToPilotList(spinalPilotModel);

   spinalPilot.addToPilotList(spinalPilotModel);
}


async function checkOrgan(spinalOrgan: SpinalDiscoverModel | SpinalListenerModel | SpinalPilotModel | SpinalBacnetValueModel, organId: string): Promise<boolean> {
   try {

      if (!organId) return false;

      // await WaitModelReady();
      let spinalDiscoverModelOrgan: SpinalNode = await spinalOrgan.getOrgan();

      if (spinalDiscoverModelOrgan instanceof SpinalNode) {
         spinalDiscoverModelOrgan = await spinalDiscoverModelOrgan.getElement(true);
      }

      return !!(organId === spinalDiscoverModelOrgan.id?.get())
   } catch (error) {
      return false;
   }

}

export function loadPtrValue(ptrModel: spinal.Ptr): Promise<any> {
   return new Promise((resolve) => {
      ptrModel.load((data) => resolve(data));
   });
}