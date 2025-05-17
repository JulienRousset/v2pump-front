import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { 
  Connection, 
  PublicKey, 
  VersionedTransaction, 
  Commitment, 
  LAMPORTS_PER_SOL,
  Transaction
} from '@solana/web3.js';
import { TokenService } from 'src/app/token.service';
import { ErrorService } from 'src/app/error.service';

@Injectable({
  providedIn: 'root'
})
export class SolanaService {
  public connection: Connection;
  public wallet: any;
  private readonly API_URL = 'http://127.0.0.1:3000/auth'; // URL de votre API
  private balanceRefreshInterval: Subscription | null = null;
  private readonly REFRESH_INTERVAL = 30000; // 30 secondes

  private _isConnected = new BehaviorSubject<boolean>(false);
  private _session = new BehaviorSubject<string>('');
  private _balance = new BehaviorSubject<number>(0);
  public _isInitialized = new BehaviorSubject<boolean>(false);

  isConnected$ = this._isConnected.asObservable();
  session$ = this._session.asObservable();
  balance$ = this._balance.asObservable();
  isInitialized$ = this._isInitialized.asObservable();
  
  session: any;

  constructor(
    private http: HttpClient,
    public tokenService: TokenService,
    private errorService: ErrorService
  ) {
    this.connection = new Connection(
      'https://solana-mainnet.g.alchemy.com/v2/_S-RWr4ab6o1bFhZkKpDLYkU-x9VWUqV',
      { commitment: 'confirmed' }
    );
    this.initializeWallet();
  }

  /**
   * Initialise le wallet Phantom et tente une reconnexion automatique si un token existe
   */
  async initializeWallet() {
    try {
      if ('solana' in window) {
        this.wallet = (window as any).solana;
        if (this.wallet.isPhantom) {
          console.log('Phantom wallet trouvé!');
          
          const token = this.tokenService.getToken();
          if (token) {
            try {
              const response = await this.wallet.connect({ onlyIfTrusted: true });
              
              await this.refreshToken();
              
              if (this._isConnected.value) {
                this.setupWalletListeners();
                this.startBalanceRefresh();
              }
            } catch (error) {
              console.log('Auto-reconnexion échouée:', error);
              this.tokenService.clearToken();
              this._isConnected.next(false);
            }
          }
        } else {
          console.log('Phantom wallet non détecté');
        }
      } else {
        console.log('Phantom wallet non détecté - solana non disponible dans window');
      }
    } catch (error) {
      this.errorService.handleError(error);
    } finally {
      // Indique que l'initialisation est terminée
      this._isInitialized.next(true);
    }
  }

  /**
   * Rafraîchit le token d'authentification
   */
  private async refreshToken() {
    try {
      const token = this.tokenService.getToken();
      if (!token) return;

      const response: any = await this.http.post(`${this.API_URL}/refresh`, {}).toPromise();

      if (response && response['token']) {
        this.tokenService.setToken(response['token']);
        this.session = response['user'];
        this._isConnected.next(true);
        this._session.next(response['user'].wallet_address);
        await this.updateBalance(response['user'].wallet_address);
      }
    } catch (error) {
      this.handleWalletDisconnect();
      this.errorService.handleError('Erreur lors du rafraîchissement du token');
    }
  }

  /**
   * Connecte le wallet Phantom et authentifie l'utilisateur
   */
  async connect(): Promise<void> {
    try {
      if (!this.wallet) {
        throw new Error('Phantom wallet non trouvé!');
      }

      const response = await this.wallet.connect();
      const publicKey = response.publicKey.toString();

      // Obtenir le nonce
      const nonceResponse: any = await this.http.post(`${this.API_URL}/nonce`, {
        publicKey: publicKey
      }).toPromise();

      const message = nonceResponse['nonce'];
      const encodedMessage = new TextEncoder().encode(message);
      const signedMessage = await this.wallet.signMessage(encodedMessage, 'utf8');

      // Vérifier la signature
      const verifyResponse: any = await this.http.post(`${this.API_URL}/verify-wallet`, {
        publicKey: publicKey,
        signature: Array.from(signedMessage.signature),
        message: message
      }).toPromise();

      if (verifyResponse && verifyResponse['token']) {
        this.tokenService.setToken(verifyResponse['token']);
        this.session = verifyResponse['user'];
        this._isConnected.next(true);
        this._session.next(verifyResponse['user'].wallet_address);
        await this.updateBalance(verifyResponse['user'].wallet_address);
        this.setupWalletListeners();
        this.startBalanceRefresh();
        console.log('Utilisateur connecté:', this.session);
      }

    } catch (error) {
      this.errorService.handleError('Erreur lors de la connexion au wallet');
      throw error;
    }
  }

  /**
   * Déconnecte le wallet et efface les données de session
   */
  async disconnect(): Promise<void> {
    try {
      const token = this.tokenService.getToken();
      if (token) {
        // Décommenter si vous souhaitez appeler le backend lors de la déconnexion
        // const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
        // await this.http.post(`${this.API_URL}/logout`, {}, { headers }).toPromise();
      }

      this.stopBalanceRefresh();
      await this.handleWalletDisconnect();
      
      if (this.wallet) {
        await this.wallet.disconnect();
      }
    } catch (error) {
      this.errorService.handleError('Erreur lors de la déconnexion');
    }
  }

  /**
   * Gère la déconnexion du wallet
   */
  private async handleWalletDisconnect() {
    this.tokenService.clearToken();
    this._isConnected.next(false);
    this._session.next('');
    this._balance.next(0);
    this.session = null;
    this.stopBalanceRefresh();
  }

  /**
   * Configure les écouteurs d'événements du wallet
   */
  private setupWalletListeners() {
    if (this.wallet) {
      // S'assurer de ne pas ajouter des écouteurs en double
      this.wallet.off('disconnect');
      this.wallet.off('accountChanged');
      
      this.wallet.on('disconnect', () => {
        console.log('Wallet disconnected event');
        this.handleWalletDisconnect();
      });
      
      this.wallet.on('accountChanged', async (newPublicKey: PublicKey) => {
        console.log('Wallet account changed event');
        if (newPublicKey) {
          // Si l'utilisateur a changé de compte mais est toujours connecté
          await this.handleWalletDisconnect();
          // Vous pourriez implémenter une reconnexion automatique ici si nécessaire
        } else {
          await this.handleWalletDisconnect();
        }
      });
    }
  }

  /**
   * Envoie une transaction de swap
   */
  async sendSwapTransaction(serializedTransaction: string): Promise<string> {
    try {
      if (!this.wallet?.publicKey || !this._isConnected.value) {
        // Tenter de reconnecter si nécessaire
        await this.initializeWallet();
        
        if (!this.wallet?.publicKey || !this._isConnected.value) {
          throw new Error('Wallet non connecté. Veuillez vous reconnecter.');
        }
      }

      const transactionBuffer = Buffer.from(serializedTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      const { blockhash } = await this.connection.getLatestBlockhash('finalized');
      transaction.message.recentBlockhash = blockhash;

      const signedTransaction = await this.wallet.signTransaction(transaction);

      const obj = {
        skipPreflight: true,
        preflightCommitment: 'processed' as Commitment,
        maxRetries: 5,
        priority: 'high'
      };

      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        obj
      );

      await this.updateBalance(this.wallet.publicKey.toString());
      return signature;

    } catch (error) {
      return this.errorService.handleError('Erreur lors de l\'envoi de la transaction');
    }
  }

  /**
   * Met à jour le solde du wallet
   * @param address Adresse du wallet à mettre à jour
   */
  async updateBalance(address: string): Promise<void> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      this._balance.next(balance / LAMPORTS_PER_SOL);
    } catch (error) {
      this.errorService.handleError('Erreur lors de la mise à jour du solde');
    }
  }

  /**
   * Met à jour le solde du wallet - Fonction manquante nécessaire pour JupiterService
   * @param newBalance Nouveau solde en SOL
   */
  updateWalletBalance(newBalance: number): void {
    this._balance.next(newBalance);
  }

  /**
   * Estime le nouveau solde après une transaction
   * @param transactionCost Coût estimé de la transaction en SOL
   * @param additionalAmount Montant supplémentaire à ajouter/soustraire en SOL
   */
  estimateBalanceAfterTransaction(transactionCost: number, additionalAmount: number = 0): void {
    const currentBalance = this._balance.value;
    const estimatedBalance = currentBalance - transactionCost + additionalAmount;
    this._balance.next(Math.max(0, estimatedBalance)); // Évite les soldes négatifs
  }

  /**
   * Démarre le rafraîchissement périodique du solde
   */
  private startBalanceRefresh(): void {
    this.stopBalanceRefresh(); // S'assurer qu'il n'y a pas d'intervalle existant
    
    this.balanceRefreshInterval = interval(this.REFRESH_INTERVAL).subscribe(() => {
      if (this._isConnected.value && this.session?.wallet_address) {
        this.updateBalance(this.session.wallet_address).catch(error => 
          console.error('Erreur lors du rafraîchissement périodique du solde:', error)
        );
      }
    });
  }

  /**
   * Arrête le rafraîchissement périodique du solde
   */
  private stopBalanceRefresh(): void {
    if (this.balanceRefreshInterval) {
      this.balanceRefreshInterval.unsubscribe();
      this.balanceRefreshInterval = null;
    }
  }

  /**
   * Obtient le solde actuel en SOL
   */
  getCurrentBalance(): number {
    return this._balance.value;
  }

  /**
   * Vérifie si l'utilisateur est connecté
   */
  isUserConnected(): boolean {
    return this._isConnected.value;
  }

  /**
   * Force le rafraîchissement du solde immédiatement
   */
  async forceBalanceRefresh(): Promise<void> {
    if (this._isConnected.value && this.session?.wallet_address) {
      await this.updateBalance(this.session.wallet_address);
    }
  }
}
