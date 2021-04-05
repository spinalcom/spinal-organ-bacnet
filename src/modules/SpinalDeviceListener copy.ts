import { IDevice } from "./SpinalDevice";
import { loadFile } from "../utilities/Utilities";
import NetworkService from "spinal-model-bmsnetwork";
import { ObjectTypes, PropertyIds, PropertyNames, ObjectTypesCode, UNITS_TYPES } from "../utilities/globalVariables";
import { EventEmitter } from "events";

import * as bacnet from 'bacstack';
import * as lodash from "lodash";
import { SpinalGraph } from "spinal-model-graph";
import { SpinalGraphService, SpinalNode } from "spinal-env-viewer-graph-service";


export class SpinalDeviceListener extends EventEmitter {
   private listenerModel: any;
   private children: Array<Array<{ type: number, instance: number }>>;
   private device: IDevice;
   private client: bacnet = new bacnet();
   private networkService: NetworkService = new NetworkService(false);
   private timeIntervalId: any;
   private timeIntervalDebounced;
   private networkNode: SpinalNode<any>;

   constructor(listenerModel: any) {
      super()
      this.listenerModel = listenerModel;
      console.log("listenerModel", listenerModel);

      // this.init();
      // this.on("initialize", () => {
      //    this._bindListen();
      //    this._bindTimeInterval();
      // });
   }


   public async init() {
      // loadFile(this.listenerModel.deviceId.get()).then(async (data: { device: IDevice, children: Array<Array<{ type: number, instance: number }>> }) => {

      const graph = await this._getGraph();

      // this.children = data.children;
      this.device = this.listenerModel.device.get();
      this.networkNode = SpinalGraphService.getRealNode(this.listenerModel.network.id.get())


      await this.networkService.init(graph, {
         contextName: this.listenerModel.context.name.get(),
         contextType: this.listenerModel.context.type.get(),
         networkType: this.listenerModel.organ.type.get(),
         networkName: this.listenerModel.organ.name.get()
         // // networkType: this.listenerModel.network.type.get(),
         // // networkName: this.listenerModel.network.networkName.get()
      })

      // this.timeIntervalDebounced = lodash.debounce(() => { console.log("call inside debounce"); this._createTimeInterval() }, 500);


      this.emit("initialize");
      // }).catch((err) => {
      //    console.error(err)
      // });
   }



   private _bindListen() {
      this.listenerModel.listen.bind(() => {
         this.timeIntervalDebounced()
      })
      // setInterval(() => {
      //    this._updateEndpoints();
      // }, 15000);
   }

   private _bindTimeInterval() {
      this.listenerModel.timeInterval.bind(() => {
         this.timeIntervalDebounced()
      })
   }

   private _createTimeInterval() {
      if (this.timeIntervalId) {
         clearInterval(this.timeIntervalId);
      }

      if (this.listenerModel.listen.get()) {
         this.timeIntervalId = setInterval(() => this._updateEndpoints(), this.listenerModel.timeInterval.get());
      }
   }

   private _updateEndpoints() {
      console.log("update")
      const objectListDetails = [];

      this.children.map(object => {
         return () => {
            return this._getChildrenNewValue(object).then((g) => objectListDetails.push(g))
         }
      }).reduce((previous, current) => { return previous.then(current) }, Promise.resolve()).then(() => {
         const obj: any = {
            id: this.device.deviceId,
            children: this._groupByType(lodash.flattenDeep(objectListDetails))
         }

         this.networkService.updateData(obj, null, this.networkNode);
      })
   }

   private _getChildrenNewValue(children: Array<{ type: number, instance: number }>) {
      const requestArray = children.map(el => {
         return {
            objectId: el,
            properties: [{ id: PropertyIds.PROP_PRESENT_VALUE }]
         }
      })
      return new Promise((resolve, reject) => {
         this.client.readPropertyMultiple(this.device.address, requestArray, (err, data) => {
            if (err) {
               console.error(err)
               reject(err);
               return;
            }

            const dataFormated = data.values.map(el => {
               const value = this._getObjValue(el.values[0].value);
               return {
                  id: el.objectId.instance,
                  type: el.objectId.type,
                  currentValue: this._formatCurrentValue(value, el.objectId.type)
               }
            })
            resolve(dataFormated);
         })
      });
   }

   private _getObjValue(value: any) {
      if (Array.isArray(value)) {
         if (value.length === 0) return "";
         return value[0].value;
      }

      return value.value;
   }

   private _formatCurrentValue(value: any, type: number) {

      if ([ObjectTypes.OBJECT_BINARY_INPUT, ObjectTypes.OBJECT_BINARY_VALUE].indexOf(type) !== -1) {
         return value ? true : false;
      }

      return value;

   }

   private _groupByType(itemList) {
      const res = []
      const obj = lodash.groupBy(itemList, (a) => a.type);

      for (const [key, value] of Object.entries(obj)) {
         res.push({
            id: parseInt(key),
            children: obj[key]
         })
      }

      return res;
   }

   private _getGraph(): Promise<SpinalGraph<any>> {
      return new Promise((resolve, reject) => {
         this.listenerModel.graph.load((graph) => resolve(graph))
      });
   }

}