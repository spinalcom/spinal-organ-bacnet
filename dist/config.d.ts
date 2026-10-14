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
declare function getConfig(): IConfig;
export default getConfig;
export { getConfig };
