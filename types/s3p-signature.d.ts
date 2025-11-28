declare module 's3p-signature' {
  export class S3PClient {
    constructor(config: {
      baseURL: string;
      apiKey: string;
      apiSecret: string;
      merchantId: string;
      timeout?: number;
    });

    // Add any methods from the S3PClient that you use in your code
    // For example (uncomment and modify as needed):
    // public request<T = any>(options: any): Promise<T>;
    // public get<T = any>(url: string, config?: any): Promise<T>;
    // public post<T = any>(url: string, data?: any, config?: any): Promise<T>;
  }
}
