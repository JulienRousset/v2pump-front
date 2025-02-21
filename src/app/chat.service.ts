import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { TokenService } from './token.service';

export interface ChatMessage {
  type: 'message' | 'like_message' | 'new_message' | 'like_update';
  id?: number;
  coinId: string;
  content?: string;
  timestamp?: number;
  sender?: string;
  parentMessageId?: number;
  messageId?: number;
  userId?: string;
  senderId?: string;
  likesCount?: number;
  repliesCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private messagesSubject = new Subject<any>();
  public messages$ = this.messagesSubject.asObservable();
  private socket: Socket | null = null;
  private socketStatus$ = new BehaviorSubject<boolean>(false);
  
  private currentCoinId: string | null = null;
  private currentToken: string | null = null;
  private isSubscribing = false;

  constructor(public tokenService: TokenService) {
    this.handleConnectionStatus();
  }

  private initializeSocket() {
    if (this.socket) {
      this.socket.disconnect();
    }
  
    this.socket = io('https://v2pump.serveo.net', {
      transports: ['websocket'],
      reconnection: true
    });
  
    // Événements de base
    this.socket.on('connect', () => {
      console.log('Connection Socket.IO établie');
      this.socketStatus$.next(true);
      if (this.currentCoinId) {
        this.subscribeToChannel();
      }
    });
  
    this.socket.on('disconnect', () => {
      console.log('Connection Socket.IO fermée');
      this.socketStatus$.next(false);
    });
  
    // Écouteurs pour les différents types de messages
    this.socket.on('new_message', (message: any) => {
      this.messagesSubject.next({ type: 'new_message', ...message });
    });
  
    this.socket.on('like_update', (data: any) => {
      this.messagesSubject.next({
        type: 'like_update',
        messageId: data.messageId,
        likesCount: data.likesCount,
        isLiked: data.isLiked,
        userId: data.userId
      });
    });
  
    this.socket.on('pin_update', (message: any) => {
      this.messagesSubject.next({ type: 'pin_update', ...message });
    });
  
    this.socket.on('message_deleted', (messageId: any) => {
      this.messagesSubject.next({ ...messageId, type: 'message_deleted' });
    });
  
    this.socket.on('user_banned', (data: any) => {
      this.messagesSubject.next({ type: 'user_banned', ...data });
    });
  
    this.socket.on('viewer_count', (count: any) => {
      this.messagesSubject.next({ type: 'viewer_count', ...count });
    });
  
    // Gestion des erreurs
    this.socket.on('error', (error: any) => {
      console.error('Erreur Socket.IO:', error);
      this.socketStatus$.next(false);
    });
  }

  private handleConnectionStatus() {
    this.socketStatus$.subscribe(status => {
      if (status && this.currentCoinId && !this.isSubscribing) {
        this.subscribeToChannel();
      }
    });
  }

  private subscribeToChannel() {
    if (!this.currentCoinId || this.isSubscribing || !this.socket) {
      return;
    }

    this.isSubscribing = true;
    console.log('Souscription au coin:', this.currentCoinId);
    
    this.socket.emit('subscribe', {
      coinId: this.currentCoinId,
      token: this.currentToken
    });

    setTimeout(() => {
      this.isSubscribing = false;
    }, 1000);
  }

  connectToCoin(coinId: string, token: any) {
    if (this.currentCoinId === coinId && this.socketStatus$.value) {
      console.log('Déjà connecté à ce coin');
      return;
    }

    this.currentCoinId = coinId;
    this.currentToken = token;

    if (!this.socket) {
      this.initializeSocket();
    } else {
      this.subscribeToChannel();
    }
  }

  sendMessage(message: any) {
    if (this.socket?.connected) {
      this.socket.emit(message.type, message);
    } else {
      console.error('Impossible d\'envoyer le message: Socket non connecté');
    }
  }

  send(message: any) {
    console.log(message);
    if (this.socket?.connected) {
      this.socket.emit('message', message);
    } else {
      console.error('Impossible d\'envoyer le message: Socket non connecté');
    }
  }

  async getChatHistory(
    coinId: string,
    offset: number = 0,
    limit: number = 50,
    lastMessageTimestamp?: number,
    userId?: any
  ): Promise<any> {
    try {
      let url = `http://127.0.0.1:3000/chat/history?coinId=${coinId}&offset=${offset}&limit=${limit}`;

      if (lastMessageTimestamp) {
        url += `&lastMessageTimestamp=${lastMessageTimestamp}`;
      }

      if (userId) {
        url += `&userId=${userId}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching chat history:', error);
      throw error;
    }
  }

  async getChatHistoryPinned(
    coinId: string,
    offset: number = 0,
    limit: number = 50,
    lastMessageTimestamp?: number,
    userId?: any
  ): Promise<any> {
    try {
      let url = `http://127.0.0.1:3000/chat/pinned/history?coinId=${coinId}&offset=${offset}&limit=${limit}`;

      if (lastMessageTimestamp) {
        url += `&lastMessageTimestamp=${lastMessageTimestamp}`;
      }

      if (userId) {
        url += `&userId=${userId}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching pinned chat history:', error);
      throw error;
    }
  }

  async getModerators(
    coinId: string,
    offset: number = 0,
    limit: number = 50,
    searchTerm?: string
  ): Promise<any> {
    try {
      let url = `http://127.0.0.1:3000/chat/moderators?coinId=${coinId}&offset=${offset}&limit=${limit}`;

      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokenService.getToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching moderators:', error);
      throw error;
    }
  }

  async addModerator(coinId: string, walletAddress: string): Promise<any> {
    try {
      const response = await fetch('http://127.0.0.1:3000/chat/moderator/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokenService.getToken()}`
        },
        body: JSON.stringify({
          coinId,
          walletAddress
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error adding moderator:', error);
      throw error;
    }
  }

  async removeModerator(coinId: string, userId: string): Promise<any> {
    try {
      const response = await fetch('http://127.0.0.1:3000/chat/moderator/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokenService.getToken()}`
        },
        body: JSON.stringify({
          coinId,
          userId
        })
      });

      const data = await response.json();
      if (data.status === 200) {
        return data;
      } else {
        throw new Error(data.message || 'Failed to remove moderator');
      }
    } catch (error) {
      console.error('Error removing moderator:', error);
      throw error;
    }
  }

  async getBannedMembers(
    coinId: string,
    offset: number = 0,
    limit: number = 50,
    searchTerm?: string
  ): Promise<any> {
    try {
      let url = `http://127.0.0.1:3000/chat/banned/members?coinId=${coinId}&offset=${offset}&limit=${limit}`;

      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokenService.getToken()}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Gérer l'expiration du token si nécessaire
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching banned members:', error);
      throw error;
    }
  }

  async unbanMember(coinId: string, userId: string): Promise<any> {
    try {
      const response = await fetch('http://127.0.0.1:3000/chat/unban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokenService.getToken()}`
        },
        body: JSON.stringify({
          coinId,
          userId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error unbanning member:', error);
      throw error;
    }
  }

  disconnect() {
    this.currentCoinId = null;
    this.currentToken = null;
    this.isSubscribing = false;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.socketStatus$.next(false);
  }

  getSocketStatus(): Observable<boolean> {
    return this.socketStatus$.asObservable();
  }

}
