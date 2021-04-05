import { SpinalDevice } from "../modules/SpinalDevice";
import { SpinalDisoverModel, SpinalListenerModel, SpinalOrganConfigModel } from "spinal-model-bacnet";
export declare const waitModelReady: (spinalContext: any) => any;
export declare const SpinalDisoverModelConnectionSuccessCallback: (spinalDisoverModel: SpinalDisoverModel, organModel: SpinalOrganConfigModel) => void;
export declare const SpinalDeviceConnectionSuccessCallback: (spinalListenerModel: SpinalListenerModel, organModel: SpinalOrganConfigModel) => void;
export declare const connectionErrorCallback: (err?: any) => never;
export declare const saveAsFile: (obj: SpinalDevice) => Promise<unknown>;
export declare const loadFile: (id: string) => Promise<unknown>;
