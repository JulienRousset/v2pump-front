// websocket.service.ts
import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { w3cwebsocket as W3CWebSocket } from 'websocket';

@Injectable({
    providedIn: 'root'
})
export class WebsocketApiService {
    private client: any;
    private connection: any;
    private messageSubject = new Subject<any>();
    private connectionStatusSubject = new Subject<boolean>();

    constructor() {
    }




    public subscribePriceData(chartType: string, currency: string, address: string): void {
        if (!this.connection) {
            throw new Error('WebSocket non connecté');
        }

        const msg = {
            type: "SUBSCRIBE_PRICE",
            data: {
                chartType,
                currency,
                address
            }
        };

        this.connection.send(JSON.stringify(msg));
    }

    public unsubscribeTx(): void {
        if (this.connection) {
            const msg = {
                type: "UNSUBSCRIBE_PRICE"
            };
            this.connection.send(JSON.stringify(msg));
        }
    }

    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const url = `wss://public-api.birdeye.so/socket/solana?x-api-key=284cb2f4efb844baa3e62251721a8ed2`;
                this.client = new W3CWebSocket(
                    url,
                    'echo-protocol',
                    'https://birdeye.so'
                );

                this.client.onopen = () => {
                    console.log('WebSocket Client Connecté');
                    this.connectionStatusSubject.next(true);
                    resolve();
                };

                this.client.onerror = (error: any) => {
                    console.log("Erreur de connexion:", error);
                    this.connectionStatusSubject.next(false);
                    reject(error);
                };

                this.client.onclose = () => {
                    console.log('Connexion WebSocket fermée');
                    this.connectionStatusSubject.next(false);
                };

                this.client.onmessage = (message: any) => {
                    try {
                        const data = JSON.parse(message.data);
                        this.messageSubject.next(data);
                    } catch (error) {
                        console.error('Erreur parsing message:', error);
                    }
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    public subscribeTxData(address: string): void {
        if (!this.client || this.client.readyState !== this.client.OPEN) {
            throw new Error('WebSocket non connecté');
        }

        const msg = {
            type: "SUBSCRIBE_TXS",
            data: {
                address
            }
        };

        this.client.send(JSON.stringify(msg));
    }


    public unsubscribePrice(): void {
        if (this.connection) {
            const msg = {
                type: "UNSUBSCRIBE_TXS"
            };
            this.connection.send(JSON.stringify(msg));
        }
    }

    public getMessages(): Observable<any> {
        return this.messageSubject.asObservable();
    }

    public getConnectionStatus(): Observable<boolean> {
        return this.connectionStatusSubject.asObservable();
    }

    public disconnect(): void {
        if (this.client) {
            this.client.close();
            this.client = null;
        }
    }
    
}
