import { Injectable, NgZone } from '@angular/core';
import { Connection, PublicKey, Commitment, clusterApiUrl, ConfirmOptions, Transaction, Signer } from '@solana/web3.js';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { BehaviorSubject } from 'rxjs';
import { AnchorProvider, getProvider, setProvider } from '@project-serum/anchor';
import { HttpClient } from '@angular/common/http';
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes';

@Injectable({
  providedIn: 'root'
})
export class PhantomConnectService {
  private network: string = clusterApiUrl('devnet'); // Réseau : devnet/testnet/mainnet-beta
  private comm: Commitment = 'processed'; // État de la transaction
  private connection = new Connection(this.network, this.comm); // Connexion réseau
  public phantom?: PhantomWalletAdapter; // Wallet Phantom Adapter

  private publicKey = new BehaviorSubject<PublicKey | null>(null);
  public listenPublicKey = this.publicKey.asObservable();

  public walletAddress!: string | null;

  private jwtToken: string | null = null; // Stocke le token JWT après authentification
  public pumpToken: any; // Stocke le token JWT après authentification

  constructor(
    private ngZone: NgZone,
    private httpClient: HttpClient // HttpClient pour parler avec le backend
  ) {
    this.checkStoredConnection();

  }

  async walletConnetThroughDeeplink(publicKey: string) {
    this.walletAddress = publicKey;
    this.setAnchorProviderMock();
    await this.authenticateWithBackend();
    this.publicKey.next(new PublicKey(publicKey));
    // Stocker après authentification réussie
    this.storeConnection();
  }




  // Méthode pour vérifier la connexion stockée
  private async checkStoredConnection() {
    const storedToken = localStorage.getItem('jwt_token');
    const storedPumpFunToken = localStorage.getItem('pumpfun_token');
    const storedWalletAddress = localStorage.getItem('wallet_address');

    if (storedToken && storedWalletAddress) {
      this.jwtToken = storedToken;
      this.walletAddress = storedWalletAddress;
      this.pumpToken = storedPumpFunToken;
      // Reconnecter le wallet Phantom
      try {
        this.phantom = new PhantomWalletAdapter();
        await this.phantom.connect();

        if (this.phantom.publicKey) {
          this.publicKey.next(this.phantom.publicKey);
          this.setAnchorProvider();

          // Vérifier si le token est toujours valide
          this.verifyToken();
        }
      } catch (error) {
        console.error('Erreur lors de la reconnexion:', error);
        this.clearStoredConnection();
      }
    }
  }

  // Méthode pour vérifier la validité du token
  private verifyToken() {
    this.httpClient.get('http://127.0.0.1:3000/api/auth/verify-token', {
      headers: {
        Authorization: `Bearer ${this.jwtToken}`
      }
    }).subscribe({
      next: (response: any) => {
        if (!response.valid) {
          this.clearStoredConnection();
        }
      },
      error: () => {
        this.clearStoredConnection();
      }
    });
  }

  // Stocker les informations de connexion
  private storeConnection() {
    if (this.jwtToken && this.walletAddress) {
      localStorage.setItem('jwt_token', this.jwtToken);
      localStorage.setItem('pumpfun_token', this.pumpToken);
      localStorage.setItem('wallet_address', this.walletAddress);
    }
  }

  // Effacer les informations de connexion
  private clearStoredConnection() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('wallet_address');
    localStorage.removeItem('pumpfun_token');
    this.jwtToken = null;
    this.walletAddress = null;
    this.pumpToken = null;
    this.publicKey.next(null);
  }

  /* ********** WALLET CONNEXION ********** */


  async walletConnect() {
    this.phantom = new PhantomWalletAdapter();
    await this.phantom.connect();

    if (this.phantom && this.phantom.publicKey) {
      this.walletAddress = this.phantom.publicKey.toString();
      this.setAnchorProvider();
      this.publicKey.next(this.phantom.publicKey);

      await this.authenticateWithBackend();
      // Stocker après authentification réussie
      this.storeConnection();
    }
  }

  // Modifier la méthode walletDisconnect
  async walletDisconnect() {
    this.clearStoredConnection();
    await this.phantom?.disconnect();
  }
  walletDisconnetThroughDeeplink(publicKey: string) {
    this.publicKey.next(null);
    this.walletAddress = null;
    this.jwtToken = null; // Réinitialisation du token JWT
  }

  /* ********** AUTHENTIFICATION BACKEND ********** */

  // Frontend PhantomConnectService
  private async authenticateWithBackend() {
    try {
      if (!this.phantom || !this.walletAddress) {
        throw new Error('Wallet not connected');
      }


      const timestamp = Date.now();
      const message = `Sign in to pump.fun: ${timestamp}`;
      const encodedMessage = new TextEncoder().encode(message);

      // Signer le message
      const signedMessage = await this.phantom.signMessage(encodedMessage);

      // Préparer les données pour l'API
      const authData = {
        address: this.walletAddress,
        message: message,
        timestamp: timestamp,
        signature: bs58.encode(signedMessage) // Utilisez bs58 pour encoder la signature
      };

      // Appel à l'API avec gestion des erreurs
      this.httpClient.post<{ success: boolean, token: string, message: string }>(
        'http://127.0.0.1:3000/api/auth/login',
        authData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      ).subscribe({
        next: (response) => {
          if (response.success && response.token) {
            this.jwtToken = response.token;
            this.storeConnection(); // Stocker après authentification réussie
          }
        },
        error: (error) => {
          console.error('Erreur d\'authentification:', error);
          this.jwtToken = null;
        }
      });

      // Appel à l'API avec gestion des erreurs
      this.httpClient.post<{ success: boolean, token: string, message: string }>(
        'http://127.0.0.1:3000/pumpfun2/auth/login',
        authData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      ).subscribe({
        next: (response) => {
          this.pumpToken = response.token;
          this.storeConnection(); // Stocker après authentification réussie

        },
        error: (error) => {
          console.error('Erreur d\'authentification pumpfun:', error);
          this.pumpToken = null;
        }
      });

    } catch (error) {
      console.error('Erreur lors de la signature:', error);
      this.jwtToken = null;
    }
  }


  getToken(): string | null {
    return this.jwtToken; // Permet de récupérer le token depuis d'autres services/components
  }

  /* ********** NETWORK CONEXION ********** */

  setAnchorProvider(): void {
    const opts: ConfirmOptions = { preflightCommitment: this.comm };
    const provider = new AnchorProvider(
      this.connection,
      (window as any).solana,
      opts
    );
    setProvider(provider);
  }

  setAnchorProviderMock(): void {
    if (!this.walletAddress) return;

    const opts: ConfirmOptions = { preflightCommitment: this.comm };
    const wallet = {
      publicKey: new PublicKey(this.walletAddress),
      signTransaction: () => Promise.reject(),
      signAllTransactions: () => Promise.reject(),
    };
    const provider = new AnchorProvider(this.connection, wallet, opts);
    setProvider(provider);
  }

  async changeWalletListening() {
    this.phantom?.on('connect', this._accountChanged);
  }

  private _accountChanged = (newPublicKey: PublicKey) => {
    this.ngZone.run(() => {
      this.walletAddress = newPublicKey.toString();
      this.publicKey.next(newPublicKey);
      this.setAnchorProvider();
      this.jwtToken = null; // Reauthentifier avec l'API backend si un changement de compte a lieu
    });
  };

  /* ********** TRANSACTION SIGN & SEND ********** */

  async signAndSendTransactionWeb(t: Transaction, signer?: Signer): Promise<string> {
    const tPrepared = await this.prepareTransaction(t, signer);

    let tSigned: Transaction | undefined;

    if (this.phantom) tSigned = await this.phantom?.signTransaction(tPrepared);
    else throw new Error('Something was wrong with the user\'s wallet');

    return this.connection.sendRawTransaction(
      tSigned.serialize({ verifySignatures: false, requireAllSignatures: false })
    );
  }

  /* ********** TRANSACTION PREPARATION ********** */

  async prepareTransaction(t: Transaction, signer?: Signer): Promise<Transaction> {
    const provider = getProvider();

    t.feePayer = provider.publicKey;

    const latestBlockHash = await this.connection.getLatestBlockhash();
    t.recentBlockhash = latestBlockHash.blockhash;
    t.lastValidBlockHeight = latestBlockHash.lastValidBlockHeight;

    if (signer) t.sign(signer);

    return t;
  }
}
