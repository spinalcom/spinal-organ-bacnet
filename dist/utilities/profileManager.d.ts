import { SpinalNode } from "spinal-model-graph";
import { IObjectId } from "../Interfaces";
import EventEmitter = require("node:events");
export type IProfileData = {
    monitoring?: string;
    interval?: number;
    children?: IObjectId[];
};
export default class ProfileManager extends EventEmitter {
    private static instance;
    private _profiles;
    private _isProcessingQueue;
    private constructor();
    static getInstance(): ProfileManager;
    getProfileData(profileSpinalNode: SpinalNode): Promise<IProfileData[]>;
    private _bindProfileNode;
    private _waitIfProcessing;
    private _fetchProfileData;
    private _getProfileContext;
    private _filterIntervals;
    private _getIntervalInfo;
    private _getSharedAttributes;
    private _getEndpointsObjectIds;
    private _getInstanceAnPriority;
    private _getBacnetObjectType;
}
export { ProfileManager };
