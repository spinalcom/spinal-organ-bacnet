import { SpinalNode } from "spinal-model-graph";
import { DeviceProfileUtilities } from "spinal-env-viewer-plugin-network-tree-service"
import { SpinalGraphService, SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { serviceDocumentation } from "spinal-env-viewer-plugin-documentation-service";
import { BacnetEnum } from "./bacnetEnum";
import { IObjectId } from "../Interfaces";



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

export default class ProfileManager {
    private static instance: ProfileManager;
    private _profiles: Map<string, IProfileData[]>;
    private _isProcessingQueue: boolean = false;

    private constructor() {
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

        this._isProcessingQueue = true;
        const data = await this._fetchProfileData(profileSpinalNode);
        this._profiles.set(profileId, data);
        this._isProcessingQueue = false;

        return data;
    }

    private async _waitIfProcessing(): Promise<void> {
        while (this._isProcessingQueue) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }


    private async _fetchProfileData(profileNode: SpinalNode): Promise<IProfileData[]> {
        SpinalGraphService._addNode(profileNode);
        const profileId = profileNode.getId().get();

        const intervalsNodes = await DeviceProfileUtilities.getIntervalNodes(profileId);
        const promises = intervalsNodes.map((intervalNode) => this._getIntervalInfo(intervalNode));

        return Promise.all(promises).then((result) => this._filterIntervals(result));
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

        const promises = profileItems.map(async (item) => ({ instance: await this._getIDX(item), type: this._getBacnetObjectType(item) }));

        return Promise.all(promises).then((result) => {
            return result.filter(item => item.instance !== undefined) as IObjectId[];
        })
    }

    private async _getIDX(item: SpinalNode): Promise<| number | undefined> {
        const attributes = await serviceDocumentation.getAttributesByCategory(item, "default");
        const foundAttribute = attributes.find(attr => attr.label.get() === "IDX");

        // +1 because profile is 1 indexed and bacnet is 0 indexed;
        if (foundAttribute) return parseInt(foundAttribute.value.get()) + 1;
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