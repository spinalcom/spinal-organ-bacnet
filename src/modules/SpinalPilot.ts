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

import { SpinalQueue, PILOT_STATES } from "spinal-connector-service";
import { SpinalPilotModel } from "spinal-model-bacnet";
import { IRequest } from "spinal-model-bacnet";
import { PropertyIds, ObjectTypes, APPLICATION_TAGS } from "../utilities/GlobalVariables";

import BacnetUtilities from "../utilities/BacnetUtilities";

class SpinalPilot {
   private queue: SpinalQueue<SpinalPilotModel> = new SpinalQueue();
   private isProcessing: boolean = false;
   private static instance: SpinalPilot;

   private constructor() { }


   public static getInstance(): SpinalPilot {
      if (!this.instance) {
         this.instance = new SpinalPilot();
         this.instance.init();
      }
      return this.instance;
   }

   private init() {
      this.queue.on("start", () => {
         console.log("start pilot...");
         this.pilot();
      })
   }

   public async addToPilotList(spinalPilotModel: SpinalPilotModel): Promise<void> {
      this.queue.addToQueue(spinalPilotModel);
   }


   private async pilot(): Promise<void> {
      if (this.isProcessing) return;

      this.isProcessing = true;

      try {
         while (!this.queue.isEmpty()) {
            const pilot = this.queue.dequeue();

            if (!pilot) {
               continue;
            }

            await this._handlePilot(pilot);
         }
      } finally {
         this.isProcessing = false;
      }
   }

   private async _handlePilot(pilot: SpinalPilotModel): Promise<void> {
      if (!pilot.isNormal()) {
         console.log("remove");
         await pilot.removeFromGraph();
         return;
      }

      pilot.changeState(PILOT_STATES.processing);

      try {
         await this.writeProperties(pilot.requests.get());
         console.log("success");
         pilot.changeState(PILOT_STATES.success);
      } catch (error: any) {
         console.error(error.message);
         pilot.changeState(PILOT_STATES.error);
      }

      await pilot.removeFromGraph();
   }

   private async writeProperties(requests: IRequest[] = []) {
      for (let index = 0; index < requests.length; index++) {
         const req = requests[index];
         try {
            await this.writeProperty(req);
         } catch (error) {
            throw error;
         }

      }
   }

   private async writeProperty(req: IRequest) {
      const types = this.getDataTypes(req.objectId.type);
      let success = false;

      while (types.length > 0 && !success) {
         const type = types.shift();
         try {
            if (!type) throw new Error("error");

            await this.useDataType(req, type);
            success = true;
         } catch (error) {
            // throw error;
         }
      }

      if (!success) {
         throw new Error("error");
      }

   }


   private useDataType(req: IRequest, dataType: number) {
      return new Promise(async (resolve, reject) => {
         const client = await BacnetUtilities.getClient();
         const value = dataType === APPLICATION_TAGS.BACNET_APPLICATION_TAG_ENUMERATED ? (req.value ? 1 : 0) : req.value;


         const priority = process.env.BACNET_PRIORITY && (!isNaN(process.env.BACNET_PRIORITY as any) && parseInt(process.env.BACNET_PRIORITY)) || 16;

         if (!req.SADR || typeof req.SADR === "object" && Object.keys(req.SADR).length === 0) req.SADR = null;

         client.writeProperty(req.address, req.SADR, req.objectId, PropertyIds.PROP_PRESENT_VALUE, [{ type: dataType, value: value }], { priority }, (err: Error, value: any) => {
            if (err) {
               reject(err);
               return;
            }

            resolve(value);
         })
      });
   }

   private getDataTypes(type: number): number[] {
      const analogTypes = new Set([
         ObjectTypes.OBJECT_ANALOG_INPUT,
         ObjectTypes.OBJECT_ANALOG_OUTPUT,
         ObjectTypes.OBJECT_ANALOG_VALUE,
         ObjectTypes.OBJECT_MULTI_STATE_INPUT,
         ObjectTypes.OBJECT_MULTI_STATE_OUTPUT,
         ObjectTypes.OBJECT_MULTI_STATE_VALUE
      ]);

      const binaryTypes = new Set([
         ObjectTypes.OBJECT_BINARY_INPUT,
         ObjectTypes.OBJECT_BINARY_OUTPUT,
         ObjectTypes.OBJECT_BINARY_VALUE,
         ObjectTypes.OBJECT_BINARY_LIGHTING_OUTPUT
      ]);

      if (analogTypes.has(type)) {
         return [
            APPLICATION_TAGS.BACNET_APPLICATION_TAG_UNSIGNED_INT, APPLICATION_TAGS.BACNET_APPLICATION_TAG_SIGNED_INT,
            APPLICATION_TAGS.BACNET_APPLICATION_TAG_REAL, APPLICATION_TAGS.BACNET_APPLICATION_TAG_DOUBLE
         ];
      }

      if (binaryTypes.has(type)) return [APPLICATION_TAGS.BACNET_APPLICATION_TAG_ENUMERATED, APPLICATION_TAGS.BACNET_APPLICATION_TAG_BOOLEAN];

      return [
         APPLICATION_TAGS.BACNET_APPLICATION_TAG_OCTET_STRING,
         APPLICATION_TAGS.BACNET_APPLICATION_TAG_CHARACTER_STRING,
         APPLICATION_TAGS.BACNET_APPLICATION_TAG_BIT_STRING
      ];
   }
}


const spinalPilot = SpinalPilot.getInstance();


export default spinalPilot;
export {
   spinalPilot
}