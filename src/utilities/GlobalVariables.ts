// import * as bacnet from 'bacstack';
import bacnetEnum from "./bacnetEnum";

export const ObjectTypes = bacnetEnum.ObjectTypes;
export const PropertyIds = bacnetEnum.PropertyIds;
export const ENUM_DISABLE = bacnetEnum.EnableDisable;
export const APPLICATION_TAGS = bacnetEnum.ApplicationTags;
export const SEGMENTATIONS = bacnetEnum.Segmentations;


/*
* TYPE of item retrieved to devices
*/
export const SENSOR_TYPES = [
   // ANALOG
   ObjectTypes.OBJECT_ANALOG_INPUT,
   ObjectTypes.OBJECT_ANALOG_OUTPUT,
   ObjectTypes.OBJECT_ANALOG_VALUE,

   // BINARY
   ObjectTypes.OBJECT_BINARY_INPUT,
   ObjectTypes.OBJECT_BINARY_OUTPUT,
   ObjectTypes.OBJECT_BINARY_VALUE,
   ObjectTypes.OBJECT_BINARY_LIGHTING_OUTPUT,

   // MULTI_STATE
   ObjectTypes.OBJECT_MULTI_STATE_INPUT,
   ObjectTypes.OBJECT_MULTI_STATE_OUTPUT,
   ObjectTypes.OBJECT_MULTI_STATE_VALUE,

   //NETWORK
]

/*
* All property object ({name : code}) of device
*/
export const PropertyNames = (function swap(json) {
   var ret = {};
   for (var key in json) {
      ret[json[key]] = key;
   }
   return ret;
})(bacnetEnum.PropertyIds);

/*
* All property object ({code : name}) of device
*/
export const ObjectTypesCode = (function swap(json) {
   var ret = {};
   for (var key in json) {
      ret[json[key]] = key;
   }
   return ret;
})(bacnetEnum.ObjectTypes);

/*
* All property object ({name : code}) of device
*/
export const UNITS_TYPES = (function swap(json) {
   var ret = {};
   for (var key in json) {
      ret[json[key]] = key;
   }
   return ret;
})(bacnetEnum.UnitsId);

