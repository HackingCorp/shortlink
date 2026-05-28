declare module 'maviance-s3p-client' {
  export class Configuration {
    constructor(config: { basePath?: string; apiKey?: string; accessToken?: string });
  }
  export class MasterdataApi {
    constructor(config: Configuration);
    cashoutGet(version: string, serviceId?: number): Promise<{ data: any }>;
    serviceIdGet(version: string, serviceId: number): Promise<{ data: any }>;
  }
}
