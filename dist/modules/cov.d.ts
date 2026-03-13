export type EventPayload = {
    error?: {
        message: string;
    };
    key?: string;
    data?: any;
    eventName: string;
};
export declare function listenEventMessage(): void;
export declare function sendEvent(data: EventPayload): void;
