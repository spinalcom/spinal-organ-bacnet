// await renameInvalidNode(103124016728656, 133288697415296,140030325957840);

async function renameInvalidNode(bmsContextId, profileContextId, profileId) {

	const context = FileSystem._objects[bmsContextId];
	if (!context) throw new Error("Context not found");

	const intervalObj = await classifyProfileItemById(profileContextId, profileId);
	console.log("[renameInvalidNode] intervalObj", intervalObj);

	const endpoints = await getEndpoints(context);
	const nodeToRename = [];

	for (const node of endpoints) {
		const id = node.info.idNetwork && node.info.idNetwork.get();
		const typeId = node.info?.typeId && node.info.typeId.get();
		const key = typeId + "_" + id;
		const newName = intervalObj[key];
		if (newName && node.getName().get() !== newName) {
			console.log("[renameInvalidNode] Renaming node", key, newName);
			nodeToRename.push({ node, newName });
			node.info.name.set(newName);
		}
	}

	return nodeToRename;

	// return context.findInContext(context, (node) => {
	// 	console.log("node", node);
	// 	if (node.getType().get() === "BmsEndpoint") {
	// 		const id = node.info.idNetwork && node.info.idNetwork.get();
	// 		const typeId = node.info?.typeId && node.info.typeId.get();
	// 		const key = typeId + "_" + id;
	// 		const newName = intervalObj[key];

	// 		console.log("newName", key, newName);
	// 		if (newName && node.getName().get() !== newName) {
	// 			console.log("yes BmsEndpoint found");

	// 			// Rename the node if the new name is different
	// 			// node.getName().set(newName);
	// 			return true;
	// 		}
	// 	}

	// 	return false;
	// });
}

async function getEndpoints(context) {
	console.log("[getEndpoints] getting organs")
	const organs = await getListChild(context, [context]);
	console.log("[getEndpoints] getting networks")
	const networks = await getListChild(context, organs);

	console.log("[getEndpoints] getting devices")
	const devices = await getListChild(context, networks);
	console.log("[getEndpoints] getting groupEndpoints")
	const groupEndpoints = await getListChild(context, devices);
	console.log("[getEndpoints] getting endpoints")
	const endpoints = await getListChild(context, groupEndpoints);

	return endpoints;
}

async function getListChild(context, parentNodes, chunkSize = 50) {
	if (!Array.isArray(parentNodes) || parentNodes.length === 0) return [];

	const output = [];

	try {
		for (let i = 0; i < parentNodes.length; i += chunkSize) {
			const chunk = parentNodes.slice(i, i + chunkSize);
			const promises = chunk.map((parentNode) => parentNode.getChildrenInContext(context));

			const result = await Promise.all(promises);
			output.push(...result.flat());
		}

		return output;
	} catch {
		return [];
	}
}

async function classifyProfileItemById(profileContextId, profileId) {
	const intervalTimes = await getIntervalTimes(profileContextId, profileId);

	const obj = {};
	const promises = intervalTimes.map(async (intervalNode) => {
		const { idx, typeId, name } = await getIntervalAttributesKey(intervalNode);
		const key = typeId + "_" + idx;
		obj[key] = name;
	});

	return Promise.all(promises)
		.then(() => obj)
		.catch((err) => obj);
}

// TEST OK
async function getIntervalTimes(profileContextId, profileId) {
	const profileContext = FileSystem._objects[profileContextId];
	if (!profileContext) throw new Error("Profile context not found");

	const profileNode = FileSystem._objects[profileId];
	if (!profileNode) throw new Error("Profile node not found");

	const nodes = await profileNode.getChildrenInContext(profileContext);
	const bacnetValuesNode = nodes.find((node) => node.getName().get() === "BacnetValues");
	if (!bacnetValuesNode) throw new Error("BacnetValues node not found");

	const types = await bacnetValuesNode.getChildrenInContext(profileContext);

	const promises = types.map(async (typeNode) => typeNode.getChildrenInContext(profileContext));
	return Promise.all(promises)
		.then((result) => result.flat())
		.catch((err) => {
			console.error("[catchCallback] ", err);
			throw err;
		});
}

async function getIntervalAttributesKey(intervalNode) {
	const attributeCategory = await intervalNode.getChildren(["hasCategoryAttributes"]);
	const defaultCategory = attributeCategory.find((category) => category.getName().get() === "default");
	if (!defaultCategory) return null;

	const attributesElements = (await defaultCategory.getElement(true)) || [];
	const result = { idx: null, typeId: null, name: null };

	for (let i = 0; i < attributesElements.length; i++) {
		const label = attributesElements[i].label.get();
		const value = attributesElements[i].value.get();

		if (label === "IDX") result.idx = Number(value) + 1;
		else if (label === "typeId") result.typeId = Number(value);
		else if (label === "NAME") result.name = value;
		// Process each attribute as needed
	}

	return result;
}
