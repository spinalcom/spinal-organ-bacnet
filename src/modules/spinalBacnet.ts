import * as bacnet from 'bacstack';
import { SpinalGraphService, SpinalNodeRef } from 'spinal-env-viewer-graph-service';
import { NetworkService, SpinalBmsDevice } from "spinal-model-bmsnetwork";
import { SpinalDevice } from "./SpinalDevice";
import { EventEmitter } from "events";

// import { saveAsFile } from "../utilities/Utilities";
// import { ObjectTypes } from '../utilities/globalVariables';

export class SpinalBacnet extends EventEmitter {

    private CONNECTION_TIME_OUT: number;
    private client: bacnet;
    private devices: Map<number, SpinalDevice> = new Map();
    private queueSize: number = 60;
    private events = {};
    public count: number = 0;
    private config: any;

    constructor(config) {
        super();
        this.CONNECTION_TIME_OUT = config.timeout || 45000;
        this.config = config;
    }

    public async discoverDevices(): Promise<void> {

        this.count = 0;
        if (this.config.useBroadcast) {
            console.log("useBroadcast");
            this.useBroadcast();
        } else {
            console.log("useUnicast");
            this.useUnicast();
        }

    }

    public async createDevicesNodes(networkService: NetworkService, network: { id: string, name: string, type: string }) {
        const devices = await this.getDevices(network.id);

        const iterator = this.convertListToIterator(Array.from(this.devices.keys()));
        this.createDeviceRecursively(iterator, devices, iterator.next(), networkService, network);

        // const promises = Array.from(this.devices.keys()).map(key => {
        //     const node = devices.find(el => el.idNetwork.get() == key);
        //     const device = this.devices.get(key);

        //     return device.createStructureNodes(networkService, node, network.id);

        // })

        // return Promise.all(promises).then(res => console.log("created")).catch(err => { console.error(err); throw new Error('error') })
    }


    public useBroadcast() {
        this.client = new bacnet({
            address: this.config.address,
            port: this.config.port,
        });

        this.client.on('error', (err) => {
            console.log('Error occurred: ', err);
            this.client.close();
        });

        const timeOutId = setTimeout(() => {
            console.error("[TIMEOUT] - Cannot establish connection with BACnet server.");
            this.emit("timeout");
            this.closeClient();

        }, this.CONNECTION_TIME_OUT);

        this.client.on('iAm', (device) => {
            console.log("deviceFound", device);
            clearTimeout(timeOutId);
            this.count++;

            this.getDeviceInformation(device);
        })

        this.client.whoIs();
    }

    public useUnicast() {
        this.client = new bacnet();

        const devices = this.config.ips.map(({ address, deviceId }) => {
            return { address, deviceId: parseInt(deviceId) }
        })

        this.count = devices.length;

        const iterator = this.convertListToIterator(devices);


        this.discoverRecursively(iterator, iterator.next());

    }

    public closeClient() {
        if (this.client) {
            this.client.close();
        }
    }
    /////////////////////////////////////////////////////////////////////////////
    //                                  PRIVATES                               //
    /////////////////////////////////////////////////////////////////////////////


    private createDeviceRecursively(iterator, devices, next, networkService, network) {
        if (!next.done) {
            const value = next.value;
            const node = devices.find(el => el.idNetwork.get() == value);
            const device = this.devices.get(value);
            device.createStructureNodes(networkService, node, network.id).then((result) => {
                this.createDeviceRecursively(iterator, devices, iterator.next(), networkService, network);
            }).catch((err) => {
                this.createDeviceRecursively(iterator, devices, iterator.next(), networkService, network);
            });
        } else {
            this.emit("created");
        }

    }

    private getDeviceInformation(device) {

        return new Promise((resolve, reject) => {
            const spinalDevice = new SpinalDevice(device, this.client);

            spinalDevice.on("initialized", (res) => {
                this.devices.set(res.device.deviceId, res);
                this.emit("deviceFound", res.info);
                resolve(true);
            })

            spinalDevice.on("error", () => {
                this.count--;
                this.emit("noResponse")
                if (this.count === 0) {
                    this.emit("timeout");
                    this.closeClient();
                }
                resolve(true);
            })

            spinalDevice.init();
        });

    }

    private discoverRecursively(iterator, next) {
        if (!next.done) {
            this.getDeviceInformation(next.value).then(() => {
                this.discoverRecursively(iterator, iterator.next())
            })
        } else {
            this.emit("discovered")
        }
    }

    private getDevices(id: string): Promise<SpinalNodeRef[]> {
        return SpinalGraphService.getChildren(id, [SpinalBmsDevice.relationName])
    }

    private *convertListToIterator(devices: Array<any>) {
        yield* devices;
    }
}
