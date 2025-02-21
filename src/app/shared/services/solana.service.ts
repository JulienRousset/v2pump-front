import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { Connection, PublicKey, VersionedTransaction, Commitment, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TokenService } from 'src/app/token.service';
import { ErrorService } from 'src/app/error.service';

@Injectable({
  providedIn: 'root'
})
export class SolanaService {
  public connection: Connection;
  public wallet: any;
  private readonly API_URL = 'http://127.0.0.1:3000/auth'; // URL de votre API

  private _isConnected = new BehaviorSubject<boolean>(false);
  private _session = new BehaviorSubject<string>('');
  private _balance = new BehaviorSubject<number>(0);

  isConnected$ = this._isConnected.asObservable();
  session$ = this._session.asObservable();
  balance$ = this._balance.asObservable();
  session: any;

  public _isInitialized = new BehaviorSubject<boolean>(false);
  isInitialized$ = this._isInitialized.asObservable();


  constructor(
    private http: HttpClient,
    public tokenService: TokenService,
    private errorService: ErrorService
  ) {
    this.connection = new Connection(
      'https://solana-mainnet.core.chainstack.com/84b4f9aec349544a405d9f430a5bbdc7',
    );
    this.initializeWallet();
  }

  async initializeWallet() {
    if ('solana' in window) {
      this.wallet = (window as any).solana;
      if (this.wallet.isPhantom) {
        console.log('Phantom wallet trouvé!');
        
        const token = this.tokenService.getToken();
        if (token) {
          try {
            const response = await this.wallet.connect({ onlyIfTrusted: true });
            const publicKey = response.publicKey.toString();
            
            await this.refreshToken();
            
            this.setupWalletListeners();
          } catch (error) {
            console.log('Auto-reconnexion échouée:', error);
            this.tokenService.clearToken();
            this._isConnected.next(false);
          }
        }
      }
    }
    // Indique que l'initialisation est terminée
    this._isInitialized.next(true);
  }

  private async refreshToken() {
    try {
      const token = this.tokenService.getToken();
      if (!token) return;

      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
      const response:any = await this.http.post(`${this.API_URL}/refresh`, {}, { headers }).toPromise();

      if (response && response['token']) {
        this.tokenService.setToken(response['token']);
        this.session = response['user'];
        this._isConnected.next(true);
        this._session.next(response['user'].wallet_address);
        await this.updateBalance(response['user'].wallet_address);
      }
    } catch (error) {
      this.handleWalletDisconnect();
    }
  }

  async connect(): Promise<void> {
    try {
      if (!this.wallet) {
        throw new Error('Phantom wallet non trouvé!');
      }

      const response = await this.wallet.connect();
      const publicKey = response.publicKey.toString();

      // Obtenir le nonce
      const nonceResponse:any = await this.http.post(`${this.API_URL}/nonce`, {
        publicKey: publicKey
      }).toPromise();

      const message = nonceResponse['nonce'];
      const encodedMessage = new TextEncoder().encode(message);
      const signedMessage = await this.wallet.signMessage(encodedMessage, 'utf8');

      // Vérifier la signature
      const verifyResponse:any = await this.http.post(`${this.API_URL}/verify-wallet`, {
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
        console.log(this.session);
      }

    } catch (error) {
      this.errorService.handleError(error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      const token = this.tokenService.getToken();
      if (token) {
        // const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
        // await this.http.post(`${this.API_URL}/logout`, {}, { headers }).toPromise();
      }

      await this.handleWalletDisconnect();
      if (this.wallet) {
        await this.wallet.disconnect();
      }
    } catch (error) {
      this.errorService.handleError(error);
    }
  }

  private async handleWalletDisconnect() {
    this.tokenService.clearToken();
    this._isConnected.next(false);
    this._session.next('');
    this._balance.next(0);
    this.session = null;
  }

  private setupWalletListeners() {
    if (this.wallet) {
      this.wallet.on('disconnect', () => this.handleWalletDisconnect());
      this.wallet.on('accountChanged', () => this.handleWalletDisconnect());
    }
  }

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
      return this.errorService.handleError(error);
    }
  }

  async updateBalance(address: string): Promise<void> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      this._balance.next(balance / LAMPORTS_PER_SOL);
    } catch (error) {
      this.errorService.handleError(error);
    }
  }
}
