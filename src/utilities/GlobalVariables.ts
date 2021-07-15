import * as bacnet from 'bacstack';

export const ObjectTypes = bacnet.enum.ObjectTypes;
// const PROP_DESCRIPTION = bacnet.enum.PropertyIds.PROP_DESCRIPTION;
export const PropertyIds = bacnet.enum.PropertyIds;
export const ENUM_DISABLE = bacnet.enum.EnableDisable;
export const APPLICATION_TAGS = bacnet.enum.ApplicationTags;


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

export const PropertyNames = (function swap(json) {
   var ret = {};
   for (var key in json) {
      ret[json[key]] = key;
   }
   return ret;
})(bacnet.enum.PropertyIds);

export const ObjectTypesCode = (function swap(json) {
   var ret = {};
   for (var key in json) {
      ret[json[key]] = key;
   }
   return ret;
})(bacnet.enum.ObjectTypes);

export const UNITS_TYPES = (function swap(json) {
   var ret = {};
   for (var key in json) {
      ret[json[key]] = key;
   }
   return ret;
})(bacnet.enum.UnitsId);

