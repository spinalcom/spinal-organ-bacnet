import * as bacnet from 'bacstack';
import { SpinalGraphService, SpinalNodeRef } from 'spinal-env-viewer-graph-service';
import { NetworkService, SpinalBmsDevice } from "spinal-model-bmsnetwork";
import { SpinalDevice } from "./SpinalDevice";
import { EventEmitter } from "events";
import { saveAsFile } from "../utilities/Utilities";


export class SpinalBacnet extends EventEmitter {

    private CONNECTION_TIME_OUT: number;
    private client: bacnet;
    private devices: Map<number, SpinalDevice> = new Map();
    private queueSize: number = 60;
    private events = {};
    public count: number = 0;

    constructor(config) {
        super();

        this.CONNECTION_TIME_OUT = config.timeout;
        this.client = new bacnet({
            port: config.port,
            adpuTimeout: this.CONNECTION_TIME_OUT
        });

        // this.client.on('error', (err) => {
        //     console.log('Error occurred: ', err);
        //     this.client.close();
        // });
    }

    // public getDevices() {
    //     return this.devices;
    // }

    public async discoverDevices(): Promise<void> {
        // const devices = await this.getDevices((<any>networkService).networkId);
        this.count = 0;

        const timeOutId = setTimeout(() => {
            console.error("[TIMEOUT] - Cannot establish connection with BACnet server.");
            this.emit("timeout");
            // this.client.close();
            // process.exit();
        }, this.CONNECTION_TIME_OUT);

        this.client.on('iAm', (device) => {
            clearTimeout(timeOutId);
            this.count++;

            // const node = devices.find(el => el.idNetwork.get() == device.deviceId)
            const spinalDevice = new SpinalDevice(device, this.client);
            spinalDevice.on("initialized", (res) => {
                this.devices.set(res.device.deviceId, res);
                this.emit("deviceFound", res.device);
            })


            // spinalDevice.init(node, networkService);

            // this._getDeviceObjectList(device).then((objects: Array<Array<{ type: string, instance: number }>>) => {
            //     console.log(objects);
            //     // let objectListDetails = []
            //     // objects.map(object => {
            //     //     return () => {
            //     //         return this._getObjectDetail(device, object).then((g) => objectListDetails.push(g))
            //     //     }
            //     // }).reduce((previous, current) => { return previous.then(current) }, Promise.resolve()).then(() => {
            //     //     // objectListDetails = [].concat.apply([], objectListDetails)
            //     //     const obj = { device, itemsList: [].concat.apply([], objectListDetails) }
            //     //     this.devices.set(device.deviceId, obj);
            //     //     this.emit("deviceFound", obj)
            //     // })
            // })
        })

        this.client.whoIs();
    }


    public async createDevicesNodes(networkService: NetworkService) {
        const devices = await this.getDevices((<any>networkService).networkId);

        const promises = Array.from(this.devices.keys()).map(key => {
            const node = devices.find(el => el.idNetwork.get() == key);
            const device = this.devices.get(key);

            return device.createStructureNodes(networkService, node);

        })

        return Promise.all(promises);
    }


    // public on(eventName: string, listener: Function) {
    //     if (!this.events[eventName]) {
    //         this.events[eventName] = []
    //     }
    //     this.events[eventName].push(listener);
    // }

    // private emit(eventName: string, data: any) {
    //     if (!this.events[eventName]) {
    //         return;
    //     }

    //     this.events[eventName].forEach((callback) => {
    //         if (typeof callback === "function") callback(data);
    //     })

    // }

    /////////////////////////////////////////////////////////////////////////////
    //                                  PRIVATES                               //
    /////////////////////////////////////////////////////////////////////////////

    private getDevices(id: string): Promise<SpinalNodeRef[]> {
        return SpinalGraphService.getChildren(id, [SpinalBmsDevice.relationName])
    }


    // private _getDeviceObjectList(device: any): Promise<Array<Array<{ type: string, instance: number }>>> {
    //     return new Promise((resolve, reject) => {

    //         const checkIfDeviceExist = this.devices.get(device.deviceId)
    //         if (checkIfDeviceExist && checkIfDeviceExist.itemsList) {
    //             return resolve(checkIfDeviceExist.itemsList)
    //         }

    //         const sensor = []
    //         this.client.readProperty(device.address, { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId }, PropertyIds.PROP_OBJECT_LIST, (err, res) => {
    //             if (err) {
    //                 reject(err);
    //                 return;
    //             }

    //             for (const item of res.values) {
    //                 if (SENSOR_TYPES.indexOf(item.value.type) !== -1)
    //                     sensor.push(item.value);
    //             }

    //             return resolve(this.useQueuing(sensor, this.queueSize));
    //         })
    //     });
    // }

    // private _getObjectDetail(device, objects: Array<{ type: string, instance: number }>) {

    //     const requestArray = objects.map(el => ({
    //         objectId: JSON.parse(JSON.stringify(el)),
    //         properties: [
    //             // { id: PropertyIds.PROP_ALL }
    //             { id: PropertyIds.PROP_OBJECT_NAME },
    //             { id: PropertyIds.PROP_PRESENT_VALUE },
    //             { id: PropertyIds.PROP_OBJECT_TYPE },
    //             { id: PropertyIds.PROP_UNITS },
    //         ]
    //     }))

    //     return new Promise((resolve, reject) => {
    //         this.client.readPropertyMultiple(device.address, requestArray, (err, data) => {
    //             if (err) {
    //                 reject(err);
    //                 return;
    //             }

    //             const dataFormated = data.values.map(el => this.formatProperty(device, el))
    //             resolve(dataFormated);
    //         })
    //     });
    // }

    // private useQueuing(liste, queueSize): Array<Array<{ type: string, instance: number }>> {
    //     const queue = [];
    //     for (let i = 0; i < liste.length; i++) {
    //         const last = queue[queue.length - 1];
    //         if (!last || last.length === queueSize) {
    //             queue.push([liste[i]]);
    //         } else {
    //             last.push(liste[i]);
    //         }
    //     }
    //     return queue;
    // }

    // private formatProperty(device, object) {

    //     const { objectId, values } = object;


    //     const obj = {
    //         id: `${objectId.type}_${objectId.instance}`,
    //         type: objectId.type,
    //         instance: objectId.instance,
    //         deviceId: device.deviceId
    //     }

    //     for (const { id, value } of values) {
    //         const propertyName = this._getPropertyName(id);

    //         if (propertyName) {
    //             obj[propertyName] = this.getObjValue(value);
    //         }

    //     }

    //     return obj;
    // }

    // private getObjValue(value) {
    //     if (Array.isArray(value)) {
    //         if (value.length === 0) return [];
    //         // if(value.length === 1) return value[0].value;

    //         return value.map(el => el.value);
    //     }
    //     // if(Array.isArray(value)) return value[0].value;

    //     return value.value;
    // }

    // private _getPropertyName(type: number): string {
    //     for (const [key, value] of Object.entries(PropertyIds)) {
    //         if (value === type) return key.toLocaleLowerCase().replace('prop_', '');
    //     }

    //     return;
    // }

}