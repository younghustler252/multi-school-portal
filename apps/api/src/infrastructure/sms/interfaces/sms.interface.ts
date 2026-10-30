/*
|--------------------------------------------------------------------------
| SMS PROVIDER INTERFACE
|--------------------------------------------------------------------------
*/

export interface SendSmsOptions {
    to:      string | string[];
    message: string;
}

export interface ISmsProvider {
    send(options: SendSmsOptions): Promise<void>;
}