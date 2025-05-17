import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
    providedIn: 'root'
})
export class WebsocketApiService implements OnDestroy {
    private socket: Socket | null = null;
    private messageSubject = new Subject<any>();
    public messages$ = this.messageSubject.asObservable();
    private connectionStatusSubject = new BehaviorSubject<boolean>(false);
    private activeTokenSubscriptions = new Set<string>();
    private isCleaningUp = false;

    constructor() {}

    private initializeSocket(): void {
        // Nettoyage de l'ancien socket s'il existe
        if (this.socket) {
            this.cleanupSocket();
        }

        this.socket = io('http://127.0.0.1:3001', {
            path: '/transaction',
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        // Réinitialiser les subjects
        this.resetSubjects();
        
        // Configurer les nouveaux listeners
        this.setupSocketListeners();
    }

    private setupSocketListeners(): void {
        if (!this.socket) {
            console.error('Setup listeners failed: socket is null');
            return;
        }
    
        // D'abord, retirer tous les listeners existants
        this.socket.removeAllListeners();
    
        this.socket.on('connect', () => {
            this.connectionStatusSubject.next(true);
            this.resubscribeToTokens();
        });
    
        this.socket.on('disconnect', () => {
            this.connectionStatusSubject.next(false);
        });
    
       
    
        this.socket.on('data', (data) => {
            try {
                this.messageSubject.next(data);
            } catch (error) {
                console.error('Error emitting data:', error);
            }
        });
    
        // Ajouter d'autres événements possibles
        this.socket.on('message', (data) => {
            this.messageSubject.next(data);
        });
    
        this.socket.on('update', (data) => {
            this.messageSubject.next(data);
        });
    
        this.socket.on('watch_confirmation', (response) => {
        });
    
        this.socket.on('watch_error', (error) => {
            console.error('Watch error:', error);
        });
    
        this.socket.on('unwatch_confirmation', (response) => {
        });
    }

    private resubscribeToTokens(): void {
        if (!this.socket?.connected) return;
        
        const tokens = Array.from(this.activeTokenSubscriptions);
        this.activeTokenSubscriptions.clear();
        tokens.forEach(token => this.watchToken(token));
    }

    private resetSubjects(): void {
        if (this.messageSubject) {
            this.messageSubject.complete();
        }
        this.messageSubject = new Subject<any>();
    }

    private cleanupSocket(): void {
        if (!this.socket || this.isCleaningUp) return;

        this.isCleaningUp = true;

        if (this.socket.connected) {
            const tokens = Array.from(this.activeTokenSubscriptions);
            tokens.forEach(token => this.unwatchToken(token));
        }

        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
        this.activeTokenSubscriptions.clear();
        
        this.isCleaningUp = false;
    }

    public watchToken(tokenAddress: string): void {
        if (!this.socket?.connected) {
            throw new Error('Socket non connecté');
        }

        if (!this.activeTokenSubscriptions.has(tokenAddress)) {
            this.socket.emit('watch_token', tokenAddress);
            this.activeTokenSubscriptions.add(tokenAddress);
        }
    }

    public unwatchToken(tokenAddress: string): void {
        if (!this.socket?.connected) {
            throw new Error('Socket non connecté');
        }

        if (this.activeTokenSubscriptions.has(tokenAddress)) {
            this.socket.emit('unwatch_token', tokenAddress);
            this.activeTokenSubscriptions.delete(tokenAddress);
        }
    }

    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Si pas de socket, en créer un nouveau
            if (!this.socket) {
                this.initializeSocket();
            }

            // Si déjà connecté, résoudre immédiatement
            if (this.socket?.connected) {
                resolve();
                return;
            }

            if (this.socket) {
                // Définir les handlers une seule fois pour cette tentative de connexion
                const onConnect = () => {
                    this.socket?.off('connect_error', onError);
                    resolve();
                };

                const onError = (error: Error) => {
                    this.socket?.off('connect', onConnect);
                    reject(error);
                };

                this.socket.once('connect', onConnect);
                this.socket.once('connect_error', onError);

                // Tenter la connexion
                if (!this.socket.connected) {
                    this.socket.connect();
                }
            } else {
                reject(new Error('Socket initialization failed'));
            }
        });
    }

    public disconnect(): Promise<void> {
        return new Promise((resolve) => {
            this.cleanupSocket();
            this.messageSubject.complete();
            this.connectionStatusSubject.complete();

            if (!this.socket?.connected) {
                resolve();
                return;
            }

            this.socket.once('disconnect', () => {
                this.cleanupSocket();
                resolve();
            });

            this.socket.disconnect();

        });
    }

    public getMessages(): Observable<any> {
        return new Observable(observer => {
            const subscription = this.messageSubject.subscribe({
                next: (data) => {
                    observer.next(data);
                },
                error: (error) => {
                    console.error('Error in message stream:', error);
                    observer.error(error);
                },
                complete: () => {
                    observer.complete();
                }
            });
    
            return () => {
                subscription.unsubscribe();
            };
        });
    }

    public getConnectionStatus(): Observable<boolean> {
        return this.connectionStatusSubject.asObservable();
    }

    public isWatchingToken(tokenAddress: string): boolean {
        return this.activeTokenSubscriptions.has(tokenAddress);
    }

    public getActiveSubscriptions(): string[] {
        return Array.from(this.activeTokenSubscriptions);
    }

    ngOnDestroy() {
        this.cleanupSocket();
        this.messageSubject.complete();
        this.connectionStatusSubject.complete();
    }
}
