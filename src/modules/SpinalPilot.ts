import { SpinalQueuing } from "../utilities/SpinalQueuing";
import { SpinalPilotModel } from "spinal-model-bacnet";
import { IRequest } from "spinal-model-bacnet";
import { PropertyIds,ObjectTypes ,APPLICATION_TAGS } from "../utilities/GlobalVariables";

import * as bacnet from "bacstack";

class SpinalPilot {
   private queue: SpinalQueuing = new SpinalQueuing();
   private isProcessing: boolean = false;

   constructor() { }

   init() {
      this.queue.on("start", () => {
         console.log("start pilot...");
         this.pilot();
      })
   }

   public async addToPilotList(spinalPilotModel: SpinalPilotModel): Promise<void> {
      console.log("addToQueue");
      
      this.queue.addToQueue(spinalPilotModel);
   }

   private async pilot() {
      if (!this.isProcessing) {
         this.isProcessing = true;
         // console.log(this.queue);
         while (!this.queue.isEmpty()) {
            const pilot = this.queue.dequeue();

            if(pilot?.isNormal()) {
               pilot.setProcessMode();
               try {
                  await this.writeProperties(pilot?.requests.get())
                  console.log("success");
                  pilot.setSuccessMode();
                  await pilot.removeToNode();
               } catch (error) {
                  console.log("error");
                  pilot.setErrorMode();
                  await pilot.removeToNode();
               }
               
            } else {
               console.log("remove");
               await pilot.removeToNode();
            }
            
            // console.log("pilot",pilot)
         }
         
         this.isProcessing = false;
      }
   }

   private async writeProperties(requests: IRequest[] = []) {
      for (let index = 0; index < requests.length; index++) {
         const req = requests[index];
         try {
            await this.writeProperty(req);
         } catch (error) {
            throw new Error("error");
            
         }
         
      }
   }

   private async writeProperty(req : IRequest) {
      const types = this.getDataTypes(req.objectId.type);
      let success = false;

      while (types.length > 0 && !success) {
         const type = types.shift();
         try {
            await this.useDataType(req, type);
            success = true;
         } catch (error) {
            // console.error(error);
         }
      }

      if(!success) {
         throw new Error("error");
      }
      
   }

   private useDataType(req: IRequest, dataType: number) {
      return new Promise((resolve, reject) => {
         const client = new bacnet();
         client.writeProperty(req.address,req.objectId,PropertyIds.PROP_PRESENT_VALUE, [{ type: dataType, value: req.value }],{ priority: 8 },(err,value) => {
               if (err) {
                  reject(err)
                  return;
               }
               resolve(value);
         })
      });
   }

   private getDataTypes(type: any): number[] {


      

      switch (type) {
         
         case ObjectTypes.OBJECT_ANALOG_INPUT:
         case ObjectTypes.OBJECT_ANALOG_OUTPUT:
         case ObjectTypes.OBJECT_ANALOG_VALUE:
         case ObjectTypes.OBJECT_MULTI_STATE_INPUT:
         case ObjectTypes.OBJECT_MULTI_STATE_OUTPUT:
         case ObjectTypes.OBJECT_MULTI_STATE_VALUE:
            console.log("number value");
            
            return [
               APPLICATION_TAGS.BACNET_APPLICATION_TAG_UNSIGNED_INT,
               APPLICATION_TAGS.BACNET_APPLICATION_TAG_SIGNED_INT,
               APPLICATION_TAGS.BACNET_APPLICATION_TAG_REAL,
               APPLICATION_TAGS.BACNET_APPLICATION_TAG_DOUBLE
            ]
         
         case ObjectTypes.OBJECT_BINARY_INPUT:
         case ObjectTypes.OBJECT_BINARY_OUTPUT:
         case ObjectTypes.OBJECT_BINARY_VALUE:
         case ObjectTypes.OBJECT_BINARY_LIGHTING_OUTPUT:
            console.log("binary value");

            return [
               APPLICATION_TAGS.BACNET_APPLICATION_TAG_BOOLEAN
            ]
      
         default:
            console.log("string value");

            return [
               APPLICATION_TAGS.BACNET_APPLICATION_TAG_OCTET_STRING,
               APPLICATION_TAGS.BACNET_APPLICATION_TAG_CHARACTER_STRING,
               APPLICATION_TAGS.BACNET_APPLICATION_TAG_BIT_STRING
            ]
      }
   }
}

const spinalPilot = new SpinalPilot();
spinalPilot.init();

export default spinalPilot;
export {
   spinalPilot
}