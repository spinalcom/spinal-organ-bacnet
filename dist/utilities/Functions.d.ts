import { SpinalDisoverModel, SpinalListenerModel, SpinalOrganConfigModel, SpinalBacnetValueModel, SpinalPilotModel } from "spinal-model-bacnet";
export declare const connectionErrorCallback: (err?: Error) => void;
export declare const CreateOrganConfigFile: (spinalConnection: any, path: string, connectorName: string) => Promise<SpinalOrganConfigModel>;
export declare const GetPm2Instance: (organName: string) => Promise<unknown>;
export declare const SpinalDiscoverCallback: (spinalDisoverModel: SpinalDisoverModel, organModel: SpinalOrganConfigModel) => Promise<void | boolean>;
export declare const SpinalBacnetValueModelCallback: (spinalBacnetValueModel: SpinalBacnetValueModel, organModel: SpinalOrganConfigModel) => Promise<void | boolean>;
export declare const SpinalListnerCallback: (spinalListenerModel: SpinalListenerModel, organModel: SpinalOrganConfigModel) => Promise<void>;
export declare const SpinalPilotCallback: (spinalPilotModel: SpinalPilotModel, organModel: SpinalOrganConfigModel) => Promise<void>;
