export interface ISADR {
   type: number;
   net: number;
   adr: Array<number>;
}

export interface IDevice {
   address?: string;
   deviceId: number;
   maxApdu?: number;
   segmentation?: number;
   vendorId?: number;
   SADR?: ISADR
}