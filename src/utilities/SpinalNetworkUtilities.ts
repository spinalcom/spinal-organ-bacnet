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

import { InputDataDevice, InputDataEndpoint, InputDataEndpointGroup, SpinalServiceTimeseries, SpinalBmsDevice, SpinalBmsEndpoint, SpinalBmsEndpointGroup, SpinalBmsNetwork } from "spinal-model-bmsnetwork";
import { SpinalBacnetValueModel, SpinalDiscoverModel, SpinalListenerModel } from "spinal-model-bacnet";
import { SpinalContext, SpinalGraph, SpinalNode, SPINAL_RELATION_PTR_LST_TYPE } from "spinal-model-graph";
import { serviceDocumentation } from "spinal-env-viewer-plugin-documentation-service";
import { SpinalAttribute } from "spinal-models-documentation";
import { SpinalDevice } from "../modules/SpinalDevice";
import { IDataDiscover } from "../Interfaces/IDataDiscover";
import { IDataBacnetValue } from "../Interfaces/IDataBacnetValue";
import { ObjectTypes } from "./GlobalVariables";
import { SpinalGraphService } from "spinal-env-viewer-graph-service";
import { decodeBitStringValue } from "./Functions";
import { Model } from "spinal-core-connectorjs";
import { debugLog } from "./debugLog";
import { COMMUNICATION_CONTROL_PROFILES, getCommunicationControlEndpoints, getCommunicationControlEndpointTimeSeriesValue } from "../indicators/communicationControlEndpoints";
import type { DeviceCommunicationIndicatorsSnapshot } from "../Interfaces/IDeviceCommunicationIndicators";

const bmsTypeNames = [SpinalBmsNetwork.nodeTypeName, SpinalBmsDevice.nodeTypeName, SpinalBmsEndpointGroup.nodeTypeName, SpinalBmsEndpoint.nodeTypeName] as const;
type BmsNodeType = (typeof bmsTypeNames)[number];

type InputDataTypes = ({ name: string; type: string } | InputDataDevice | InputDataEndpointGroup | InputDataEndpoint) & { [key: string]: any };

class SpinalNetworkUtilitiesClass {
	private static _instance: SpinalNetworkUtilitiesClass;
	private _timeSeriesService: SpinalServiceTimeseries | null = null;

	private constructor() {}

	public static getIntance(): SpinalNetworkUtilitiesClass {
		if (!this._instance) this._instance = new SpinalNetworkUtilitiesClass();
		return this._instance;
	}

	////////////////////////////////////////////////////////////////////////
	////              INITIALIZATION FUNCTIONS FOR MODELS              ////
	////////////////////////////////////////////////////////////////////////

	public async initSpinalDiscoverNetwork(spinalModel: SpinalDiscoverModel): Promise<IDataDiscover> {
		const { graph, organ, context } = await this._getSpinalDiscoverModel(spinalModel);
		const network = await this._getOrCreateNetworkNode(context, organ, spinalModel.network.get());

		return { graph, context, organ, network };
	}

	public getTimeSeriesInstance(): SpinalServiceTimeseries {
		if (!this._timeSeriesService) this._timeSeriesService = new SpinalServiceTimeseries();
		return this._timeSeriesService;
	}

	public async updateCommunicationControlEndpoints(deviceNode: SpinalNode, snapshot: DeviceCommunicationIndicatorsSnapshot, recordTimeSeries = true, trigger?: string): Promise<void> {
		for (const profile of COMMUNICATION_CONTROL_PROFILES) {
			if (trigger ? profile.trigger !== trigger : Boolean(profile.trigger)) continue;
			const flagValue = profile.enabledWhen ? process.env[profile.enabledWhen]?.trim().toLowerCase() : undefined;
			if (profile.enabledWhen && flagValue !== "1" && flagValue !== "true") continue;

			const existingGroups = await deviceNode.getChildren([profile.relation]);
			let groupNode = existingGroups.find((group) => group.info?.idNetwork?.get() === profile.id);
			const groupInfo = {
				id: profile.id,
				name: profile.name,
				type: SpinalBmsEndpointGroup.nodeTypeName,
				path: "",
				indicatorProfile: profile.indicatorProfile,
			};

			if (groupNode) {
				await this.updateControlPointNode(groupNode, groupInfo);
			} else {
				groupNode = await this.createControlPointNode(groupInfo, SpinalBmsEndpointGroup.nodeTypeName);
				await deviceNode.addChild(groupNode, profile.relation, SPINAL_RELATION_PTR_LST_TYPE);
			}

			const existingEndpoints = await groupNode.getChildren([SpinalBmsEndpoint.relationName]);
			const endpointsById = new Map<string, SpinalNode>();

			for (const endpointNode of existingEndpoints) {
				const id = endpointNode.info?.idNetwork?.get();
				if (typeof id === "string" && id.length > 0) endpointsById.set(id, endpointNode);
			}

			const endpointInfos = getCommunicationControlEndpoints(snapshot, profile);
			const historyTimestamp = Date.now();
			await Promise.all(
				endpointInfos.map(async (endpointInfo) => {
					const existingEndpoint = endpointsById.get(endpointInfo.id);
					let endpointNode = existingEndpoint;
					if (existingEndpoint) {
						const element = await existingEndpoint.getElement(true);
						if (!element) throw new Error(`Failed to load control endpoint "${endpointInfo.name}"`);

						const hasChanges = Object.entries(endpointInfo).some(([key, value]) => {
							const modelValue = element[key];
							const currentValue = modelValue && typeof modelValue.get === "function" ? modelValue.get() : modelValue;
							return !Object.is(currentValue, value);
						});
						if (hasChanges) await this.updateControlPointNode(existingEndpoint, endpointInfo);
					} else {
						endpointNode = await this.createControlPointNode(endpointInfo, SpinalBmsEndpoint.nodeTypeName);
						endpointNode = await groupNode!.addChild(endpointNode, SpinalBmsEndpoint.relationName, SPINAL_RELATION_PTR_LST_TYPE);
					}

					const value = getCommunicationControlEndpointTimeSeriesValue(endpointInfo.id, endpointInfo.currentValue, profile);
					if (recordTimeSeries && typeof value === "number") {
						SpinalGraphService._addNode(endpointNode as SpinalNode);
						const saved = await this.getTimeSeriesInstance().insertFromEndpoint((endpointNode as SpinalNode).getId().get(), value, historyTimestamp);
						if (!saved) throw new Error(`Failed to record time series for control endpoint "${endpointInfo.name}"`);
					}
				}),
			);

			const currentEndpointIds = new Set(endpointInfos.map((endpointInfo) => endpointInfo.id));
			const obsoleteEndpoints = existingEndpoints.filter((endpointNode) => {
				const id = endpointNode.info?.idNetwork?.get();
				return typeof id === "string" && /^bacnet_(?:indicator|ping)_/.test(id) && !currentEndpointIds.has(id);
			});
			await Promise.all(obsoleteEndpoints.map((endpointNode) => groupNode!.removeChild(endpointNode, SpinalBmsEndpoint.relationName, SPINAL_RELATION_PTR_LST_TYPE)));
		}
	}

	public async initSpinalBacnetValueModel(spinalModel: SpinalBacnetValueModel): Promise<IDataBacnetValue> {
		const { node, context, network, organ } = await spinalModel.getAllItem();

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
	}

	public async initSpinalListenerModel(spinalModel: SpinalListenerModel): Promise<SpinalDevice> {
		const spinalDevice = new SpinalDevice();
		await spinalDevice.initExistingDevice(spinalModel);
		return spinalDevice;
	}

	/////////////////////////////////////////////////////////////
	//                BMS NETWORK FUNCTIONS                    //
	/////////////////////////////////////////////////////////////

	public async updateEndpointInGraph(spinalDevice: SpinalDevice, children: { id: string | number; type: string | number; currentValue: any }[]): Promise<boolean[]> {
		const deviceNode = spinalDevice.getBmsDeviceNode();
		if (!deviceNode) throw new Error("Device node not found in graph");

		const endpointsObj = await this._getAllEndpointsInGraph(deviceNode);

		const updates: { endpointNode: SpinalNode<any>; currentValue: any; promise: Promise<boolean> }[] = [];

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
			} else {
				console.error(`[updateEndpointInGraph] [${spinalDevice.Name}] - Endpoint ${child.id} of type ${child.type} not found in graph`);
			}
		}

		return this._handleEndpointUpdatesAndLogResponse(updates, spinalDevice);
	}

	private _handleEndpointUpdatesAndLogResponse(updates: { endpointNode: SpinalNode<any>; currentValue: any; promise: Promise<boolean> }[], spinalDevice: SpinalDevice): Promise<boolean[]> {
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

	private async _updateEndpointNodeValue(endpointNode: SpinalNode, newValue: any, saveTimeSeries = false, itsBitStringChild = false): Promise<boolean> {
		const element = await endpointNode.getElement(true);
		if (!element) {
			console.error(`[updateEndpointNodeValue] - Failed to get element for endpoint node: ${endpointNode.getName().get()}`);
			return false;
		}

		if (element.currentValue) element.currentValue.set(newValue);
		if (endpointNode.info.currentValue) endpointNode.info.currentValue.set(newValue);

		if (saveTimeSeries && (typeof newValue === "number" || typeof newValue === "boolean" || !isNaN(newValue))) {
			SpinalGraphService._addNode(endpointNode);
			const timeSeriesService = this.getTimeSeriesInstance();
			await timeSeriesService.pushFromEndpoint(endpointNode.getId().get(), Number(newValue));
		}

		const { typeId } = endpointNode.info.get();

		if (typeId === ObjectTypes.OBJECT_BITSTRING_VALUE && !itsBitStringChild) {
			await this.updateBitStringEndpointValue(endpointNode, newValue);
		}

		return true;
	}

	public async _getAllEndpointsInGraph(deviceNode: SpinalNode): Promise<{ [key: string]: SpinalNode }> {
		const endpointGroups = await deviceNode.getChildren([SpinalBmsEndpointGroup.relationName]);

		const promises = endpointGroups.map(async (group) => {
			const endpointsObj: { [key: string]: SpinalNode } = {};
			const typeId = group.info?.idNetwork?.get();

			const children = await group.getChildren([SpinalBmsEndpoint.relationName]);
			children.forEach((child) => {
				const idNetwork = child.info?.idNetwork?.get();
				if (typeof idNetwork !== "undefined" && idNetwork !== null) endpointsObj[`${typeId}_${idNetwork}`] = child;
			});

			return endpointsObj;
		});

		return Promise.allSettled(promises).then((results) => {
			return results.reduce((acc: {}, result) => {
				if (result.status === "fulfilled") return { ...acc, ...result.value };
				return acc;
			}, {});
		});
	}

	public async createEndpointsInGroup(context: SpinalContext, device: SpinalNode, endpointGroupName: string, endpointArray: InputDataEndpoint[]): Promise<SpinalNode[]> {
		const endpointGroup = await this._createEndpointsGroup(context, device, endpointGroupName);
		const deviceName = device.info?.name?.get();
		// const groupId = endpointGroup.id.get();

		const endpointsNode = await this._createEndpointByArray(context, endpointGroup, endpointArray, deviceName);

		if (endpointGroup.info?.idNetwork?.get() == ObjectTypes.OBJECT_BITSTRING_VALUE) {
			await this._createBitStringSubEndpoints(context, endpointsNode, deviceName);
		}

		return endpointsNode;
	}

	public async _createEndpointsGroup(context: SpinalContext, deviceNode: SpinalNode, endpointGroupName: string): Promise<SpinalNode> {
		const groupNetworkId = ObjectTypes[`object_${endpointGroupName}`.toUpperCase()];
		const deviceName = deviceNode.info?.name?.get();

		const alreadyExist = await this._itemExistInChild(deviceNode, SpinalBmsEndpointGroup.relationName, groupNetworkId);

		const groupInfo: any = {
			name: endpointGroupName,
			id: groupNetworkId,
			type: SpinalBmsEndpointGroup.nodeTypeName,
			path: "",
		};

		if (alreadyExist) {
			debugLog(`[_createEndpointsGroup] ${deviceName} - endpoint group "${endpointGroupName}" already exists, updating it, with info:`, groupInfo);
			return this.updateNetworkElementNode(alreadyExist, groupInfo);
		}

		debugLog(`[_createEndpointsGroup] ${deviceName} - creating endpoint group "${endpointGroupName}" with info:`, groupInfo);
		const endpointGroup = await this.createNetworkElementNode(groupInfo, SpinalBmsEndpointGroup.nodeTypeName);
		return deviceNode.addChildInContext(endpointGroup, SpinalBmsEndpointGroup.relationName, SPINAL_RELATION_PTR_LST_TYPE, context);
	}

	public async _createBitStringSubEndpoints(context: SpinalContext, endpointsNode: SpinalNode[], deviceName: string): Promise<SpinalNode[]> {
		const promises = endpointsNode.map(async (endpointNode) => this._createOrUpdateEndpointsByBitStringValue(context, endpointNode, deviceName));

		return Promise.allSettled(promises).then((results) => {
			return results.filter((result): result is PromiseFulfilledResult<SpinalNode> => result.status === "fulfilled").map((result) => result.value);
		});
	}

	public async _createOrUpdateEndpointsByBitStringValue(context: SpinalContext, endpointNode: SpinalNode, deviceName: string): Promise<SpinalNode> {
		const element = await endpointNode.getElement(true);
		const bitText: string[] = element.bit_text.get();
		const value: { value: number[]; bitsUsed: number } = element.currentValue.get();

		const convertedValueToEndpointInfo = this._convertBitStringValueToEndpointInfo(value, bitText, endpointNode.info.get());
		return this._createEndpointByArray(context, endpointNode, convertedValueToEndpointInfo, deviceName).then(() => endpointNode);
	}

	public async updateBitStringEndpointValue(endpointNode: SpinalNode, newValue: { value: number[]; bitsUsed: number }, saveTimeSeries: boolean = false): Promise<SpinalNode> {
		const children = await endpointNode.getChildren([SpinalBmsEndpoint.relationName]);
		const childrenObj: { [key: string]: SpinalNode } = children.reduce((acc: {}, child) => {
			const idNetwork = child.info?.idNetwork?.get();
			if (typeof idNetwork === "undefined" || idNetwork === null) return acc;

			return { ...acc, [idNetwork]: child };
		}, {});

		const bitText: string[] = (await endpointNode.getElement(true)).bit_text.get();

		const convertedValueToEndpointInfo = this._convertBitStringValueToEndpointInfo(newValue, bitText, endpointNode.info.get());
		const promises = [];

		for (const endpoint of convertedValueToEndpointInfo) {
			const childFound = childrenObj[endpoint.id];
			if (childFound) promises.push(this._updateEndpointNodeValue(childFound, endpoint.currentValue, saveTimeSeries, true));
		}

		return Promise.allSettled(promises).then((results) => {
			return endpointNode;
		});
	}

	private _convertBitStringValueToEndpointInfo(value: { value: number[]; bitsUsed: number }, bitText: string[], parentInfo: any): InputDataEndpoint[] {
		const bitStringArray: { id: number; value: boolean; name: string }[] = decodeBitStringValue(value, bitText);

		return bitStringArray.map(
			(bit) =>
				({
					id: `${parentInfo.idNetwork}_${bit.id}`,
					typeId: parentInfo.typeId,
					path: ` ${parentInfo.name}/${bit.name}`,
					currentValue: bit.value,
					present_value: bit.value,
					name: bit.name,
					type: SpinalBmsEndpoint.nodeTypeName,
				} as any),
		);
	}

	public async _createEndpointByArray(context: SpinalContext, groupNode: SpinalNode, endpointArray: InputDataEndpoint[], deviceName: string): Promise<SpinalNode[]> {
		const endpointAlreadyCreated = await this._getChildrenAsObj(groupNode, SpinalBmsEndpoint.relationName);
		const groupName = groupNode.info?.name?.get();

		const promises = endpointArray.map(async (endpointInfo) => {
			endpointInfo = this._formatEndpointCreationInfo(endpointInfo);

			const endpointInfoIsValid = this._checkIfInfoIsValid(endpointInfo, deviceName, groupName);

			if (!endpointInfoIsValid.valid) {
				throw `A required endpoint information is not valid: ${endpointInfoIsValid.message}`;
			}

			const existingEndpoint = endpointAlreadyCreated[endpointInfo.id];

			if (existingEndpoint) {
				debugLog(`[mapCallback] [_createEndpointByArray] [${deviceName}] - [${groupName}] - endpoint "${endpointInfo.name}" already exists, updating it with new info`, endpointInfo);
				return this.updateNetworkElementNode(existingEndpoint, endpointInfo);
			}

			debugLog(`[mapCallback] [_createEndpointByArray] [${deviceName}] - [${groupName}] - creating endpoint "${endpointInfo.name}" with info`, endpointInfo);
			const node = await this.createNetworkElementNode(endpointInfo, SpinalBmsEndpoint.nodeTypeName);
			return groupNode.addChildInContext(node, SpinalBmsEndpoint.relationName, SPINAL_RELATION_PTR_LST_TYPE, context);
		});

		return Promise.allSettled(promises).then((results) => {
			const result: SpinalNode[] = [];
			let index = 0;
			for (const res of results) {
				if (res.status === "fulfilled") result.push(res.value);
				else {
					endpointArray[index] && console.error(`[thenCallback] [_createEndpointByArray] Failed to create/update endpoint "${endpointArray[index].name}"`, res.reason);
				}
				index++;
			}
			return result;
		});
	}

	private _formatEndpointCreationInfo(endpointInfo: InputDataEndpoint): any {
		return {
			id: endpointInfo.id ?? endpointInfo.instance,
			typeId: endpointInfo.typeId,
			path: endpointInfo.path || "",
			currentValue: endpointInfo.currentValue ?? endpointInfo.present_value,
			name: endpointInfo.name || endpointInfo.object_name,
			type: SpinalBmsEndpoint.nodeTypeName,
			description: endpointInfo.description,
			max_pres_value: endpointInfo.max_pres_value ?? "",
			min_pres_value: endpointInfo.min_pres_value ?? "",
			unit: endpointInfo.unit || "",
			...(endpointInfo.bit_text && { bit_text: endpointInfo.bit_text }),
		};
	}

	public async updateNetworkElementNode(node: SpinalNode, newInfo: InputDataTypes): Promise<SpinalNode> {
		debugLog(`[updateNetworkElementNode] Updating ${node.info?.name?.get()}`, newInfo);

		return this._updateNetworkElementNode(node, newInfo);
	}

	public async updateControlPointNode(node: SpinalNode, newInfo: InputDataTypes): Promise<SpinalNode> {
		const name = node.info?.name?.get();
		// debugLog(`[updateControlPointNode] Starting update of "${name}"`);
		try {
			return await this._updateNetworkElementNode(node, newInfo, true);
		} finally {
			// debugLog(`[updateControlPointNode] Finished update of "${name}"`);
		}
	}

	private async _updateNetworkElementNode(node: SpinalNode, newInfo: InputDataTypes, isControlPoint = false): Promise<SpinalNode> {
		const element = await node.getElement(true);
		this._updateElementInfo(element, newInfo, isControlPoint);
		this._modifyNodeInfo(node, element, isControlPoint);
		await this._createOrUpdateAttributesFromElement(node, element);

		return node;
	}

	public async createNetworkElementNode(nodeInfo: InputDataTypes, type: BmsNodeType): Promise<SpinalNode> {
		const element = this._createBmsElementFromType(nodeInfo, type);

		if (!element) throw new Error(`Unsupported BMS node type: ${type}`);

		return this._createBmsNodeFromElement(element);
	}

	public async createControlPointNode(nodeInfo: InputDataTypes, type: BmsNodeType): Promise<SpinalNode> {
		const name = nodeInfo.name;
		debugLog(`[createControlPointNode] Starting creation of "${name}" (${type})`);
		try {
			if (type !== SpinalBmsEndpoint.nodeTypeName && type !== SpinalBmsEndpointGroup.nodeTypeName) {
				throw new Error(`Unsupported control point node type: ${type}`);
			}

			const element = this._createBmsElementFromType(nodeInfo, type);
			if (!element) throw new Error(`Failed to create control point node of type: ${type}`);

			return await this._createBmsNodeFromElement(element, true);
		} finally {
			debugLog(`[createControlPointNode] Finished creation of "${name}" (${type})`);
		}
	}

	private _updateElementInfo(element: spinal.Model, newInfo: InputDataTypes, isControlPoint = false): void {
		const updateAttribute = isControlPoint ? this._checkIfValueIsValidAndUpdateControlPoint.bind(this) : this._checkIfValueIsValidAndUpdate.bind(this);

		for (const key in newInfo) {
			const value = newInfo[key];
			updateAttribute(element, key, value, element.name.get());
		}
	}

	private _createBmsElementFromType(nodeInfo: InputDataTypes, type: BmsNodeType): SpinalBmsNetwork | SpinalBmsDevice | SpinalBmsEndpointGroup | SpinalBmsEndpoint | undefined {
		nodeInfo.type = type;

		switch (type) {
			case SpinalBmsNetwork.nodeTypeName:
				return new SpinalBmsNetwork(nodeInfo.name, type);

			case SpinalBmsDevice.nodeTypeName:
				return new SpinalBmsDevice(nodeInfo as InputDataDevice);

			case SpinalBmsEndpointGroup.nodeTypeName:
				return new SpinalBmsEndpointGroup(nodeInfo as InputDataEndpointGroup);

			case SpinalBmsEndpoint.nodeTypeName:
				return new SpinalBmsEndpoint(nodeInfo as InputDataEndpoint);
		}
	}

	private async _createBmsNodeFromElement(element: SpinalBmsNetwork | SpinalBmsDevice | SpinalBmsEndpointGroup | SpinalBmsEndpoint, isControlPoint = false): Promise<SpinalNode> {
		const name = element.name.get();
		const type = element.type.get();

		const node = new SpinalNode(name, type, element);

		this._modifyNodeInfo(node, element, isControlPoint);
		await this._createOrUpdateAttributesFromElement(node, element);

		return node;
	}

	private _modifyNodeInfo(node: SpinalNode, element: spinal.Model, isControlPoint = false): void {
		const attribuesToMod = element._attribute_names;
		const updateAttribute = isControlPoint ? this._checkIfValueIsValidAndUpdateControlPoint.bind(this) : this._checkIfValueIsValidAndUpdate.bind(this);

		for (let attr of attribuesToMod) {
			let newValue = element[attr];

			if (attr === "id") attr = "idNetwork"; // Rename "id" attribute to "idNetwork" for the node info

			// If the attribute is "type" and its value is "device", replace it with the SpinalBmsDevice node type name.
			// it ensures that the node info correctly reflects the specific type for devices.
			if (attr === "type" && newValue == "device") newValue = SpinalBmsDevice.nodeTypeName;

			updateAttribute(node.info, attr, newValue, node.getName().get());
		}
	}

	private async _createOrUpdateAttributesFromElement(node: SpinalNode, nodeElement: SpinalBmsNetwork | SpinalBmsDevice | SpinalBmsEndpointGroup | SpinalBmsEndpoint): Promise<void> {
		const attributes = nodeElement._attribute_names;

		const { element } = await serviceDocumentation.addCategoryAttribute(node, "default");
		const existingAttributes = _convertSpinalAttributeListToObj(element);

		for (const attr of attributes) {
			let spinalAttr = existingAttributes[attr];
			let value = nodeElement[attr].get();

			if (!spinalAttr) {
				// use .get because attributeService need a string as value
				spinalAttr = new SpinalAttribute(attr, value);
				element.push(spinalAttr);
				existingAttributes[attr] = spinalAttr;
				continue;
			}

			spinalAttr.value.set(value);
		}

		function _convertSpinalAttributeListToObj(element: spinal.Lst<SpinalAttribute>): { [key: string]: SpinalAttribute } {
			const obj: { [key: string]: SpinalAttribute } = {};

			for (let i = 0; i < element.length; i++) {
				const attrName = element[i].label.get();
				obj[attrName] = element[i];
			}
			return obj;
		}
	}

	private async _getSpinalDiscoverModel(discoverModel: SpinalDiscoverModel): Promise<{ graph: SpinalNode; organ: SpinalNode; context: SpinalContext }> {
		const promises = [discoverModel.getGraph(), discoverModel.getContext(), discoverModel.getOrgan()];
		const [graph, context, organ] = await Promise.all(promises);

		// const organ = {
		//    contextName: context.getName().get(),
		//    contextType: context.getType().get(),
		//    networkType: organNode.getType().get(),
		//    networkName: organNode.getName().get()
		// };

		return { graph, organ, context };
	}

	private async _getOrCreateNetworkNode(context: SpinalContext, organ: SpinalNode, networkInfo: any): Promise<SpinalNode> {
		const children = await organ.getChildrenInContext(context);

		for (const child of children) {
			if (child.getName().get() === networkInfo.name) {
				return child;
			}
		}

		const name = networkInfo.name;
		const type = SpinalBmsNetwork.nodeTypeName;

		const element = new SpinalBmsNetwork(name, type);
		const networkNode = new SpinalNode(name, type, element);

		return organ.addChildInContext(networkNode, SpinalBmsNetwork.relationName, SPINAL_RELATION_PTR_LST_TYPE, context);
	}

	private async _itemExistInChild(parentNode: SpinalNode, relationName: string, childNetworkId: string | number): Promise<SpinalNode | undefined> {
		const children = await parentNode.getChildren([relationName]);

		const found = children.find((el) => el.info?.idNetwork?.get() == childNetworkId);

		return found;
	}

	private async _getChildrenAsObj(parentNode: SpinalNode, relationName: string): Promise<{ [key: string]: SpinalNode }> {
		const children = await parentNode.getChildren([relationName]);
		const childObj: { [key: string]: SpinalNode } = {};
		const promises: Promise<void>[] = [];

		for (const child of children) {
			if (this._existingNodeIsInvalid(child)) {
				// remove invalid child node
				promises.push(parentNode.removeChild(child, relationName, SPINAL_RELATION_PTR_LST_TYPE));
				continue;
			}

			const networkId = child.info?.idNetwork?.get();
			if (typeof networkId !== "undefined" && networkId !== null) childObj[networkId] = child;
		}

		return Promise.allSettled(promises)
			.then(() => childObj)
			.catch((error) => childObj);
	}

	private _existingNodeIsInvalid(child: SpinalNode<any>) {
		if (!child.info?.idNetwork || child.info?.idNetwork?.get().toString().trim() == "") return true;
		if (!child.info?.name || child.info?.name?.get().toString().trim() == "") return true;
		if (!child.info?.typeId || child.info?.typeId?.get().toString().trim() == "") return true;

		return false;
	}

	private loadPtrValue(ptrModel: spinal.Ptr): Promise<SpinalGraph> {
		return new Promise((resolve) => {
			ptrModel.load((data) => resolve(data));
		});
	}

	private _checkIfValueIsValidAndUpdateControlPoint(model: Model, attr: string, newValue: any, deviceName: string = ""): void {
		this._checkIfValueIsValidAndUpdate(model, attr, newValue, deviceName, false);
	}

	private _checkIfValueIsValidAndUpdate(model: Model, attr: string, newValue: any, deviceName: string = "", logUpdate = true): void {
		try {
			if (newValue === undefined || newValue === null) return;

			const attrToNotUpdateIfEmpty = ["name", "type", "idNetwork", "currentValue"];

			if (attrToNotUpdateIfEmpty.includes(attr) && (newValue.toString().trim() === "" || typeof newValue === "undefined" || newValue === null)) return;

			if (newValue === model[attr]) return;

			if (model[attr]) {
				const v = typeof newValue?.get == "function" ? newValue.get() : newValue;
				if (logUpdate) debugLog(`[_checkIfValueIsValidAndUpdate] [${deviceName}] [${model[attr]._server_id}] updating attribute "${attr}"  with value "${v}"`);
				model.mod_attr(attr, newValue);
			} else if (!model[attr]) {
				const v = typeof newValue?.get == "function" ? newValue.get() : newValue;
				if (logUpdate) debugLog(`[_checkIfValueIsValidAndUpdate] [${deviceName}] updating attribute "${attr}" with value "${v}"`);
				model.add_attr({ [attr]: newValue });
			}
		} catch (error: any) {
			// console.log(`[${model._server_id}] - Failed to set attribute "${attr}"   on node "${deviceName}" due to:`, error.message);
			console.error(`[SpinalNetworkUtilities] [${model._server_id}] Failed to set attribute "${attr}" on node "${deviceName}"`, error);
		}
	}

	private async _endpointCanBeCreate(endpointData: InputDataEndpoint): Promise<boolean> {
		if (!endpointData) return false;

		if (!endpointData.name || endpointData.name.toString().trim() === "") return false;
		if (!endpointData.type || endpointData.type.toString().trim() === "") return false;

		if (typeof endpointData.currentValue === "undefined" || endpointData.currentValue === undefined) return false;

		return true;
	}

	private _checkIfInfoIsValid(endpointInfo: InputDataEndpoint, deviceName?: string, groupName?: string): { valid: boolean; message?: string } {
		if (!endpointInfo) return { valid: false, message: "Endpoint info is missing" };

		const prefix = `[${deviceName} --> ${groupName} --> ${endpointInfo.typeId}_${endpointInfo.id}]`;

		if (!endpointInfo.name || endpointInfo.name.toString().trim() === "") return { valid: false, message: `${prefix} - Endpoint name is missing or empty` };

		if (!endpointInfo.type || endpointInfo.type.toString().trim() === "") return { valid: false, message: `${prefix} - Endpoint type is missing or empty` };

		if (endpointInfo.id === undefined || endpointInfo.id === null || endpointInfo.id.toString().trim() === "") return { valid: false, message: `${prefix} - Endpoint id is missing` };

		if (endpointInfo.typeId === undefined || endpointInfo.typeId === null || endpointInfo.typeId.toString().trim() === "") return { valid: false, message: `${prefix} - Endpoint typeId is missing` };

		// if (typeof endpointInfo.currentValue === "undefined" || endpointInfo.currentValue === undefined)
		// 	return { valid: false, message: "Endpoint current value is missing" };

		return { valid: true };
	}
}

const SpinalNetworkUtilities = SpinalNetworkUtilitiesClass.getIntance();
export { SpinalNetworkUtilities };
