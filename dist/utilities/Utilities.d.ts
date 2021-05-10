import { SpinalDevice } from "../modules/SpinalDevice";
import { SpinalDisoverModel, SpinalListenerModel, SpinalOrganConfigModel, SpinalBacnetValueModel } from "spinal-model-bacnet";
export declare const waitModelReady: (spinalContext: any) => any;
export declare const SpinalDiscoverCallback: (spinalDisoverModel: SpinalDisoverModel, organModel: SpinalOrganConfigModel) => void;
export declare const SpinalListnerCallback: (spinalListenerModel: SpinalListenerModel, organModel: SpinalOrganConfigModel) => void;
export declare const SpinalBacnetValueModelCallback: (spinalBacnetValueModel: SpinalBacnetValueModel, organModel: SpinalOrganConfigModel) => void;
export declare const connectionErrorCallback: (err?: any) => never;
export declare const saveAsFile: (obj: SpinalDevice) => Promise<unknown>;
export declare const loadFile: (id: string) => Promise<unknown>;
