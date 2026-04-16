/*
 * Copyright 2021 SpinalCom - www.spinalcom.com
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

import * as bacnet from "bacstack";
import { PropertyNames, ObjectTypesCode } from "./GlobalVariables";
import { IDevice, IObjectId } from "../Interfaces";
import { EventPayload, SpinalCov } from "../modules/SpinalCov";
import { v4 as uuid } from 'uuid';
import ipc from "node-ipc";
import { SERVICE_NAME, COV_EVENT_NAME, MESSAGE_EVENT_NAME, RESPONSE_EVENT_NAME, BACNET_COV_EVENT_NAME } from "spinal-bacnet-service";
class BacnetUtilitiesClass {

   private static instance: BacnetUtilitiesClass;
   private _client: bacnet = null;
   private _ipcClient: any = null;

   private constructor() { }

   private clientState = {
      consecutiveFailures: 0
   }

   public static getInstance(): BacnetUtilitiesClass {
      if (!this.instance) this.instance = new BacnetUtilitiesClass();
      return this.instance;
   }

   public async initAndConnect() {
      this._ipcClient = await this._connectToServer();

      this._ipcClient.on('disconnect', async () => {
         this._ipcClient = await this._connectToServer();
      });

      console.log("connected to bacnet service");

      this._ipcClient.on(BACNET_COV_EVENT_NAME, (result: any) => {
         SpinalCov.getInstance().emit(result.eventName, result);
      });
   }

   private _connectToServer() {
      return new Promise((resolve, reject) => {
         const serverServiceName = SERVICE_NAME;
         const clientServiceName = process.env.ORGAN_NAME || "spinal-organ-bacnet";

         ipc.config.id = clientServiceName; // Set the IPC client ID to the organ name or a default value
         ipc.config.retry = 5000; // Retry every 5 seconds if connection to server is lost 
         ipc.config.silent = true; // Disable IPC debug logs

         const bacnetServicePort = process.env.BACNET_SERVICE_PORT?.trim();
         const ipcServerPort = bacnetServicePort ? parseInt(bacnetServicePort) : 47810;

         ipc.connectToNet(serverServiceName, "127.0.0.1", ipcServerPort, () => {
            this._ipcClient = ipc.of[serverServiceName];
            resolve(ipc.of[serverServiceName]);
         });
      });

   }

   public createNewBacnetClient(): bacnet {
      const client = new bacnet({ adpuTimeout: 10000 });

      return client;
   }

   public getClient(): Promise<bacnet> {
      return new Promise((resolve) => {
         if (!this._client) this._client = this.createNewBacnetClient();

         return resolve(this._client);
      });
   }

   public sendCovRequest(data: EventPayload) {
      if (this._ipcClient) this._ipcClient.emit(COV_EVENT_NAME, data);
   }

   ////////////////////////////////////////////////////////////////
   ////                  GET ALL BACNET OBJECT LIST              //
   ////////////////////////////////////////////////////////////////

   public async _getDeviceObjectList(device: IDevice, SENSOR_TYPES: Array<number>, getListUsingFragment: boolean = false): Promise<IObjectId[]> {
      return this._sendDataToBacnetServer("_getDeviceObjectList", [device, SENSOR_TYPES, getListUsingFragment]);
   }

   public async getItemListByFragment(device: IDevice, objectId: IObjectId): Promise<IObjectId[]> {
      return this._sendDataToBacnetServer("getItemListByFragment", [device, objectId]);
   }

   ////////////////////////////////////////////////////////////////
   ////                  GET OBJECT DETAIL                       //
   ////////////////////////////////////////////////////////////////

   public async _getObjectDetail(device: IDevice, objects: Array<IObjectId>): Promise<{ [key: string]: string | boolean | number }[]> {
      return this._sendDataToBacnetServer("_getObjectDetail", [device, objects]);
   }

   public async _getObjectDetailWithReadPropertyMultiple(device: IDevice, objects: IObjectId[]): Promise<any[]> {
      return this._sendDataToBacnetServer("_getObjectDetailWithReadPropertyMultiple", [device, objects]);
   }

   public async _getObjectDetailWithReadProperty(device: IDevice, objectId: IObjectId): Promise<any> {
      return this._sendDataToBacnetServer("_getObjectDetailWithReadProperty", [device, objectId]);
   }

   public async _getChildrenNewValue(device: IDevice, children: Array<IObjectId>): Promise<Array<{ id: string | number; type: string | number; currentValue: any }> | undefined> {
      return this._sendDataToBacnetServer("_getChildrenNewValue", [device, children]);
   }

   //////////////////////////////////////////////////////////////////////
   ////                             OTHER UTILITIES                  ////
   //////////////////////////////////////////////////////////////////////


   public async _getPropertyValue(address: string, sadr: any, objectId: IObjectId, propertyId: number | string): Promise<any> {
      return this._sendDataToBacnetServer("_getPropertyValue", [address, sadr, objectId, propertyId]);
   }

   public async getDeviceId(address: string, sadr: any): Promise<number> {
      return this._sendDataToBacnetServer("getDeviceId", [address, sadr]);
   }

   public sendPilotRequest(request: any): Promise<any> {
      return this._sendDataToBacnetServer("writeProperty", [request]);
   }


   /////////////////////////////////////////////////////////
   //                         UTILS                      // 
   ////////////////////////////////////////////////////////


   public _getObjValue(value: any): boolean | string | number {
      if (typeof value !== "object") return value;

      let temp_value = Array.isArray(value) ? value[0]?.value : value.value;
      return typeof temp_value === "object" ? "" : temp_value;
   }


   public _getPropertyNameByCode(type: number): string | undefined {
      const property = PropertyNames[type];
      if (property) return property.toLocaleLowerCase().replace('prop_', '');
      return;
   }

   public _getObjectTypeByCode(typeCode: number | string): string | undefined {
      const property = ObjectTypesCode[typeCode];
      if (property) return property.toLocaleLowerCase().replace('object_', '');
      return;
   }


   private _sendDataToBacnetServer(functionName: string, parameters: any[]): Promise<any> {
      return new Promise((resolve, reject) => {
         const params = {
            name: functionName,
            id: uuid(),
            parameters: parameters
         };

         this._ipcClient.emit(MESSAGE_EVENT_NAME, (params));

         this._ipcClient.once(`${RESPONSE_EVENT_NAME}_${params.id}`, (response: any) => {
            if (response.status === "error") {
               return reject({ message: response.error });
            }

            resolve(response.data);
         });
      });
   }

}


const BacnetUtilities = BacnetUtilitiesClass.getInstance();
export default BacnetUtilities;
export { BacnetUtilities };