import { SpinalContext, SpinalNode } from "spinal-model-graph";
import { DeviceProfileUtilities } from "spinal-env-viewer-plugin-network-tree-service"
import { SpinalGraphService, SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { serviceDocumentation } from "spinal-env-viewer-plugin-documentation-service";
import { BacnetEnum } from "./bacnetEnum";
import { IObjectId } from "../Interfaces";
import EventEmitter = require("node:events");



export type IProfileData = {
    monitoring?: string;
    interval?: number;
    children?: IObjectId[];
};

type IMonitoData = {
    monitoring: {
        Monitoring: string;
        IntervalTime: number;
    };
    children: IObjectId[];
};

export default class ProfileManager extends EventEmitter {
    private static instance: ProfileManager;
    private _profiles: Map<string, IProfileData[]>;
    private _isProcessingQueue: boolean = false;

    private constructor() {
        super();
        this._profiles = new Map();
    }

    public static getInstance(): ProfileManager {
        if (!ProfileManager.instance) {
            ProfileManager.instance = new ProfileManager();
        }
        return ProfileManager.instance;
    }


    public async getProfileData(profileSpinalNode: SpinalNode): Promise<IProfileData[]> {
        // Wait if another process is currently processing the queue
        // This ensures that we don't have multiple processes trying to access the same profile data at the same time
        await this._waitIfProcessing();

        const profileId = profileSpinalNode.getId().get();
        const profileData = this._profiles.get(profileId);

        if (profileData) return profileData;

        this._bindProfileNode(profileSpinalNode);
        this._isProcessingQueue = true;
        const data = await this._fetchProfileData(profileSpinalNode);
        this._profiles.set(profileId, data);
        this._isProcessingQueue = false;

        return data;
    }

    private _bindProfileNode(profileSpinalNode: SpinalNode): void {

        profileSpinalNode.info.directModificationDate.bind(async () => {
            const profileId = profileSpinalNode.getId().get();

            const data = await this._fetchProfileData(profileSpinalNode);
            this._profiles.set(profileId, data);

            this.emit("changed", { profileId, data });
        }, false)
    }

    private async _waitIfProcessing(): Promise<void> {
        while (this._isProcessingQueue) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }


    private async _fetchProfileData(profileNode: SpinalNode): Promise<IProfileData[]> {
        SpinalGraphService._addNode(profileNode);
        const contextNode = await this._getProfileContext(profileNode)
        if (contextNode) SpinalGraphService._addNode(contextNode);

        const profileId = profileNode.getId().get();
        const contextId = contextNode.getId().get();

        const intervalsNodes = await DeviceProfileUtilities.getIntervalNodes(profileId, contextId);
        const promises = intervalsNodes.map((intervalNode) => this._getIntervalInfo(intervalNode));

        return Promise.all(promises).then((result) => this._filterIntervals(result));
    }

    private async _getProfileContext(profileNode: SpinalNode): Promise<SpinalContext> {
        const parents = await profileNode.getParents("hasParts");
        const parent = parents[0];

        const contexts = await parent.getParents("hasDevice");
        return contexts[0];
    }

    private async _filterIntervals(monitors: IMonitoData[]) {
        const res: IProfileData[] = [];

        for (const monitor of monitors) {
            if (!monitor || monitor.monitoring.IntervalTime <= 0 || monitor.children.length <= 0) continue;
            const { monitoring, children } = monitor;

            res.push({
                interval: monitoring.IntervalTime,
                monitoring: monitoring.Monitoring,
                children
            });
        }

        return res;

    }


    private async _getIntervalInfo(intervalNodeRef: SpinalNodeRef): Promise<IMonitoData> {
        return Promise.all([this._getSharedAttributes(intervalNodeRef), this._getEndpointsObjectIds(intervalNodeRef)])
            .then(([monitoring, children]) => {
                return { monitoring, children };
            })
    }

    private async _getSharedAttributes(intervalNode: SpinalNodeRef): Promise<{ Monitoring: string, IntervalTime: number }> {
        const attributeCategory = "Supervision";

        const realNode = SpinalGraphService.getRealNode(intervalNode.id.get());
        const attributes = await serviceDocumentation.getAttributesByCategory(realNode, attributeCategory);

        return attributes.reduce((obj: { Monitoring: string, IntervalTime: number }, attribute) => {
            const label: string = attribute.label.get();
            const value: string = attribute.value.get();

            if (label === "Monitoring") obj.Monitoring = value;
            else if (label === "IntervalTime") obj.IntervalTime = Number(value);

            return obj;
        }, { Monitoring: "", IntervalTime: 0 });
    }

    private async _getEndpointsObjectIds(intervalNode: SpinalNodeRef): Promise<IObjectId[]> {
        const intervalRealNode = SpinalGraphService.getRealNode(intervalNode.id.get());
        const profileItems = await intervalRealNode.getChildren(["hasIntervalTime"]);

        const promises = profileItems.map(async (item) => {
            const { instance, savetimeseries } = await this._getInstanceAnPriority(item);

            return { instance, savetimeseries, type: this._getBacnetObjectType(item) }
        });

        return Promise.all(promises).then((result) => {
            return result.filter(item => item.instance !== undefined) as unknown as IObjectId[];
        })
    }

    private async _getInstanceAnPriority(item: SpinalNode): Promise<{ instance: number | undefined, savetimeseries: spinal.Model | undefined }> {
        const attributes = await serviceDocumentation.getAttributesByCategory(item, "default");
        const result = { instance: undefined, savetimeseries: undefined };

        for (const attr of attributes) {
            const label = attr.label.get();
            const value = attr.value;

            if (label === "IDX") result.instance = parseInt(value.get()) + 1;

            else if (label.toLowerCase() === "savetimeseries") result.savetimeseries = value;

        }

        return result;
    }

    private _getBacnetObjectType(item: SpinalNode): number {
        const type = item.getType().get();
        const typeToKebabCase = type.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`); // convert camelCase to kebab-case

        const objectName = `object_${typeToKebabCase}`.toUpperCase(); // convert to uppercase
        return BacnetEnum.ObjectTypes[objectName]; // convert type to bacnet object type enum
    }

}

export { ProfileManager };




// async getIntervalsModel(profilId) {
//     return utilities
//         .getProfilIntervals(profilId)
//         .then((result) => {
//             const data = result.map(({ monitoring, children }) => {
//                 return {
//                     monitoring: monitoring.Monitoring,
//                     interval: monitoring.IntervalTime,
//                     children,
//                 };
//             });

//             const profilNode = SpinalGraphService.getRealNode(profilId);
//             return new SpinalMonitorInfoModel(profilNode, data);
//         })
//         .catch((err) => {
//             console.error(err);
//             return;
//         });
// }