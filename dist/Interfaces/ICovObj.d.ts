import { SpinalDevice } from "../modules/SpinalDevice";
import { IObjectId } from "./IObjectId";
export interface ICovData {
    spinalDevice: SpinalDevice;
    children: IObjectId[];
}
export interface ICovSubscribeReq {
    ip: string;
    object: IObjectId;
}
