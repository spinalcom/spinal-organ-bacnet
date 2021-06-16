import { IDevice } from "./SpinalDevice";
import NetworkService from "spinal-model-bmsnetwork";
import { ObjectTypes, PropertyIds, PropertyNames, ObjectTypesCode, UNITS_TYPES } from "../utilities/GlobalVariables";
import { EventEmitter } from "events";

import * as bacnet from 'bacstack';
import * as lodash from "lodash";
import { SpinalGraph } from "spinal-model-graph";
import { SpinalGraphService, SpinalNode } from "spinal-env-viewer-graph-service";
import SpinalMonitoring from "./SpinalMonitoring";
import BacnetUtilities from "../utilities/BacnetUtilities";


export class SpinalDeviceListener extends EventEmitter {

   private listenerModel: any;
   private children: Array<Array<{ type: number, instance: number }>>;
   // private client: bacnet = new bacnet();
   private networkService: NetworkService = new NetworkService(false);
   // private timeIntervalId: any;
   // private timeIntervalDebounced;
   private networkNode: SpinalNode<any>;
   private device: IDevice;
   private contextNode: SpinalNode<any>;
   private organ: any;

   private monitorBind: any;

   private spinalMonitors = [];

   constructor(listenerModel: any) {
      super()
      this.listenerModel = listenerModel;

      this.init();
      this.on("initialize", () => {
         this._bindListen();
         // this._bindTimeInterval();
      });
   }


   public async init() {
      const graph = await this._getGraph();
      this.device = await this._getDeviceInfo();
      this.networkNode = await this._getNetworkNode();
      this.contextNode = await this._getContextNode();
      this.organ = await this._getOrganInfo();

      if (graph && this.device && this.networkNode && this.contextNode && this.organ) {
         await this.networkService.init(graph, {
            contextName: this.contextNode.getName().get(),
            contextType: this.contextNode.getType().get(),
            networkType: this.organ.type.get(),
            networkName: this.organ.name.get()
         })

         // // if (this.listenerModel.listen.get()) {
         // await this.checkIfItemExist(this.networkService, (<any>this.device).id);
         // // }

         this.emit("initialize");
      }
   }

   private _bindListen() {
      // this.listenerModel.listen.bind(async () => {
      //    if (this.listenerModel.listen.get() && this.listenerModel.monitor) {
      //       await this.checkIfItemExist(this.networkService, (<any>this.device).id);
      //       this.monitorBind = this.listenerModel.monitor.bind(() => {
      //          this._stopMonitors();

      //          for (let i = 0; i < this.listenerModel.monitor.length; i++) {
      //             const model = this.listenerModel.monitor[i];
      //             const spinalMonitoring = new SpinalMonitoring(model, (children) => {
      //                if (children.length > 0) this._updateEndpoints(children);
      //             });
      //             spinalMonitoring.start();
      //             this.spinalMonitors.push(spinalMonitoring);
      //          }
      //       })

      //       return;
      //    } else if (!this.listenerModel.listen.get()) {
      //       if (this.monitorBind) {
      //          this.listenerModel.monitor.unbind(this.monitorBind);
      //       }
      //       // console.log(`${new Date()} ===> ${(<any>this.device).name} is stopped`);
      //       this._stopMonitors();
      //    }



      //    // this.timeIntervalDebounced()
      // })
      // // setInterval(() => {
      // //    this._updateEndpoints();
      // // }, 15000);
   }

   private _stopMonitors() {
      for (const spinalMonitoring of this.spinalMonitors) {
         spinalMonitoring.stop()
      }

      this.spinalMonitors = [];
   }

   private _updateEndpoints(children) {

      console.log(`${new Date()} ===> update ${(<any>this.device).name}`)
      this._getChildrenNewValue(children).then((objectListDetails) => {

         console.log("new values", objectListDetails);

         const obj: any = {
            id: (<any>this.device).idNetwork,
            children: this._groupByType(lodash.flattenDeep(objectListDetails))
         }

         this.networkService.updateData(obj, null, this.networkNode);
      }).catch(() => { })
   }

   private _getChildrenNewValue(children: Array<{ type: number, instance: number }>) {
      const client = new bacnet();

      const requestArray = children.map(el => {
         return {
            objectId: el,
            properties: [{ id: PropertyIds.PROP_PRESENT_VALUE }]
         }
      })
      return new Promise((resolve, reject) => {
         client.readPropertyMultiple(this.device.address, requestArray, (err, data) => {
            if (err) {
               // console.error(err)
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

            client.close();
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
         this.listenerModel.graph.load((graph) => {
            resolve(graph)
         })
      });
   }

   private _getNetworkNode(): Promise<SpinalNode<any>> {
      return new Promise((resolve, reject) => {
         this.listenerModel.network.load((networkNode) => {
            resolve(networkNode);
         })
      });


      // console.log(contextId, nodeId);

      // const realNode = SpinalGraphService.getRealNode(nodeId);
      // if (realNode) return realNode;

      // const found = await SpinalGraphService.findInContext(contextId, contextId, (node) => {
      //    console.log("node", node)
      //    if (node.getId().get() === nodeId) return true;
      //    return false;
      // });
      // console.log("found", found)
      // if (found.length > 0) {
      //    return found[0];
      // }
   }

   private _getContextNode(): Promise<SpinalNode<any>> {
      return new Promise((resolve, reject) => {
         this.listenerModel.context.load((contextNode) => {
            resolve(contextNode);
         })
      });
   }

   private _getDeviceInfo(): Promise<IDevice> {
      return new Promise((resolve, reject) => {
         this.listenerModel.device.load((deviceNode) => {
            const info = deviceNode.info.get();
            resolve(info);
         })
      });

   }

   private _getOrganInfo(): Promise<any> {
      return new Promise((resolve, reject) => {
         this.listenerModel.organ.load((organ) => {
            resolve(organ);
         })
      });
   }

   private async checkIfItemExist(networkService, deviceId) {
      console.log(new Date(), "===> checking if items exists", (<any>this.device).name);
      const client = new bacnet();

      if (this.listenerModel.monitor) {
         let objectIds = []

         for (let i = 0; i < this.listenerModel.monitor.length; i++) {
            objectIds.push(...this.listenerModel.monitor[i].children.get());
         }

         const children = lodash.chunk(objectIds, 60)

         return this._getAllObjectDetails(children, client).then((objectListDetails) => {
            const childrenGroups = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type });
            const promises = Array.from(Object.keys(childrenGroups)).map((el: string) => {
               return BacnetUtilities.createEndpointsInGroup(networkService, deviceId, el, childrenGroups[el]);
            })

            return Promise.all(promises).then((result) => {
               console.log("result", result);
            })
         }).catch((err) => {
            // console.error(err)
         });


      }

   }

   private _getAllObjectDetails(objectLists: any, client) {
      // console.log("getting object details");

      const objectListDetails = [];

      return new Promise((resolve, reject) => {
         objectLists.map(object => {
            return () => {
               return BacnetUtilities._getObjectDetail(this.device, object, client).then((g) => objectListDetails.push(g))
            }
         }).reduce((previous, current) => { return previous.then(current) }, Promise.resolve()).then(() => {
            resolve(objectListDetails);
         })
      })


   }
}