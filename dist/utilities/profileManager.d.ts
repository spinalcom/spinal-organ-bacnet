import { SpinalNode } from "spinal-model-graph";
import { IObjectId } from "../Interfaces";
export type IProfileData = {
    monitoring?: string;
    interval?: number;
    children?: IObjectId[];
};
export default class ProfileManager {
    private static instance;
    private _profiles;
    private _isProcessingQueue;
    private constructor();
    static getInstance(): ProfileManager;
    getProfileData(profileSpinalNode: SpinalNode): Promise<IProfileData[]>;
    private _waitIfProcessing;
    private _fetchProfileData;
    private _filterIntervals;
    private _getIntervalInfo;
    private _getSharedAttributes;
    private _getEndpointsObjectIds;
    private _getIDX;
    private _getBacnetObjectType;
}
export { ProfileManager };
