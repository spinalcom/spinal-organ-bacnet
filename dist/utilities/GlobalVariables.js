"use strict";
/*
 * Copyright 2022 SpinalCom - www.spinalcom.com
 *
 * This file is part of SpinalCore.
 *
 * Please read all of the following terms and conditions
 * of the Free Software license Agreement ("Agreement")
 * carefully.
 *
 * This Agreement is a legally binding contract between
 * the Licensee (as defined below) and SpinalCom that
 * sets forth the terms and conditions that govern your
 * use of the Program. By installing and/or using the
 * Program, you agree to abide by all the terms and
 * conditions stated or referenced herein.
 *
 * If you do not agree to abide by these terms and
 * conditions, do not demonstrate your acceptance and do
 * not install or use the Program.
 * You should have received a copy of the license along
 * with this file. If not, see
 * <http://resources.spinalcom.com/licenses.pdf>.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNITS_TYPES = exports.ObjectTypesCode = exports.PropertyNames = exports.SENSOR_TYPES = exports.SEGMENTATIONS = exports.APPLICATION_TAGS = exports.ENUM_DISABLE = exports.PropertyIds = exports.ObjectTypes = void 0;
const bacnet = require("bacstack");
exports.ObjectTypes = bacnet.enum.ObjectTypes;
exports.PropertyIds = bacnet.enum.PropertyIds;
exports.ENUM_DISABLE = bacnet.enum.EnableDisable;
exports.APPLICATION_TAGS = bacnet.enum.ApplicationTags;
exports.SEGMENTATIONS = bacnet.enum.Segmentations;
/*
* TYPE of item retrieved to devices
*/
exports.SENSOR_TYPES = [
    // ANALOG
    exports.ObjectTypes.OBJECT_ANALOG_INPUT,
    exports.ObjectTypes.OBJECT_ANALOG_OUTPUT,
    exports.ObjectTypes.OBJECT_ANALOG_VALUE,
    // BINARY
    exports.ObjectTypes.OBJECT_BINARY_INPUT,
    exports.ObjectTypes.OBJECT_BINARY_OUTPUT,
    exports.ObjectTypes.OBJECT_BINARY_VALUE,
    exports.ObjectTypes.OBJECT_BINARY_LIGHTING_OUTPUT,
    // MULTI_STATE
    exports.ObjectTypes.OBJECT_MULTI_STATE_INPUT,
    exports.ObjectTypes.OBJECT_MULTI_STATE_OUTPUT,
    exports.ObjectTypes.OBJECT_MULTI_STATE_VALUE,
];
/*
* All property object ({name : code}) of device
*/
exports.PropertyNames = (function swap(json) {
    var ret = {};
    for (var key in json) {
        ret[json[key]] = key;
    }
    return ret;
})(bacnet.enum.PropertyIds);
/*
* All property object ({code : name}) of device
*/
exports.ObjectTypesCode = (function swap(json) {
    var ret = {};
    for (var key in json) {
        ret[json[key]] = key;
    }
    return ret;
})(bacnet.enum.ObjectTypes);
/*
* All property object ({name : code}) of device
*/
exports.UNITS_TYPES = (function swap(json) {
    var ret = {};
    for (var key in json) {
        ret[json[key]] = key;
    }
    return ret;
})(bacnet.enum.UnitsId);
//# sourceMappingURL=GlobalVariables.js.map