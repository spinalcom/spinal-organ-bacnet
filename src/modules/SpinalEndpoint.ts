import NetworkService from "spinal-model-bmsnetwork";
import { PropertyIds } from '../globalVariables'

export class SpinalEndpoint {
   private id: string;
   private currentValue: number | string | boolean;
   private client: any;
   private objectId: { type: number, instance: number };
   private deviceAddress: string;

   constructor(client: any, deviceAddress: string, objectId: { type: number, instance: number }, currentValue: number | string | boolean) {
      this.client = client;
      this.objectId = objectId;
      this.id = objectId.instance.toString();
      this.deviceAddress = deviceAddress;
      this.currentValue = currentValue;
   }

   public checkAndUpdateCurrentValue() {
      return new Promise((resolve, reject) => {
         this.client.readProperty(this.deviceAddress, this.objectId, PropertyIds.PROP_PRESENT_VALUE, (err, res) => {
            if (err) {
               resolve(this.currentValue);
               return
            }
            this.currentValue = res.values[0].value;
            resolve(this.currentValue);
         });
      });
   }

}