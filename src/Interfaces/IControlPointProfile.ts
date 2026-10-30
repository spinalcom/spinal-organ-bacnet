import type { DeviceCommunicationIndicatorsSnapshot } from "./IDeviceCommunicationIndicators";

export type SnapshotProperty = Exclude<keyof DeviceCommunicationIndicatorsSnapshot, "errorsByCategory" | "cov">;
export type TimeSeriesFormat = "status" | "date" | "number" | "none";

export interface ControlPointEndpointConfig {
	id: string;
	name: string;
	path: string;
	snapshotProperty: SnapshotProperty;
	dataType: string;
	unit?: string;
	timeSeriesFormat: TimeSeriesFormat;
	timeSeriesStatusMap?: Record<string, number>;
}

export interface CommunicationControlProfileConfig {
	id: string;
	name: string;
	relation: string;
	indicatorProfile: string;
	enabledWhen?: string;
	trigger?: string;
	endpoints: ControlPointEndpointConfig[];
}
