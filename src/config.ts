require("dotenv").config();

// const config = {
// 	spinalConnector: {
// 		name: process.env.ORGAN_NAME || "EDIT_ME",
// 		userId: process.env.USER_ID || "EDIT_ME",
// 		password: process.env.PASSWORD || "EDIT_ME",
// 		protocol: process.env.PROTOCOL || "EDIT_ME",
// 		host: process.env.HOST || "EDIT_ME",
// 		port: process.env.PORT || "EDIT_ME",
// 		path: process.env.ORGAN_FOLDER_PATH || "EDIT_ME",
// 	},
// };

// export default config;
// export { config };

interface IConfig {
	spinalConnector: {
		name: string;
		userId: string;
		password: string;
		protocol: string;
		host: string;
		port: string;
		path: string;
	};
}

function getConfig(): IConfig {
	checkAndThrowIfMissing(process.env.ORGAN_NAME, "ORGAN_NAME");
	checkAndThrowIfMissing(process.env.USER_ID, "USER_ID");
	checkAndThrowIfMissing(process.env.PASSWORD, "PASSWORD");
	checkAndThrowIfMissing(process.env.PROTOCOL, "PROTOCOL");
	checkAndThrowIfMissing(process.env.HOST, "HOST");
	checkAndThrowIfMissing(process.env.PORT, "PORT");
	checkAndThrowIfMissing(process.env.ORGAN_FOLDER_PATH, "ORGAN_FOLDER_PATH");

	return {
		spinalConnector: {
			name: process.env.ORGAN_NAME,
			userId: process.env.USER_ID,
			password: process.env.PASSWORD,
			protocol: process.env.PROTOCOL,
			host: process.env.HOST,
			port: process.env.PORT,
			path: process.env.ORGAN_FOLDER_PATH,
		} as IConfig["spinalConnector"],
	};
}

function checkAndThrowIfMissing(envVar: string | undefined, varName: string) {
	if (!envVar) {
		throw new Error(`Environment variable ${varName} is missing`);
	}
}

export default getConfig;
export { getConfig };
