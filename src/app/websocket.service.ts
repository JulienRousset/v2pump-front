// websocket.service.ts
import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket: WebSocket | null = null;
  private readonly WS_URL = 'wss://prod-v2.nats.realtime.pump.fun/';
  
  public messages$ = new Subject<any>();
  public binaryMessages$ = new Subject<ArrayBuffer>();
  public connectionStatus$ = new BehaviorSubject<boolean>(false);

  // Paramètres de connexion NATS
  private readonly connectParams = {
    no_responders: true,
    protocol: 1,
    verbose: false,
    pedantic: false,
    user: "subscriber",
    pass: "lW5a9y20NceF6AE9",
    lang: "nats.ws",
    version: "1.29.2",
    headers: true
  };

  constructor() {}

  connect(sub:any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket déjà connecté');
      return;
    }

    this.socket = new WebSocket(this.WS_URL);
    this.socket.binaryType = 'arraybuffer';

    this.socket.onopen = () => {
      console.log('WebSocket connecté');
      this.connectionStatus$.next(true);
      
      // Envoyer le paquet CONNECT
      this.sendConnectPacket(sub);
    };

    this.socket.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.handleBinaryMessage(event.data);
      } else {
        try {
          const data = JSON.parse(event.data);
          console.log('Message reçu:', data);
          this.messages$.next(data);

          // Vérifier si c'est une réponse +OK après CONNECT
          if (data === '+OK') {
            console.log('Connection NATS établie avec succès');
          }
        } catch (error) {
          console.error('Erreur parsing message:', error);
        }
      }
    };

    this.socket.onerror = (error) => {
      console.error('Erreur WebSocket:', error);
      this.connectionStatus$.next(false);
    };

    this.socket.onclose = () => {
      console.log('WebSocket déconnecté');
      this.connectionStatus$.next(false);
    };
  }

  private subscribeToNewCoins(sub:any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const subMessage = 'SUB ' + sub + '\r\n';
      console.log('Envoi de la souscription:', subMessage);
      this.socket.send(subMessage);
    }
  }
  
  private sendConnectPacket(sub:any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const connectMessage = {
        type: 'CONNECT',
        payload: this.connectParams
      };
      
      // Construire le message CONNECT au format NATS
      const connectString = `CONNECT ${JSON.stringify(this.connectParams)}\r\n`;
      
      console.log('Sending CONNECT packet:', connectString);
      this.socket.send(connectString);

      // Envoyer PING après CONNECT pour vérifier la connexion
      this.socket.send('PING\r\n');

      this.subscribeToNewCoins(sub)

    }
  }

  // S'abonner à un sujet NATS
  subscribe(subject: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const subMessage = `SUB ${subject} ${Date.now()}\r\n`;
      console.log('Subscribing to:', subject);
      this.socket.send(subMessage);
    }
  }

  // Publier sur un sujet NATS
  publish(subject: string, data: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(data);
      const pubMessage = `PUB ${subject} ${message.length}\r\n${message}\r\n`;
      this.socket.send(pubMessage);
    }
  }

  private handleBinaryMessage(buffer: ArrayBuffer) {
    try {
      // Convertir le buffer en string UTF-8
      const decoder = new TextDecoder('utf-8');
      const fullMessage = decoder.decode(buffer);
      
      // Séparer le message en lignes
      const lines = fullMessage.split('\n');
      // Supprimer la première ligne (MSG newCoinCreated.prod 1 1175)
      const jsonString = lines.slice(1).join('\n').trim();
    
      // Parser le JSON
      try {
        const jsonData = JSON.parse(jsonString);
        
        this.messages$.next({
          type: 'binary',
          header: lines[0],
          data: jsonData,
          raw: fullMessage,
          timestamp: new Date()
        });
      } catch (jsonError) {
        console.error('Erreur parsing JSON:', jsonError);
        this.messages$.next({
          type: 'binary',
          header: lines[0],
          text: jsonString,
          error: 'Invalid JSON',
          raw: fullMessage,
          timestamp: new Date()
        });
      }
  
    } catch (error) {
      console.error('Erreur décodage binaire:', error);
      
      // En cas d'erreur, afficher les données hexadécimales
      const hexString = Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
        
      this.messages$.next({
        type: 'binary',
        error: 'e',
        hex: hexString,
        timestamp: new Date()
      });
    }
  }
  

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

