import { IRequest } from "spinal-model-bacnet";
declare class SpinalPilot {
    constructor();
    sendPilotRequest(request: any): Promise<void>;
    writeProperties(requests?: IRequest[]): Promise<void>;
    private writeProperty;
    private useDataType;
    private getDataTypes;
}
declare const spinalPilot: SpinalPilot;
export default spinalPilot;
export { spinalPilot };
