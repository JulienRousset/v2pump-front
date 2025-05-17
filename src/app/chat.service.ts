import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { TokenService } from './token.service';
import { io, Socket } from 'socket.io-client';

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
export class ChatService implements OnDestroy {
  // Subjects et Observables
  private messagesSubject = new Subject<any>();
  public messages$ = this.messagesSubject.asObservable();
  private socketStatus$ = new BehaviorSubject<boolean>(false);
  private viewerCountSubject = new BehaviorSubject<any>(0);
  public viewerCount$ = this.viewerCountSubject.asObservable();

  // Propriétés de connexion
  private socket: Socket | null = null;
  private currentCoinId: string | null = null;
  private currentToken: string | null = null;
  private isSubscribing = false;
  private blockedFromReconnecting = false;
  private blockReconnectTimer: any = null;
  private lastBlockTime = 0;

  // Propriétés de reconnexion
  private manualDisconnect = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: any = null;
  private reconnectTimeouts: any[] = [];
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  
  // Configuration
  private readonly SOCKET_URL = 'http://localhost:3001';
  private readonly API_URL = 'http://localhost:3000';

  constructor(public tokenService: TokenService) {
    this.setupEventHandling();
  }

  // ======= MÉTHODES DE GESTION DE LA CONNEXION =======

  /**
   * Initialise la connexion Socket.IO
   */
  private initializeSocket() {
    // Fermer la connexion existante si elle existe
    this.closeExistingConnection();

    // Configurer les options pour Socket.IO
    const socketOptions = {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: false, // Nous gérons notre propre reconnexion
      query: {
        coinId: this.currentCoinId,
        // Ne pas envoyer le token en query parameter pour des raisons de sécurité
      },
      timeout: 20000 // 20 secondes de timeout
    };

    // Créer une nouvelle connexion
    this.socket = io(this.SOCKET_URL, socketOptions);

    // Configurer les gestionnaires d'événements
    this.socket.on('connect', () => {
      this.socketStatus$.next(true);
      this.reconnectAttempts = 0;
      this.consecutiveFailures = 0;
      this.clearAllReconnectTimeouts();
      
      // Suppression de l'appel direct pour éviter la double souscription
      // La souscription sera gérée par le listener socketStatus$
    });

    this.socket.on('disconnect', (reason) => {
      this.socketStatus$.next(false);

      // Gérer les différentes raisons de déconnexion
      if (reason === 'io server disconnect') {
        // Déconnexion du serveur - peut nécessiter une reconnexion manuelle
        this.blockedFromReconnecting = true;
        this.lastBlockTime = Date.now();
        this.manageReconnectionBlock(30000); // 30 secondes de blocage
      } else if (reason === 'transport close') {
        // La connexion a été fermée
        this.consecutiveFailures++;
      }

      // Tentative de reconnexion si nécessaire
      if (!this.manualDisconnect && !this.blockedFromReconnecting && this.currentCoinId) {
        this.attemptReconnect();
      }
    });
 
    this.socket.on('error', (error) => {
      console.error('Erreur Socket.IO:', error);
      this.socketStatus$.next(false);
    });

    // Ajout d'un gestionnaire d'erreur de connexion
    this.socket.on('connect_error', (error) => {
      console.error('Erreur de connexion Socket.IO:', error);
      this.socketStatus$.next(false);
      
      // Forcer une tentative de reconnexion après un délai
      setTimeout(() => {
        if (this.currentCoinId && !this.manualDisconnect) {
          // Réinitialiser les drapeaux qui pourraient bloquer la reconnexion
          this.blockedFromReconnecting = false;
          this.connectToCoin(this.currentCoinId, this.currentToken);
        }
      }, 3000);
    });

    // Configurer les gestionnaires de messages
    this.setupMessageHandlers();
  }

  /**
   * Configure les gestionnaires de messages pour Socket.IO
   */
  private setupMessageHandlers() {
    if (!this.socket) return;

    // Messages du chat
    this.socket.on('new_message', (data) => {
      this.messagesSubject.next({
        type: 'new_message',
        ...data
      });
    });

    // Mises à jour des "j'aime"
    this.socket.on('like_update', (data) => {
      this.messagesSubject.next({
        type: 'like_update',
        ...data
      });
    });

    // Messages supprimés
    this.socket.on('message_deleted', (data) => {
      this.messagesSubject.next({
        type: 'message_deleted',
        ...data
      });
    });

    // Messages épinglés
    this.socket.on('pin_update', (data) => {
      this.messagesSubject.next({
        type: 'pin_update',
        ...data
      });
    });

    this.socket.on('user_writing', (data) => {
      this.messagesSubject.next({
        type: 'user_writing',
        ...data
      });
    });

    // Utilisateurs bannis
    this.socket.on('user_banned', (data) => {
      this.messagesSubject.next({
        type: 'user_banned',
        ...data
      });
    });

    // Compteur de spectateurs
    this.socket.on('viewer_count', (data) => {
      this.viewerCountSubject.next(data.count);
      this.messagesSubject.next({
        type: 'viewer_count',
        ...data
      });
    });

    this.socket.on('viewer_add', (data) => {
      this.viewerCountSubject.next(data.count);
      this.messagesSubject.next({
        type: 'viewer_add',
        ...data
      });
    });

    // Mise à jour du statut de streaming
    this.socket.on('stream_status_update', (data) => {
      this.messagesSubject.next({
        type: 'stream_status_update',
        ...data
      });
    });

    // Confirmation d'abonnement
    this.socket.on('subscription_status', (data) => {
      this.isSubscribing = false;
      this.messagesSubject.next({
        type: 'subscription_status',
        ...data
      });
    });

    // Gestion des erreurs
    this.socket.on('error', (data) => {
      this.messagesSubject.next({
        type: 'error',
        ...data
      });
    });
  }

  /**
   * Met en place le traitement des événements globaux
   */
  private setupEventHandling() {
    // Surveiller l'état de la connexion
    this.socketStatus$.subscribe(status => {
      if (status && this.currentCoinId && !this.isSubscribing) {
        this.subscribeToRoom();
      }
    });

    // Surveiller la visibilité de la page
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.currentCoinId && !this.isConnected()) {
        // La page est redevenue visible, tenter une reconnexion si déconnecté
        this.manualDisconnect = false;
        this.blockedFromReconnecting = false;
        if (this.currentCoinId) {
          this.connectToCoin(this.currentCoinId, this.currentToken);
        }
      }
    });
  }

  /**
   * Ferme la connexion existante
   */
  private closeExistingConnection() {
    if (this.socket) {
      try {
        this.socket.offAny(); // Supprimer tous les listeners
        this.socket.disconnect();
      } catch (e) {
        console.error('Erreur lors de la fermeture de la connexion existante:', e);
      }
      this.socket = null;
    }
  }

  /**
   * Gère le blocage temporaire de la reconnexion
   */
  private manageReconnectionBlock(duration: number) {
    this.blockedFromReconnecting = true;
    this.lastBlockTime = Date.now();
    
    if (this.blockReconnectTimer) {
      clearTimeout(this.blockReconnectTimer);
    }
    
    this.blockReconnectTimer = setTimeout(() => {
      this.blockedFromReconnecting = false;
    }, duration);
  }

  /**
   * Annule tous les timeouts de reconnexion
   */
  private clearAllReconnectTimeouts() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.reconnectTimeouts.forEach(timeout => {
      clearTimeout(timeout);
    });
    this.reconnectTimeouts = [];
  }

  /**
   * Tente une reconnexion avec délai exponentiel
   */
  private attemptReconnect(): void {
    // Réinitialiser le blocage si trop de temps est passé
    if (this.blockedFromReconnecting && Date.now() - this.lastBlockTime > 60000) {
      this.blockedFromReconnecting = false;
    }

    if (this.currentCoinId && !this.manualDisconnect) {
      // Limiter le nombre de tentatives si trop d'échecs consécutifs
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        
        // Réinitialisation après un délai
        setTimeout(() => {
          this.reconnectAttempts = 0;
          this.consecutiveFailures = 0;
          
          // Nouvelle tentative après la pause
          if (this.currentCoinId && !this.isConnected() && !this.manualDisconnect) {
            this.initializeSocket();
          }
        }, 30000); // 30 secondes
        return;
      }
      
      // Appliquer un délai exponentiel limité
      const delay = Math.min(30000, 1000 * Math.pow(1.5, this.reconnectAttempts));

      const newTimeout = setTimeout(() => {
        if (this.currentCoinId && !this.manualDisconnect) {
          this.reconnectAttempts++;
          this.initializeSocket();
        }
        
        // Nettoyer le timeout de la liste
        const index = this.reconnectTimeouts.indexOf(newTimeout);
        if (index !== -1) {
          this.reconnectTimeouts.splice(index, 1);
        }
      }, delay);

      this.reconnectTimeout = newTimeout;
      this.reconnectTimeouts.push(newTimeout);
    }
  }

  /**
   * Connecte le socket à une room de coin spécifique
   */
  connectToCoin(coinId: string, token: any) {
    if (!coinId) {
      console.error('Tentative de connexion avec un coinId invalide');
      return;
    }

    // Éviter les connexions multiples au même coin
    if (this.currentCoinId === coinId && this.isConnected() && this.currentToken === token) {
      return;
    }

    const coinIdChanged = this.currentCoinId !== coinId;

    // Si on veut changer de room et qu'on est connecté
    if (coinIdChanged && this.isConnected()) {      
      return new Promise<void>((resolve) => {
        // Déconnecter proprement l'ancienne connexion
        this.disconnect(false).then(() => {
          // Mettre à jour les informations et créer une nouvelle connexion
          this.manualDisconnect = false;
          this.currentToken = token;
          this.currentCoinId = coinId;
          
          setTimeout(() => {
            this.initializeSocket();
            resolve();
          }, 300);
        });
      });
    } else {
      // Cas standard: première connexion ou reconnexion à la même room
      this.manualDisconnect = false;
      
      // Nettoyer les reconnexions
      this.clearAllReconnectTimeouts();
      
      // Mise à jour des données
      this.currentToken = token;
      this.currentCoinId = coinId;
      
      // Nouvelle connexion
      this.initializeSocket();
    }
    return
  }

  /**
   * S'abonne à la room du coin actuel
   */
  private subscribeToRoom() {
    if (!this.currentCoinId || !this.socket || !this.socket.connected) {
      return;
    }

    this.isSubscribing = true;

    this.socket.emit('subscribe', {
      coinId: this.currentCoinId,
      token: this.currentToken
    });

    // Réinitialiser le flag après un délai pour éviter les blocages
    setTimeout(() => {
      this.isSubscribing = false;
    }, 2000);
  }

  /**
   * Déconnecte le service de chat
   */
  disconnect(forced = false) {
  
    // Marquer comme déconnexion volontaire
    this.manualDisconnect = true;
  
    // Blocage temporaire si forcée
    if (forced) {
      this.blockedFromReconnecting = true;
      this.lastBlockTime = Date.now();
      this.manageReconnectionBlock(5000); // 5 secondes
    }
  
    // Nettoyer les reconnexions
    this.clearAllReconnectTimeouts();
  
    return new Promise<void>((resolve) => {
      if (this.socket && this.socket.connected) {
        // Envoyer un événement de déconnexion avant de fermer
        this.socket.emit('unwatch_token', this.currentCoinId);
        
        // Définir un timeout au cas où la déconnexion prendrait du temps
        const disconnectTimeout = setTimeout(() => {
          this.finalizeDisconnect();
          resolve();
        }, 1000);
        
        // Écouter l'événement de déconnexion
        this.socket.once('disconnect', () => {
          clearTimeout(disconnectTimeout);
          this.finalizeDisconnect();
          resolve();
        });
        
        // Déconnecter le socket
        this.socket.disconnect();
      } else {
        this.finalizeDisconnect();
        resolve();
      }
    });
  }
  
  /**
   * Finalise la déconnexion
   */
  private finalizeDisconnect() {
    // Réinitialiser les données
    this.currentCoinId = null;
    this.currentToken = null;
    this.isSubscribing = false;
    this.reconnectAttempts = 0;
  
    // Fermer la connexion
    this.closeExistingConnection();
  
    this.socketStatus$.next(false);
  }

  // ======= MÉTHODES DE COMMUNICATION =======

  /**
   * Envoie un message de chat au serveur
   */
  send(message: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('message', {
        coinId: this.currentCoinId,
        content: message.content,
        parentMessageId: message.parentMessageId,
        token: this.currentToken,
        timestamp: Date.now()
      });
    } else {
      console.error('Impossible d\'envoyer le message: Socket non connecté');
      
      // Tentative de reconnexion si le socket est déconnecté
      if (this.currentCoinId && !this.manualDisconnect) {
        this.connectToCoin(this.currentCoinId, this.currentToken);
      }
    }
  }

  sendMessage(message: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(message.type, message);
    } else {
      console.error('Impossible d\'envoyer le message: Socket non connecté');
      
      // Tentative de reconnexion si le socket est déconnecté
      if (this.currentCoinId && !this.manualDisconnect) {
        this.connectToCoin(this.currentCoinId, this.currentToken);
      }
    }
  }

  /**
   * Envoie une action "j'aime" sur un message
   */
  likeMessage(messageId: number) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('like_message', {
        coinId: this.currentCoinId,
        messageId: messageId,
        token: this.currentToken
      });
    }
  }

  /**
   * Épingle/Désépingle un message
   */
  pinMessage(messageId: number, isPinned: boolean) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('pin_message', {
        coinId: this.currentCoinId,
        messageId: messageId,
        isPinned: isPinned,
        token: this.currentToken
      });
    }
  }

  /**
   * Bannit un utilisateur du chat
   */
  banUser(targetUserId: string, reason: string, duration: number) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('ban_user', {
        coinId: this.currentCoinId,
        targetUserId: targetUserId,
        reason: reason,
        duration: duration, // -1 pour permanent, sinon minutes
        token: this.currentToken
      });
    }
  }

  /**
   * Supprime un message
   */
  deleteMessage(messageId: number) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('delete_message', {
        coinId: this.currentCoinId,
        messageId: messageId,
        token: this.currentToken
      });
    }
  }

  // ======= MÉTHODES DE REQUÊTES HTTP =======

  /**
   * Récupère l'historique des messages du chat
   */
  async getChatHistory(
    coinId: string,
    offset: number = 0,
    limit: number = 50,
    lastMessageTimestamp?: number,
    userId?: any
  ): Promise<any> {
    try {
      let url = `${this.API_URL}/chat/history?coinId=${coinId}&offset=${offset}&limit=${limit}`;

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

  /**
   * Récupère l'historique des messages épinglés
   */
  async getChatHistoryPinned(
    coinId: string,
    offset: number = 0,
    limit: number = 50,
    lastMessageTimestamp?: number,
    userId?: any
  ): Promise<any> {
    try {
      let url = `${this.API_URL}/chat/pinned/history?coinId=${coinId}&offset=${offset}&limit=${limit}`;

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

  /**
   * Récupère la liste des modérateurs
   */
  async getModerators(
    coinId: string,
    offset: number = 0,
    limit: number = 50,
    searchTerm?: string
  ): Promise<any> {
    try {
      let url = `${this.API_URL}/chat/moderators?coinId=${coinId}&offset=${offset}&limit=${limit}`;

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

  /**
   * Ajoute un modérateur
   */
  async addModerator(coinId: string, walletAddress: string): Promise<any> {
    try {
      const response = await fetch(`${this.API_URL}/chat/moderator/add`, {
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

  /**
   * Supprime un modérateur
   */
  async removeModerator(coinId: string, userId: string): Promise<any> {
    try {
      const response = await fetch(`${this.API_URL}/chat/moderator/remove`, {
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

  /**
   * Récupère la liste des membres bannis
   */
  async getBannedMembers(
    coinId: string,
    offset: number = 0,
    limit: number = 50,
    searchTerm?: string
  ): Promise<any> {
    try {
      let url = `${this.API_URL}/chat/banned/members?coinId=${coinId}&offset=${offset}&limit=${limit}`;

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
      console.error('Error fetching banned members:', error);
      throw error;
    }
  }

  /**
   * Débannit un membre
   */
  async unbanMember(coinId: string, userId: string): Promise<any> {
    try {
      const response = await fetch(`${this.API_URL}/chat/unban`, {
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

  // ======= MÉTHODES UTILITAIRES ET GETTERS =======

  /**
   * Retourne l'observable du statut de la connexion socket
   */
  getSocketStatus(): Observable<boolean> {
    return this.socketStatus$.asObservable();
  }

  /**
   * Retourne l'observable du compteur de spectateurs
   */
  getViewerCount(): Observable<number> {
    return this.viewerCountSubject.asObservable();
  }

  /**
   * Vérifie si la connexion est active
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.connected && this.socketStatus$.value === true;
  }

  /**
   * Retourne l'identifiant du coin actuel
   */
  getCurrentCoinId(): string | null {
    return this.currentCoinId;
  }

  /**
   * Retourne le token actuel
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Nettoie les ressources lors de la destruction du service
   */
  ngOnDestroy() {
    this.clearAllReconnectTimeouts();

    if (this.blockReconnectTimer) {
      clearTimeout(this.blockReconnectTimer);
    }
    
    this.closeExistingConnection();
  }
}
