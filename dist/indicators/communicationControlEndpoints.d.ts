import { InputDataEndpoint } from "spinal-model-bmsnetwork";
import { DeviceCommunicationIndicatorsSnapshot } from "./DeviceCommunicationIndicators";
export declare const COMMUNICATION_CONTROL_ENDPOINT_GROUP_ID = "bacnet_indicators_BACnet device indicators";
export declare const COMMUNICATION_CONTROL_ENDPOINT_GROUP_NAME = "BACnet device indicators";
export declare const COMMUNICATION_CONTROL_ENDPOINT_GROUP_RELATION = "hasControlPoints";
export declare const COMMUNICATION_CONTROL_ENDPOINT_PROFILE = "BACnet device indicators";
export declare function getCommunicationControlEndpoints(snapshot: DeviceCommunicationIndicatorsSnapshot): InputDataEndpoint[];
export declare function getCommunicationControlEndpointTimeSeriesValue(endpointId: string, value: InputDataEndpoint["currentValue"]): number | undefined;
