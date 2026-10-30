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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpinalNetworkUtilities = void 0;
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const spinal_model_graph_1 = require("spinal-model-graph");
const spinal_env_viewer_plugin_documentation_service_1 = require("spinal-env-viewer-plugin-documentation-service");
const spinal_models_documentation_1 = require("spinal-models-documentation");
const SpinalDevice_1 = require("../modules/SpinalDevice");
const GlobalVariables_1 = require("./GlobalVariables");
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const Functions_1 = require("./Functions");
const debugLog_1 = require("./debugLog");
const communicationControlEndpoints_1 = require("../indicators/communicationControlEndpoints");
const bmsTypeNames = [spinal_model_bmsnetwork_1.SpinalBmsNetwork.nodeTypeName, spinal_model_bmsnetwork_1.SpinalBmsDevice.nodeTypeName, spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.nodeTypeName, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.nodeTypeName];
class SpinalNetworkUtilitiesClass {
    constructor() {
        this._timeSeriesService = null;
    }
    static getIntance() {
        if (!this._instance)
            this._instance = new SpinalNetworkUtilitiesClass();
        return this._instance;
    }
    ////////////////////////////////////////////////////////////////////////
    ////              INITIALIZATION FUNCTIONS FOR MODELS              ////
    ////////////////////////////////////////////////////////////////////////
    initSpinalDiscoverNetwork(spinalModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const { graph, organ, context } = yield this._getSpinalDiscoverModel(spinalModel);
            const network = yield this._getOrCreateNetworkNode(context, organ, spinalModel.network.get());
            return { graph, context, organ, network };
        });
    }
    getTimeSeriesInstance() {
        if (!this._timeSeriesService)
            this._timeSeriesService = new spinal_model_bmsnetwork_1.SpinalServiceTimeseries();
        return this._timeSeriesService;
    }
    updateCommunicationControlEndpoints(deviceNode_1, snapshot_1) {
        return __awaiter(this, arguments, void 0, function* (deviceNode, snapshot, recordTimeSeries = true, trigger) {
            var _a, _b, _c;
            for (const profile of communicationControlEndpoints_1.COMMUNICATION_CONTROL_PROFILES) {
                if (trigger ? profile.trigger !== trigger : Boolean(profile.trigger))
                    continue;
                const flagValue = profile.enabledWhen ? (_a = process.env[profile.enabledWhen]) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase() : undefined;
                if (profile.enabledWhen && flagValue !== "1" && flagValue !== "true")
                    continue;
                const existingGroups = yield deviceNode.getChildren([profile.relation]);
                let groupNode = existingGroups.find((group) => { var _a, _b; return ((_b = (_a = group.info) === null || _a === void 0 ? void 0 : _a.idNetwork) === null || _b === void 0 ? void 0 : _b.get()) === profile.id; });
                const groupInfo = {
                    id: profile.id,
                    name: profile.name,
                    type: spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.nodeTypeName,
                    path: "",
                    indicatorProfile: profile.indicatorProfile,
                };
                if (groupNode) {
                    yield this.updateControlPointNode(groupNode, groupInfo);
                }
                else {
                    groupNode = yield this.createControlPointNode(groupInfo, spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.nodeTypeName);
                    yield deviceNode.addChild(groupNode, profile.relation, spinal_model_graph_1.SPINAL_RELATION_PTR_LST_TYPE);
                }
                const existingEndpoints = yield groupNode.getChildren([spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName]);
                const endpointsById = new Map();
                for (const endpointNode of existingEndpoints) {
                    const id = (_c = (_b = endpointNode.info) === null || _b === void 0 ? void 0 : _b.idNetwork) === null || _c === void 0 ? void 0 : _c.get();
                    if (typeof id === "string" && id.length > 0)
                        endpointsById.set(id, endpointNode);
                }
                const endpointInfos = (0, communicationControlEndpoints_1.getCommunicationControlEndpoints)(snapshot, profile);
                const historyTimestamp = Date.now();
                yield Promise.all(endpointInfos.map((endpointInfo) => __awaiter(this, void 0, void 0, function* () {
                    const existingEndpoint = endpointsById.get(endpointInfo.id);
                    let endpointNode = existingEndpoint;
                    if (existingEndpoint) {
                        const element = yield existingEndpoint.getElement(true);
                        if (!element)
                            throw new Error(`Failed to load control endpoint "${endpointInfo.name}"`);
                        const hasChanges = Object.entries(endpointInfo).some(([key, value]) => {
                            const modelValue = element[key];
                            const currentValue = modelValue && typeof modelValue.get === "function" ? modelValue.get() : modelValue;
                            return !Object.is(currentValue, value);
                        });
                        if (hasChanges)
                            yield this.updateControlPointNode(existingEndpoint, endpointInfo);
                    }
                    else {
                        endpointNode = yield this.createControlPointNode(endpointInfo, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.nodeTypeName);
                        endpointNode = yield groupNode.addChild(endpointNode, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName, spinal_model_graph_1.SPINAL_RELATION_PTR_LST_TYPE);
                    }
                    const value = (0, communicationControlEndpoints_1.getCommunicationControlEndpointTimeSeriesValue)(endpointInfo.id, endpointInfo.currentValue, profile);
                    if (recordTimeSeries && typeof value === "number") {
                        spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(endpointNode);
                        const saved = yield this.getTimeSeriesInstance().insertFromEndpoint(endpointNode.getId().get(), value, historyTimestamp);
                        if (!saved)
                            throw new Error(`Failed to record time series for control endpoint "${endpointInfo.name}"`);
                    }
                })));
                const currentEndpointIds = new Set(endpointInfos.map((endpointInfo) => endpointInfo.id));
                const obsoleteEndpoints = existingEndpoints.filter((endpointNode) => {
                    var _a, _b;
                    const id = (_b = (_a = endpointNode.info) === null || _a === void 0 ? void 0 : _a.idNetwork) === null || _b === void 0 ? void 0 : _b.get();
                    return typeof id === "string" && /^bacnet_(?:indicator|ping)_/.test(id) && !currentEndpointIds.has(id);
                });
                yield Promise.all(obsoleteEndpoints.map((endpointNode) => groupNode.removeChild(endpointNode, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName, spinal_model_graph_1.SPINAL_RELATION_PTR_LST_TYPE)));
            }
        });
    }
    initSpinalBacnetValueModel(spinalModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const { node, context, network, organ } = yield spinalModel.getAllItem();
            // if (node) SpinalGraphService._addNode(node);
            // if (context) SpinalGraphService._addNode(context);
            // if (graph) SpinalGraphService._addNode(graph);
            // if (network) SpinalGraphService._addNode(network);
            // const networkService: NetworkService = new NetworkService(false);
            // const organNetwork = {
            //    contextName: context.getName().get(),
            //    contextType: context.getType().get(),
            //    networkType: network.getType().get(),
            //    networkName: network.getName().get()
            // };
            // await networkService.init(graph, organNetwork);
            return { device: node, context, network, organ };
        });
    }
    initSpinalListenerModel(spinalModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const spinalDevice = new SpinalDevice_1.SpinalDevice();
            yield spinalDevice.initExistingDevice(spinalModel);
            return spinalDevice;
        });
    }
    /////////////////////////////////////////////////////////////
    //                BMS NETWORK FUNCTIONS                    //
    /////////////////////////////////////////////////////////////
    updateEndpointInGraph(spinalDevice, children) {
        return __awaiter(this, void 0, void 0, function* () {
            const deviceNode = spinalDevice.getBmsDeviceNode();
            if (!deviceNode)
                throw new Error("Device node not found in graph");
            const endpointsObj = yield this._getAllEndpointsInGraph(deviceNode);
            const updates = [];
            for (const child of children) {
                const endpointKey = `${child.type}_${child.id}`;
                const endpointNode = endpointsObj[endpointKey];
                if (endpointNode) {
                    const saveTimeSeries = spinalDevice.shouldSaveTimeSeries({ instance: child.id, type: child.type });
                    updates.push({
                        endpointNode,
                        currentValue: child.currentValue,
                        promise: this._updateEndpointNodeValue(endpointNode, child.currentValue, saveTimeSeries),
                    });
                }
                else {
                    console.error(`[updateEndpointInGraph] [${spinalDevice.Name}] - Endpoint ${child.id} of type ${child.type} not found in graph`);
                }
            }
            return this._handleEndpointUpdatesAndLogResponse(updates, spinalDevice);
        });
    }
    _handleEndpointUpdatesAndLogResponse(updates, spinalDevice) {
        return Promise.allSettled(updates.map(({ promise }) => promise)).then((results) => {
            return results.map((result, index) => {
                const { endpointNode, currentValue } = updates[index];
                const endpointName = endpointNode.getName().get();
                if (result.status === "fulfilled") {
                    console.log(`[mapCallback] [_handleEndpointUpdatesAndLogResponse] [${spinalDevice.Name}] - "${endpointName}" updated successfully with value: ${currentValue}`);
                    return result.value;
                }
                console.error(`[mapCallback] [_handleEndpointUpdatesAndLogResponse] [${spinalDevice.Name}] - Failed to update "${endpointName}"`);
                return false;
            });
        });
    }
    _updateEndpointNodeValue(endpointNode_1, newValue_1) {
        return __awaiter(this, arguments, void 0, function* (endpointNode, newValue, saveTimeSeries = false, itsBitStringChild = false) {
            const element = yield endpointNode.getElement(true);
            if (!element) {
                console.error(`[updateEndpointNodeValue] - Failed to get element for endpoint node: ${endpointNode.getName().get()}`);
                return false;
            }
            if (element.currentValue)
                element.currentValue.set(newValue);
            if (endpointNode.info.currentValue)
                endpointNode.info.currentValue.set(newValue);
            if (saveTimeSeries && (typeof newValue === "number" || typeof newValue === "boolean" || !isNaN(newValue))) {
                spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(endpointNode);
                const timeSeriesService = this.getTimeSeriesInstance();
                yield timeSeriesService.pushFromEndpoint(endpointNode.getId().get(), Number(newValue));
            }
            const { typeId } = endpointNode.info.get();
            if (typeId === GlobalVariables_1.ObjectTypes.OBJECT_BITSTRING_VALUE && !itsBitStringChild) {
                yield this.updateBitStringEndpointValue(endpointNode, newValue);
            }
            return true;
        });
    }
    _getAllEndpointsInGraph(deviceNode) {
        return __awaiter(this, void 0, void 0, function* () {
            const endpointGroups = yield deviceNode.getChildren([spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.relationName]);
            const promises = endpointGroups.map((group) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                const endpointsObj = {};
                const typeId = (_b = (_a = group.info) === null || _a === void 0 ? void 0 : _a.idNetwork) === null || _b === void 0 ? void 0 : _b.get();
                const children = yield group.getChildren([spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName]);
                children.forEach((child) => {
                    var _a, _b;
                    const idNetwork = (_b = (_a = child.info) === null || _a === void 0 ? void 0 : _a.idNetwork) === null || _b === void 0 ? void 0 : _b.get();
                    if (typeof idNetwork !== "undefined" && idNetwork !== null)
                        endpointsObj[`${typeId}_${idNetwork}`] = child;
                });
                return endpointsObj;
            }));
            return Promise.allSettled(promises).then((results) => {
                return results.reduce((acc, result) => {
                    if (result.status === "fulfilled")
                        return Object.assign(Object.assign({}, acc), result.value);
                    return acc;
                }, {});
            });
        });
    }
    createEndpointsInGroup(context, device, endpointGroupName, endpointArray) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const endpointGroup = yield this._createEndpointsGroup(context, device, endpointGroupName);
            const deviceName = (_b = (_a = device.info) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.get();
            // const groupId = endpointGroup.id.get();
            const endpointsNode = yield this._createEndpointByArray(context, endpointGroup, endpointArray, deviceName);
            if (((_d = (_c = endpointGroup.info) === null || _c === void 0 ? void 0 : _c.idNetwork) === null || _d === void 0 ? void 0 : _d.get()) == GlobalVariables_1.ObjectTypes.OBJECT_BITSTRING_VALUE) {
                yield this._createBitStringSubEndpoints(context, endpointsNode, deviceName);
            }
            return endpointsNode;
        });
    }
    _createEndpointsGroup(context, deviceNode, endpointGroupName) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const groupNetworkId = GlobalVariables_1.ObjectTypes[`object_${endpointGroupName}`.toUpperCase()];
            const deviceName = (_b = (_a = deviceNode.info) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.get();
            const alreadyExist = yield this._itemExistInChild(deviceNode, spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.relationName, groupNetworkId);
            const groupInfo = {
                name: endpointGroupName,
                id: groupNetworkId,
                type: spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.nodeTypeName,
                path: "",
            };
            if (alreadyExist) {
                (0, debugLog_1.debugLog)(`[_createEndpointsGroup] ${deviceName} - endpoint group "${endpointGroupName}" already exists, updating it, with info:`, groupInfo);
                return this.updateNetworkElementNode(alreadyExist, groupInfo);
            }
            (0, debugLog_1.debugLog)(`[_createEndpointsGroup] ${deviceName} - creating endpoint group "${endpointGroupName}" with info:`, groupInfo);
            const endpointGroup = yield this.createNetworkElementNode(groupInfo, spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.nodeTypeName);
            return deviceNode.addChildInContext(endpointGroup, spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.relationName, spinal_model_graph_1.SPINAL_RELATION_PTR_LST_TYPE, context);
        });
    }
    _createBitStringSubEndpoints(context, endpointsNode, deviceName) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = endpointsNode.map((endpointNode) => __awaiter(this, void 0, void 0, function* () { return this._createOrUpdateEndpointsByBitStringValue(context, endpointNode, deviceName); }));
            return Promise.allSettled(promises).then((results) => {
                return results.filter((result) => result.status === "fulfilled").map((result) => result.value);
            });
        });
    }
    _createOrUpdateEndpointsByBitStringValue(context, endpointNode, deviceName) {
        return __awaiter(this, void 0, void 0, function* () {
            const element = yield endpointNode.getElement(true);
            const bitText = element.bit_text.get();
            const value = element.currentValue.get();
            const convertedValueToEndpointInfo = this._convertBitStringValueToEndpointInfo(value, bitText, endpointNode.info.get());
            return this._createEndpointByArray(context, endpointNode, convertedValueToEndpointInfo, deviceName).then(() => endpointNode);
        });
    }
    updateBitStringEndpointValue(endpointNode_1, newValue_1) {
        return __awaiter(this, arguments, void 0, function* (endpointNode, newValue, saveTimeSeries = false) {
            const children = yield endpointNode.getChildren([spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName]);
            const childrenObj = children.reduce((acc, child) => {
                var _a, _b;
                const idNetwork = (_b = (_a = child.info) === null || _a === void 0 ? void 0 : _a.idNetwork) === null || _b === void 0 ? void 0 : _b.get();
                if (typeof idNetwork === "undefined" || idNetwork === null)
                    return acc;
                return Object.assign(Object.assign({}, acc), { [idNetwork]: child });
            }, {});
            const bitText = (yield endpointNode.getElement(true)).bit_text.get();
            const convertedValueToEndpointInfo = this._convertBitStringValueToEndpointInfo(newValue, bitText, endpointNode.info.get());
            const promises = [];
            for (const endpoint of convertedValueToEndpointInfo) {
                const childFound = childrenObj[endpoint.id];
                if (childFound)
                    promises.push(this._updateEndpointNodeValue(childFound, endpoint.currentValue, saveTimeSeries, true));
            }
            return Promise.allSettled(promises).then((results) => {
                return endpointNode;
            });
        });
    }
    _convertBitStringValueToEndpointInfo(value, bitText, parentInfo) {
        const bitStringArray = (0, Functions_1.decodeBitStringValue)(value, bitText);
        return bitStringArray.map((bit) => ({
            id: `${parentInfo.idNetwork}_${bit.id}`,
            typeId: parentInfo.typeId,
            path: ` ${parentInfo.name}/${bit.name}`,
            currentValue: bit.value,
            present_value: bit.value,
            name: bit.name,
            type: spinal_model_bmsnetwork_1.SpinalBmsEndpoint.nodeTypeName,
        }));
    }
    _createEndpointByArray(context, groupNode, endpointArray, deviceName) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const endpointAlreadyCreated = yield this._getChildrenAsObj(groupNode, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName);
            const groupName = (_b = (_a = groupNode.info) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.get();
            const promises = endpointArray.map((endpointInfo) => __awaiter(this, void 0, void 0, function* () {
                endpointInfo = this._formatEndpointCreationInfo(endpointInfo);
                const endpointInfoIsValid = this._checkIfInfoIsValid(endpointInfo, deviceName, groupName);
                if (!endpointInfoIsValid.valid) {
                    throw `A required endpoint information is not valid: ${endpointInfoIsValid.message}`;
                }
                const existingEndpoint = endpointAlreadyCreated[endpointInfo.id];
                if (existingEndpoint) {
                    (0, debugLog_1.debugLog)(`[mapCallback] [_createEndpointByArray] [${deviceName}] - [${groupName}] - endpoint "${endpointInfo.name}" already exists, updating it with new info`, endpointInfo);
                    return this.updateNetworkElementNode(existingEndpoint, endpointInfo);
                }
                (0, debugLog_1.debugLog)(`[mapCallback] [_createEndpointByArray] [${deviceName}] - [${groupName}] - creating endpoint "${endpointInfo.name}" with info`, endpointInfo);
                const node = yield this.createNetworkElementNode(endpointInfo, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.nodeTypeName);
                return groupNode.addChildInContext(node, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName, spinal_model_graph_1.SPINAL_RELATION_PTR_LST_TYPE, context);
            }));
            return Promise.allSettled(promises).then((results) => {
                const result = [];
                let index = 0;
                for (const res of results) {
                    if (res.status === "fulfilled")
                        result.push(res.value);
                    else {
                        endpointArray[index] && console.error(`[thenCallback] [_createEndpointByArray] Failed to create/update endpoint "${endpointArray[index].name}"`, res.reason);
                    }
                    index++;
                }
                return result;
            });
        });
    }
    _formatEndpointCreationInfo(endpointInfo) {
        var _a, _b, _c, _d;
        return Object.assign({ id: (_a = endpointInfo.id) !== null && _a !== void 0 ? _a : endpointInfo.instance, typeId: endpointInfo.typeId, path: endpointInfo.path || "", currentValue: (_b = endpointInfo.currentValue) !== null && _b !== void 0 ? _b : endpointInfo.present_value, name: endpointInfo.name || endpointInfo.object_name, type: spinal_model_bmsnetwork_1.SpinalBmsEndpoint.nodeTypeName, description: endpointInfo.description, max_pres_value: (_c = endpointInfo.max_pres_value) !== null && _c !== void 0 ? _c : "", min_pres_value: (_d = endpointInfo.min_pres_value) !== null && _d !== void 0 ? _d : "", unit: endpointInfo.unit || "" }, (endpointInfo.bit_text && { bit_text: endpointInfo.bit_text }));
    }
    updateNetworkElementNode(node, newInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            (0, debugLog_1.debugLog)(`[updateNetworkElementNode] Updating ${(_b = (_a = node.info) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.get()}`, newInfo);
            return this._updateNetworkElementNode(node, newInfo);
        });
    }
    updateControlPointNode(node, newInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const name = (_b = (_a = node.info) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.get();
            // debugLog(`[updateControlPointNode] Starting update of "${name}"`);
            try {
                return yield this._updateNetworkElementNode(node, newInfo, true);
            }
            finally {
                // debugLog(`[updateControlPointNode] Finished update of "${name}"`);
            }
        });
    }
    _updateNetworkElementNode(node_1, newInfo_1) {
        return __awaiter(this, arguments, void 0, function* (node, newInfo, isControlPoint = false) {
            const element = yield node.getElement(true);
            this._updateElementInfo(element, newInfo, isControlPoint);
            this._modifyNodeInfo(node, element, isControlPoint);
            yield this._createOrUpdateAttributesFromElement(node, element);
            return node;
        });
    }
    createNetworkElementNode(nodeInfo, type) {
        return __awaiter(this, void 0, void 0, function* () {
            const element = this._createBmsElementFromType(nodeInfo, type);
            if (!element)
                throw new Error(`Unsupported BMS node type: ${type}`);
            return this._createBmsNodeFromElement(element);
        });
    }
    createControlPointNode(nodeInfo, type) {
        return __awaiter(this, void 0, void 0, function* () {
            const name = nodeInfo.name;
            (0, debugLog_1.debugLog)(`[createControlPointNode] Starting creation of "${name}" (${type})`);
            try {
                if (type !== spinal_model_bmsnetwork_1.SpinalBmsEndpoint.nodeTypeName && type !== spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.nodeTypeName) {
                    throw new Error(`Unsupported control point node type: ${type}`);
                }
                const element = this._createBmsElementFromType(nodeInfo, type);
                if (!element)
                    throw new Error(`Failed to create control point node of type: ${type}`);
                return yield this._createBmsNodeFromElement(element, true);
            }
            finally {
                (0, debugLog_1.debugLog)(`[createControlPointNode] Finished creation of "${name}" (${type})`);
            }
        });
    }
    _updateElementInfo(element, newInfo, isControlPoint = false) {
        const updateAttribute = isControlPoint ? this._checkIfValueIsValidAndUpdateControlPoint.bind(this) : this._checkIfValueIsValidAndUpdate.bind(this);
        for (const key in newInfo) {
            const value = newInfo[key];
            updateAttribute(element, key, value, element.name.get());
        }
    }
    _createBmsElementFromType(nodeInfo, type) {
        nodeInfo.type = type;
        switch (type) {
            case spinal_model_bmsnetwork_1.SpinalBmsNetwork.nodeTypeName:
                return new spinal_model_bmsnetwork_1.SpinalBmsNetwork(nodeInfo.name, type);
            case spinal_model_bmsnetwork_1.SpinalBmsDevice.nodeTypeName:
                return new spinal_model_bmsnetwork_1.SpinalBmsDevice(nodeInfo);
            case spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.nodeTypeName:
                return new spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup(nodeInfo);
            case spinal_model_bmsnetwork_1.SpinalBmsEndpoint.nodeTypeName:
                return new spinal_model_bmsnetwork_1.SpinalBmsEndpoint(nodeInfo);
        }
    }
    _createBmsNodeFromElement(element_1) {
        return __awaiter(this, arguments, void 0, function* (element, isControlPoint = false) {
            const name = element.name.get();
            const type = element.type.get();
            const node = new spinal_model_graph_1.SpinalNode(name, type, element);
            this._modifyNodeInfo(node, element, isControlPoint);
            yield this._createOrUpdateAttributesFromElement(node, element);
            return node;
        });
    }
    _modifyNodeInfo(node, element, isControlPoint = false) {
        const attribuesToMod = element._attribute_names;
        const updateAttribute = isControlPoint ? this._checkIfValueIsValidAndUpdateControlPoint.bind(this) : this._checkIfValueIsValidAndUpdate.bind(this);
        for (let attr of attribuesToMod) {
            let newValue = element[attr];
            if (attr === "id")
                attr = "idNetwork"; // Rename "id" attribute to "idNetwork" for the node info
            // If the attribute is "type" and its value is "device", replace it with the SpinalBmsDevice node type name.
            // it ensures that the node info correctly reflects the specific type for devices.
            if (attr === "type" && newValue == "device")
                newValue = spinal_model_bmsnetwork_1.SpinalBmsDevice.nodeTypeName;
            updateAttribute(node.info, attr, newValue, node.getName().get());
        }
    }
    _createOrUpdateAttributesFromElement(node, nodeElement) {
        return __awaiter(this, void 0, void 0, function* () {
            const attributes = nodeElement._attribute_names;
            const { element } = yield spinal_env_viewer_plugin_documentation_service_1.serviceDocumentation.addCategoryAttribute(node, "default");
            const existingAttributes = _convertSpinalAttributeListToObj(element);
            for (const attr of attributes) {
                let spinalAttr = existingAttributes[attr];
                let value = nodeElement[attr].get();
                if (!spinalAttr) {
                    // use .get because attributeService need a string as value
                    spinalAttr = new spinal_models_documentation_1.SpinalAttribute(attr, value);
                    element.push(spinalAttr);
                    existingAttributes[attr] = spinalAttr;
                    continue;
                }
                spinalAttr.value.set(value);
            }
            function _convertSpinalAttributeListToObj(element) {
                const obj = {};
                for (let i = 0; i < element.length; i++) {
                    const attrName = element[i].label.get();
                    obj[attrName] = element[i];
                }
                return obj;
            }
        });
    }
    _getSpinalDiscoverModel(discoverModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = [discoverModel.getGraph(), discoverModel.getContext(), discoverModel.getOrgan()];
            const [graph, context, organ] = yield Promise.all(promises);
            // const organ = {
            //    contextName: context.getName().get(),
            //    contextType: context.getType().get(),
            //    networkType: organNode.getType().get(),
            //    networkName: organNode.getName().get()
            // };
            return { graph, organ, context };
        });
    }
    _getOrCreateNetworkNode(context, organ, networkInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const children = yield organ.getChildrenInContext(context);
            for (const child of children) {
                if (child.getName().get() === networkInfo.name) {
                    return child;
                }
            }
            const name = networkInfo.name;
            const type = spinal_model_bmsnetwork_1.SpinalBmsNetwork.nodeTypeName;
            const element = new spinal_model_bmsnetwork_1.SpinalBmsNetwork(name, type);
            const networkNode = new spinal_model_graph_1.SpinalNode(name, type, element);
            return organ.addChildInContext(networkNode, spinal_model_bmsnetwork_1.SpinalBmsNetwork.relationName, spinal_model_graph_1.SPINAL_RELATION_PTR_LST_TYPE, context);
        });
    }
    _itemExistInChild(parentNode, relationName, childNetworkId) {
        return __awaiter(this, void 0, void 0, function* () {
            const children = yield parentNode.getChildren([relationName]);
            const found = children.find((el) => { var _a, _b; return ((_b = (_a = el.info) === null || _a === void 0 ? void 0 : _a.idNetwork) === null || _b === void 0 ? void 0 : _b.get()) == childNetworkId; });
            return found;
        });
    }
    _getChildrenAsObj(parentNode, relationName) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const children = yield parentNode.getChildren([relationName]);
            const childObj = {};
            const promises = [];
            for (const child of children) {
                if (this._existingNodeIsInvalid(child)) {
                    // remove invalid child node
                    promises.push(parentNode.removeChild(child, relationName, spinal_model_graph_1.SPINAL_RELATION_PTR_LST_TYPE));
                    continue;
                }
                const networkId = (_b = (_a = child.info) === null || _a === void 0 ? void 0 : _a.idNetwork) === null || _b === void 0 ? void 0 : _b.get();
                if (typeof networkId !== "undefined" && networkId !== null)
                    childObj[networkId] = child;
            }
            return Promise.allSettled(promises)
                .then(() => childObj)
                .catch((error) => childObj);
        });
    }
    _existingNodeIsInvalid(child) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        if (!((_a = child.info) === null || _a === void 0 ? void 0 : _a.idNetwork) || ((_c = (_b = child.info) === null || _b === void 0 ? void 0 : _b.idNetwork) === null || _c === void 0 ? void 0 : _c.get().toString().trim()) == "")
            return true;
        if (!((_d = child.info) === null || _d === void 0 ? void 0 : _d.name) || ((_f = (_e = child.info) === null || _e === void 0 ? void 0 : _e.name) === null || _f === void 0 ? void 0 : _f.get().toString().trim()) == "")
            return true;
        if (!((_g = child.info) === null || _g === void 0 ? void 0 : _g.typeId) || ((_j = (_h = child.info) === null || _h === void 0 ? void 0 : _h.typeId) === null || _j === void 0 ? void 0 : _j.get().toString().trim()) == "")
            return true;
        return false;
    }
    loadPtrValue(ptrModel) {
        return new Promise((resolve) => {
            ptrModel.load((data) => resolve(data));
        });
    }
    _checkIfValueIsValidAndUpdateControlPoint(model, attr, newValue, deviceName = "") {
        this._checkIfValueIsValidAndUpdate(model, attr, newValue, deviceName, false);
    }
    _checkIfValueIsValidAndUpdate(model, attr, newValue, deviceName = "", logUpdate = true) {
        try {
            if (newValue === undefined || newValue === null)
                return;
            const attrToNotUpdateIfEmpty = ["name", "type", "idNetwork", "currentValue"];
            if (attrToNotUpdateIfEmpty.includes(attr) && (newValue.toString().trim() === "" || typeof newValue === "undefined" || newValue === null))
                return;
            if (newValue === model[attr])
                return;
            if (model[attr]) {
                const v = typeof (newValue === null || newValue === void 0 ? void 0 : newValue.get) == "function" ? newValue.get() : newValue;
                if (logUpdate)
                    (0, debugLog_1.debugLog)(`[_checkIfValueIsValidAndUpdate] [${deviceName}] [${model[attr]._server_id}] updating attribute "${attr}"  with value "${v}"`);
                model.mod_attr(attr, newValue);
            }
            else if (!model[attr]) {
                const v = typeof (newValue === null || newValue === void 0 ? void 0 : newValue.get) == "function" ? newValue.get() : newValue;
                if (logUpdate)
                    (0, debugLog_1.debugLog)(`[_checkIfValueIsValidAndUpdate] [${deviceName}] updating attribute "${attr}" with value "${v}"`);
                model.add_attr({ [attr]: newValue });
            }
        }
        catch (error) {
            // console.log(`[${model._server_id}] - Failed to set attribute "${attr}"   on node "${deviceName}" due to:`, error.message);
            console.error(`[SpinalNetworkUtilities] [${model._server_id}] Failed to set attribute "${attr}" on node "${deviceName}"`, error);
        }
    }
    _endpointCanBeCreate(endpointData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!endpointData)
                return false;
            if (!endpointData.name || endpointData.name.toString().trim() === "")
                return false;
            if (!endpointData.type || endpointData.type.toString().trim() === "")
                return false;
            if (typeof endpointData.currentValue === "undefined" || endpointData.currentValue === undefined)
                return false;
            return true;
        });
    }
    _checkIfInfoIsValid(endpointInfo, deviceName, groupName) {
        if (!endpointInfo)
            return { valid: false, message: "Endpoint info is missing" };
        const prefix = `[${deviceName} --> ${groupName} --> ${endpointInfo.typeId}_${endpointInfo.id}]`;
        if (!endpointInfo.name || endpointInfo.name.toString().trim() === "")
            return { valid: false, message: `${prefix} - Endpoint name is missing or empty` };
        if (!endpointInfo.type || endpointInfo.type.toString().trim() === "")
            return { valid: false, message: `${prefix} - Endpoint type is missing or empty` };
        if (endpointInfo.id === undefined || endpointInfo.id === null || endpointInfo.id.toString().trim() === "")
            return { valid: false, message: `${prefix} - Endpoint id is missing` };
        if (endpointInfo.typeId === undefined || endpointInfo.typeId === null || endpointInfo.typeId.toString().trim() === "")
            return { valid: false, message: `${prefix} - Endpoint typeId is missing` };
        // if (typeof endpointInfo.currentValue === "undefined" || endpointInfo.currentValue === undefined)
        // 	return { valid: false, message: "Endpoint current value is missing" };
        return { valid: true };
    }
}
const SpinalNetworkUtilities = SpinalNetworkUtilitiesClass.getIntance();
exports.SpinalNetworkUtilities = SpinalNetworkUtilities;
//# sourceMappingURL=SpinalNetworkUtilities.js.map