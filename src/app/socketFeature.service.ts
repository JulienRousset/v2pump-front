// src/app/services/socket.service.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface CoinData {
  id: number;
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image_uri: string;
  video_uri?: string;
  market_cap: number;
  usd_market_cap?: number;
  twitter?: string;
  telegram?: string;
  website?: string;
  creator?: string;
  created_timestamp: Date;
  complete: boolean;
  associated_bonding_curve?: string;
  bonding_curve?: string;
  king_of_the_hill_timestamp?: Date;
  source: string;
  reply_count?: number;
  current_viewers?: number;
  nsfw?: boolean;
  is_currently_live?: boolean;
  virtualTokenReserves?: number;
  virtualSolReserves?: number;
  realTokenReserves?: number;
  realSolReserves?: number;
  tokenTotalSupply?: number;
  targetKingMarketCapUSD?: number;
  priceSOL?: number;
  priceUSD: number;
  kingProgress?: number;
  currentStats?: {
    price: number;
    marketCap: number;
    priceChanges: {
      '1m'?: number;
      '5m'?: number;
      '30m'?: number;
      '1h'?: number;
      '24h'?: number;
    };
    tradingStats: {
      uniqueWallets24h?: number;
      volume24h?: number;
      trades24h?: number;
    };
    holders?: number;
    liquidity?: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class SocketFeatureService {
  private socket: Socket | null = null;
  private coinFeatures = new BehaviorSubject<CoinData | null>(null);
  private historyFeatures = new BehaviorSubject<CoinData | null>(null);
  private coinHistory = new BehaviorSubject<CoinData[]>([]);
  private connected = new BehaviorSubject<boolean>(false);
  private connectionErrors = new BehaviorSubject<string | null>(null);
  public historyFeature = [];

  constructor() {}

  /**
   * Initialise la connexion au serveur Socket.IO
   */
  connect(): void {
    try {
      if (this.socket) {
        this.disconnect();
      }

      // Connexion au serveur Socket.IO
      this.socket = io('http://localhost:3002', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000
      });

      // Événement de connexion réussie
      this.socket.on('connect', () => {
        console.log('Connecté au serveur Socket.IO');
        this.connected.next(true);
        this.connectionErrors.next(null);
      });

      // Événement de déconnexion
      this.socket.on('disconnect', (reason) => {
        console.warn('Déconnecté du serveur Socket.IO:', reason);
        this.connected.next(false);
        if (reason === 'io server disconnect') {
          setTimeout(() => this.socket?.connect(), 5000);
        }
      });

      // Événement d'erreur
      this.socket.on('connect_error', (error) => {
        console.error('Erreur de connexion Socket.IO:', error);
        this.connectionErrors.next(error.message);
        this.connected.next(false);
      });

      this.socket.on('history', (data) => {
       this.historyFeatures.next(data);

      });

      // Écoute des événements spécifiques
      this.socket.on('coinFeature', (data: CoinData) => {
        console.log('Nouvelle crypto reçue:', data);
        this.coinFeatures.next(data);
        
        // Ajouter à l'historique des coins
        const history = this.coinHistory.value;
        
        // Vérifier si le coin existe déjà dans l'historique
        const existingIndex = history.findIndex(coin => coin.mint === data.mint);
        
        if (existingIndex !== -1) {
          // Mettre à jour la version existante
          const updatedHistory = [...history];
          updatedHistory[existingIndex] = data;
          this.coinHistory.next(updatedHistory);
        } else {
          // Ajouter le nouveau coin au début (le plus récent en premier)
          this.coinHistory.next([data, ...history].slice(0, 50)); // Limiter à 50 coins
        }
      });
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de Socket.IO:', error);
      this.connectionErrors.next('Erreur d\'initialisation de la connexion');
      this.connected.next(false);
    }
  }

  /**
   * Déconnecte du serveur Socket.IO
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected.next(false);
    }
  }

  /**
   * Récupère le dernier coin reçu
   */
  getLatestCoin(): Observable<CoinData | null> {
    return this.coinFeatures.asObservable();
  }

  getHistory(): Observable<CoinData | null> {
    return this.historyFeatures.asObservable();
  }

  /**
   * Récupère l'historique des coins reçus
   */
  getCoinHistory(): Observable<CoinData[]> {
    return this.coinHistory.asObservable();
  }

  /**
   * Vérifie si la connexion est active
   */
  isConnected(): Observable<boolean> {
    return this.connected.asObservable();
  }

  /**
   * Récupère les erreurs de connexion
   */
  getConnectionErrors(): Observable<string | null> {
    return this.connectionErrors.asObservable();
  }

  /**
   * Force la mise à jour de l'état de connexion
   */
  checkConnectionStatus(): boolean {
    const isConnected = this.socket?.connected || false;
    this.connected.next(isConnected);
    return isConnected;
  }
}
