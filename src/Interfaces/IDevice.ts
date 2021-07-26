export interface IDevice {
   address?: string;
   deviceId: number;
   maxApdu?: number;
   segmentation?: number;
   vendorId?: number;
}