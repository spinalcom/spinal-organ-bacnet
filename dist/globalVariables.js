"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNITS_TYPES = exports.ObjectTypesCode = exports.PropertyNames = exports.SENSOR_TYPES = exports.ENUM_DISABLE = exports.PropertyIds = exports.ObjectTypes = void 0;
const bacnet = require("bacstack");
exports.ObjectTypes = bacnet.enum.ObjectTypes;
// const PROP_DESCRIPTION = bacnet.enum.PropertyIds.PROP_DESCRIPTION;
exports.PropertyIds = bacnet.enum.PropertyIds;
exports.ENUM_DISABLE = bacnet.enum.EnableDisable;
exports.SENSOR_TYPES = [
    // ANALOG
    exports.ObjectTypes.OBJECT_ANALOG_INPUT,
    exports.ObjectTypes.OBJECT_ANALOG_OUTPUT,
    exports.ObjectTypes.OBJECT_ANALOG_VALUE,
    // BINARY
    exports.ObjectTypes.OBJECT_BINARY_INPUT,
    // ObjectTypes.OBJECT_BINARY_OUTPUT,
    exports.ObjectTypes.OBJECT_BINARY_VALUE,
    // ObjectTypes.OBJECT_BINARY_LIGHTING_OUTPUT,
    // MULTI_STATE
    exports.ObjectTypes.OBJECT_MULTI_STATE_INPUT,
    // ObjectTypes.OBJECT_MULTI_STATE_OUTPUT,
    exports.ObjectTypes.OBJECT_MULTI_STATE_VALUE,
];
exports.PropertyNames = (function swap(json) {
    var ret = {};
    for (var key in json) {
        ret[json[key]] = key;
    }
    return ret;
})(bacnet.enum.PropertyIds);
exports.ObjectTypesCode = (function swap(json) {
    var ret = {};
    for (var key in json) {
        ret[json[key]] = key;
    }
    return ret;
})(bacnet.enum.ObjectTypes);
exports.UNITS_TYPES = (function swap(json) {
    var ret = {};
    for (var key in json) {
        ret[json[key]] = key;
    }
    return ret;
})(bacnet.enum.UnitsId);
//# sourceMappingURL=globalVariables.js.map