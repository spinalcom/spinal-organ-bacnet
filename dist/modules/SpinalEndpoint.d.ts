export declare class SpinalEndpoint {
    private id;
    private currentValue;
    private client;
    private objectId;
    private deviceAddress;
    constructor(client: any, deviceAddress: string, objectId: {
        type: number;
        instance: number;
    }, currentValue: number | string | boolean);
    checkAndUpdateCurrentValue(): Promise<unknown>;
}
