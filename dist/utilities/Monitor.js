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
// import { SpinalNode } from "spinal-env-viewer-graph-service";
// import { SpinalListenerModel } from "spinal-model-bacnet";
// import { NetworkService } from "spinal-model-bmsnetwork";
// import { SpinalDevice } from "../modules/SpinalDevice";
// export default class Monitor {
//    private monitorModel: any;
//    private intervalId: any;
//    private monitoringProcess: any;
//    private intervalProcess: any;
//    private timeSeriesProcess: any;
//    private networkService: NetworkService;
//    private spinalDevice: SpinalDevice;
//    private spinalModel: SpinalListenerModel;
//    private spinalNetwork: SpinalNode<any>;
//    // constructor(model: any, callback: any) {
//    constructor(model: any, networkService: NetworkService, spinalDevice: SpinalDevice, spinalModel: SpinalListenerModel, spinalNetwork: SpinalNode<any>) {
//       this.monitorModel = model;
//       this.networkService = networkService;
//       this.spinalDevice = spinalDevice;
//       this.spinalModel = spinalModel;
//       this.spinalNetwork = spinalNetwork;
//    }
//    start() {
//       if (isNaN(this.monitorModel.interval.get())) {
//          // console.log("isNaN")
//          this.stop();
//          return
//       };
//       this.timeSeriesProcess = this.spinalModel.saveTimeSeries?.bind(() => {
//          console.log("timeSeries change", this.spinalModel.saveTimeSeries?.get());
//          this.networkService.useTimeseries = this.spinalModel.saveTimeSeries?.get() || false;
//       })
//       this.monitoringProcess = this.monitorModel.monitoring.bind(() => {
//          if (!this.monitorModel.monitoring.get()) {
//             // console.log("!this.monitorModel.monitoring.get()")
//             this.stop();
//             return
//          };
//          this.intervalProcess = this.monitorModel.interval.bind(() => {
//             // console.log("inside interval bind")
//             clearInterval(this.intervalId);
//             this.intervalId = setInterval(() => {
//                const children = this.monitorModel.children.get();
//                this.spinalDevice.updateEndpoints(this.networkService, this.spinalNetwork, children);
//             }, this.monitorModel.interval.get())
//          })
//       })
//    }
//    stop() {
//       // console.log("stop")
//       clearInterval(this.intervalId);
//       this.monitorModel.monitoring.unbind(this.monitoringProcess);
//       this.monitorModel.interval.unbind(this.intervalProcess);
//       this.spinalModel.saveTimeSeries?.unbind(this.timeSeriesProcess);
//    }
// }
// export { Monitor }
//# sourceMappingURL=Monitor.js.map