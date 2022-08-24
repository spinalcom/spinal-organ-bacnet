// /*
//  * Copyright 2022 SpinalCom - www.spinalcom.com
//  * 
//  * This file is part of SpinalCore.
//  * 
//  * Please read all of the following terms and conditions
//  * of the Free Software license Agreement ("Agreement")
//  * carefully.
//  * 
//  * This Agreement is a legally binding contract between
//  * the Licensee (as defined below) and SpinalCom that
//  * sets forth the terms and conditions that govern your
//  * use of the Program. By installing and/or using the
//  * Program, you agree to abide by all the terms and
//  * conditions stated or referenced herein.
//  * 
//  * If you do not agree to abide by these terms and
//  * conditions, do not demonstrate your acceptance and do
//  * not install or use the Program.
//  * You should have received a copy of the license along
//  * with this file. If not, see
//  * <http://resources.spinalcom.com/licenses.pdf>.
//  */

// import { SpinalListenerModel } from "spinal-model-bacnet";
// import NetworkService from "spinal-model-bmsnetwork";
// import { MinPriorityQueue } from "@datastructures-js/priority-queue";

// import { SpinalNetworkServiceUtilities } from "../utilities/SpinalNetworkServiceUtilities";
// import { SpinalQueuing } from "../utilities/SpinalQueuing";
// import { SpinalDevice } from "./SpinalDevice";
// import * as lodash from "lodash";
// import { SpinalNode, SpinalNodeRef } from "spinal-env-viewer-graph-service";

// import { IDataMonitor } from "../Interfaces/IDataMonitor";
// import { IDevice } from "../Interfaces";
// import spinalPilot from "./SpinalPilot";

// class SpinalMonitoring {

//    private queue: SpinalQueuing<SpinalListenerModel> = new SpinalQueuing();
//    // private priorityQueue: MinPriorityQueue<{ interval: number; functions: { id: string; func: Function }[] }> = new MinPriorityQueue();
//    private priorityQueue: MinPriorityQueue<{ interval: number; }> = new MinPriorityQueue();
//    private isProcessing: boolean = false;
//    private intervalTimesMap: Map<number, any> = new Map();
//    private initializedMap: Map<string, boolean> = new Map();
//    private binded = []
//    private devices: Array<string> = [];


//    constructor() { }

//    public async addToMonitoringList(spinalListenerModel: SpinalListenerModel): Promise<void> {
//       this.queue.addToQueue(spinalListenerModel);
//    }

//    init() {
//       this.queue.on("start", () => {
//          console.log("start initialisation...");

//          this.startDeviceInitialisation();
//       })
//    }


//    public async startDeviceInitialisation() {
//       const list = this.queue.getQueue();
//       this.queue.refresh();

//       const promises = list.map(el => SpinalNetworkServiceUtilities.initSpinalListenerModel(el));

//       const devices = lodash.flattenDeep(await Promise.all(promises)).filter(el => typeof el !== "undefined");

//       await this._createMaps(devices);

//       if (!this.isProcessing) {
//          this.isProcessing = true;
//          this.startMonitoring()
//       }
//    }

//    public async startMonitoring() {
//       console.log("start monitoring...");

//       let p = true;
//       while (p) {
//          if (this.priorityQueue.isEmpty()) {
//             // console.log("priority queue is empty");

//             await this.waitFct(100);
//             continue;
//          }

//          const { priority, element } = this.priorityQueue.dequeue();
//          const functions = this.intervalTimesMap.get(element.interval);

//          if (functions && functions.length > 0) {
//             await this.execFunc(functions, element.interval, priority);
//          }
//       }
//    }

//    private async _createMaps(devices: Array<IDataMonitor>) {
//       const devices_copy = Object.assign([], devices);

//       while (devices_copy.length > 0) {
//          const { id, spinalModel, spinalDevice, networkService, network, profil, organ } = devices_copy.shift();
//          const listen = spinalModel.listen.get();

//          if (!listen) {
//             this.removeToMaps(id);
//             console.log(spinalDevice.device.name, "is stopped");

//             continue;
//          }

//          const { measures, alarms, commands } = await SpinalNetworkServiceUtilities.getSupervisionDetails(profil.getId().get());
//          const 
//          const measuresIntervals = 

//          // const monitors = spinalModel.monitor.getMonitoringData();
//          // const intervals = await this.getValidIntervals(spinalDevice, networkService, spinalModel, network, monitor);
//          // const { toMonitors: intervals, toBind } = await this.getValidIntervals(spinalDevice, networkService, spinalModel, network, profil);

//          // await this._bindEndpoints(toBind, organ, spinalDevice.device);

//          for (const { interval, func } of intervals) {
//             this._addToMap(id, interval, func);
//          }

//          if (this.binded.indexOf(id) === -1) {
//             spinalModel.listen.bind(() => {
//                console.log("listen changed");

//                this.addToMonitoringList(spinalModel);
//             })
//          }

//       }

//    }

//    private _bindEndpoints(endpointsList: SpinalNodeRef[], device: IDevice) {
//       const promises = endpointsList.map(async (endpointNode) => {
//          const endpointElement = await endpointNode.element.load();
//          endpointElement.currentValue.bind(() => {
//             const newValue = endpointElement.currentValue.get();
//             return this.sendUpdateRequest(endpointElement, device, newValue)
//          })
//       })

//       return Promise.all(promises)
//    }

//    async sendUpdateRequest(endpointElement, device: IDevice, newValue) {
//       // const [organNode] = await this.getEndpointOrgan(nodeId);
//       // const devices = await this.getDevices(nodeId);

//       // const organ = await organNode.element.load();
//       // let organ = organNode;

//          const request = {
//             address: device.address,
//             deviceId: device.deviceId,
//             objectId: { type: endpointElement.typeId.get(), instance: endpointElement.id.get() },
//             value: newValue,
//          };

//          console.log(endpointElement.name.get(), "a changé de value", newValue);
//          spinalPilot.sendPilotRequest(request);

//          // const spinalPilot = new SpinalPilotModel(organ, requests);
//          // await spinalPilot.addToNode(endpointNode);
//          // return spinalPilot;

//    }

//    private _addToMap(id: string, interval: number, func: Function) {
//       let value = this.intervalTimesMap.get(interval);
//       if (typeof value === "undefined") {
//          value = [];
//       }

//       value.push({ id, func })
//       this.intervalTimesMap.set(interval, value);
//       this._addIntervalToPriorityQueue(interval);
//    }

//    private removeToMaps(deviceId: string) {
//       this.intervalTimesMap.forEach((value, key) => {
//          this.intervalTimesMap.set(key, value.filter(el => el.id !== deviceId));
//       })
//    }

//    private _addIntervalToPriorityQueue(interval: number) {
//       const arr = this.priorityQueue.toArray();
//       const found = arr.find(({ element }) => {
//          return element.interval === interval;
//       })

//       if (typeof found === "undefined") {
//          this.priorityQueue.enqueue({ interval }, Date.now() + interval);
//       }
//    }

//    private async execFunc(functions: { id: string; func: Function }[], interval: number, date?: number) {

//       if (date && Date.now() < date) {
//          console.log("wait");
//          await this.waitFct(date - Date.now());
//       }
//       try {
//          const deep_functions = [...functions]

//          while (deep_functions.length > 0) {
//             try {
//                const { func } = deep_functions.shift();

//                if (typeof func === "function") {
//                   await func();
//                }
//             } catch (error) {
//                console.error(error);

//             }
//          }
//          this.priorityQueue.enqueue({ interval }, Date.now() + interval);
//       } catch (error) {
//          console.error(error);

//          this.priorityQueue.enqueue({ interval }, Date.now() + interval);
//       }

//    }

//    private async createDataIfNotExist(spinalDevice: SpinalDevice, children: Array<any>, networkService: NetworkService, interval: number): Promise<SpinalNodeRef[]> {
//       try {
//          const id = `${spinalDevice.device.deviceId}_${interval}`;
//          let init = this.initializedMap.get(id);

//          if (!init) {
//             // console.log("initialisation");
//             this.initializedMap.set(id, true);
//             const endpoints = await spinalDevice.checkAndCreateIfNotExist(networkService, children);
//             return lodash.flattenDeep(endpoints);
//          }
//       } catch (error) {
//          console.error(error)
//       }
//    }

//    private async funcToExecute(spinalModel: SpinalListenerModel, spinalDevice: SpinalDevice, children: Array<any>, networkService: NetworkService, network: SpinalNode<any>) {
//       if (spinalModel.listen.get() && children?.length > 0) {
//          await spinalDevice.updateEndpoints(networkService, network, children);
//       }
//    }

//    private async getValidIntervals(spinalDevice: SpinalDevice, networkService: NetworkService, spinalModel: SpinalListenerModel, network: SpinalNode, profil: SpinalNode) {

//       const { measures, alarms, commands } = await SpinalNetworkServiceUtilities.getSupervisionDetails(profil.getId().get());
//       const monitors_copy = this._formatByInterval(measures);
//       // const monitors_copy = Object.assign([], monitors);
//       const res = []
//       const nodeToBind = []
//       while (monitors_copy.length > 0) {
//          const { interval, children } = monitors_copy.shift();
//          if (isNaN(interval) || interval <= 0 || children.length <= 0) continue;
//          const liste = await this.createDataIfNotExist(spinalDevice, children, networkService, interval);
//          nodeToBind.push(...liste);
//          const func = async () => this.funcToExecute(spinalModel, spinalDevice, children, networkService, network);
//          res.push({
//             interval,
//             children,
//             func
//          })
//       }
//       return { toMonitors: res, toBind: nodeToBind };
//    }

//    // private async getValidIntervals(spinalDevice: SpinalDevice, networkService: NetworkService, spinalModel: SpinalListenerModel, network: SpinalNode, monitors: { interval: number; children: [] }[]) {
//    //    const monitors_copy = Object.assign([], monitors);
//    //    const res = []
//    //    while (monitors_copy.length > 0) {
//    //       const { interval, children } = monitors_copy.shift();
//    //       if (isNaN(interval) || interval <= 0 || children.length <= 0) continue;
//    //       await this.createDataIfNotExist(spinalDevice, children, networkService, interval);
//    //       const func = async () => this.funcToExecute(spinalModel, spinalDevice, children, networkService, network);
//    //       res.push({
//    //          interval,
//    //          children,
//    //          func
//    //       })
//    //    }
//    //    return res;
//    // }

//    private waitFct(nb: number): Promise<void> {
//       return new Promise((resolve) => {
//          setTimeout(
//             () => {
//                resolve();
//             },
//             nb >= 0 ? nb : 0);
//       });
//    }

//    private _formatByInterval(array: { monitoring: { IntervalTime: any }, children: any[] }[]): { interval: any, children: any[] }[] {
//       return array.map(({ monitoring: { IntervalTime }, children }) => ({ interval: IntervalTime, children }))
//    }

// }

// const spinalMonitoring = new SpinalMonitoring();
// spinalMonitoring.init();

// export default spinalMonitoring;
// export {
//    spinalMonitoring
// }
