// socket-io.service.ts
import { Injectable } from '@angular/core';
import { Socket, io } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketIoService {
  private socket: Socket | null = null;
  private readonly WS_URL = 'wss://frontend-api-v2.pump.fun';
  
  public messages$ = new Subject<any>();
  public connectionStatus$ = new BehaviorSubject<boolean>(false);

  constructor() {}

  connect(): void {
    if (this.socket?.connected) {
      console.log('Socket.IO déjà connecté');
      return;
    }

    // Configuration de Socket.IO
    this.socket = io(this.WS_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    // Gestionnaires d'événements
    this.socket.on('connect', () => {
      console.log('Socket.IO connecté');
      this.connectionStatus$.next(true);
      
      // Envoyer le paquet 40 après la connexion
      this.sendPacket40();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket.IO déconnecté:', reason);
      this.connectionStatus$.next(false);
    });

    this.socket.on('error', (error) => {
      console.error('Erreur Socket.IO:', error);
    });

    // Écouter tous les messages
    this.socket.onAny((eventName, ...args) => {
      console.log('Message reçu:', eventName, args);
      this.messages$.next({
        event: eventName,
        data: args,
        timestamp: new Date()
      });
    });
  }

  private sendPacket40(): void {
    if (this.socket?.connected) {
      console.log('Envoi du paquet 40');
      this.socket.send('40');
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
