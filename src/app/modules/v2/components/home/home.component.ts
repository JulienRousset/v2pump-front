import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { SocketFeatureService, CoinData } from 'src/app/socketFeature.service';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  animations: [
    trigger('fadeInAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('0.5s ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('listAnimation', [
      transition(':enter', [
        query(
          ':enter',
          [
            style({ opacity: 0, transform: 'translateY(10px)' }),
            stagger(50, [
              animate(
                '0.3s ease-in',
                style({ opacity: 1, transform: 'translateY(0)' })
              ),
            ]),
          ],
          { optional: true }
        ),
      ]),
    ]),
    trigger('itemAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.9)' }),
        animate('0.2s ease-out', style({ opacity: 1, transform: 'scale(1)' })),
      ])
    ]),
  ],
})
export class HomeComponent implements OnInit, OnDestroy {
  coins: any = [];
  currentSortIndex = 0;

  loading: boolean = true;
  includeNsfw: boolean = false;
  isDropdownOpen = false;
  private coinsSubject = new BehaviorSubject<any[]>([]);
  coins$ = this.coinsSubject.asObservable();
  
  // États de connexion
  isConnected: boolean = false;
  connectionError: string | null = null;

  // Propriétés pour Dexscreener
  dexscreenerData: any = null;
  dexscreenerNextUpdate: Date | null = null;
  private dexscreenerCheckInterval: Subscription | null = null;

  sortOptions = [
    { value: 'featured', label: 'Featured 🔥' },
  ];

  public animate = true;
  private subscriptions: Subscription[] = [];
  private historySubscription: Subscription | null = null;
  private coinSubscription: Subscription | null = null;

  constructor(
    private socketFeatureService: SocketFeatureService, 
    private ngZone: NgZone,
    private http: HttpClient  // Ajout de HttpClient
  ) { }

  ngOnInit() {
    // Initialiser la connexion
    this.connectToSocket();
    
    // Surveiller l'état de connexion
    this.subscriptions.push(
      this.socketFeatureService.isConnected().subscribe(connected => {
        this.ngZone.run(() => {
          this.isConnected = connected;
        });
      })
    );
    
    // Surveiller les erreurs de connexion
    this.subscriptions.push(
      this.socketFeatureService.getConnectionErrors().subscribe(error => {
        this.ngZone.run(() => {
          this.connectionError = error;
          if (error) {
            this.loading = false;
          }
        });
      })
    );

    // Initialiser la surveillance de Dexscreener
    this.initDexscreenerMonitoring();
  }

  // Nouvelle méthode pour initialiser la surveillance de Dexscreener
  initDexscreenerMonitoring() {
    // Charger les données initiales
    this.fetchDexscreenerData();
    
    // Configurer la vérification périodique toutes les 15 secondes
    this.dexscreenerCheckInterval = interval(15000).subscribe(() => {
      if (this.dexscreenerNextUpdate) {
        const now = new Date();
        if (now >= this.dexscreenerNextUpdate) {
          console.log('Cache expiré, mise à jour des données Dexscreener...');
          this.fetchDexscreenerData();
        }
      }
    });
    
    // Ajouter à la liste des abonnements pour le nettoyage
    this.subscriptions.push(this.dexscreenerCheckInterval);
  }

  // Méthode pour récupérer les données de Dexscreener
  fetchDexscreenerData() {
    this.http.get('http://127.0.0.1:3000/coin/dexscreener').subscribe({
      next: (response: any) => {
        this.ngZone.run(() => {
          this.dexscreenerData = response.data;
          
          console.log(this.dexscreenerData);
          // Mettre à jour la prochaine date de rafraîchissement
          if (response.cache && response.cache.next) {
            this.dexscreenerNextUpdate = new Date(response.cache.next);
            console.log(`Données Dexscreener mises à jour. Prochaine actualisation: ${this.dexscreenerNextUpdate.toLocaleString()}`);
          }
        });
      },
      error: (error) => {
        console.error('Erreur lors de la récupération des données Dexscreener:', error);
      }
    });
  }

  connectToSocket() {
    this.socketFeatureService.connect();
    
    // S'abonner à l'historique
    this.historySubscription = this.socketFeatureService.getHistory().subscribe({
      next: (coins: any) => {
        this.ngZone.run(() => {
          if (coins) {
            this.coinsSubject.next(coins);
            this.loading = false;
            
            // Se désabonner de l'historique une fois reçu
            if (this.historySubscription) {
              this.historySubscription.unsubscribe();
              this.historySubscription = null;
            }
            
            // S'abonner aux nouvelles pièces uniquement après avoir reçu l'historique
            this.subscribeToLatestCoin();
          }
        });
      },
      error: (error) => {
        this.ngZone.run(() => {
          console.error('Erreur lors du chargement de l\'historique:', error);
          this.loading = false;
          this.connectionError = "Impossible de charger l'historique des coins.";
        });
      }
    });
    
    // Ajouter à la liste des abonnements
    this.subscriptions.push(this.historySubscription);
  }

  subscribeToLatestCoin() {
    // Éviter les abonnements multiples
    if (this.coinSubscription) {
      this.coinSubscription.unsubscribe();
    }
    
    // S'abonner aux nouvelles pièces
    this.coinSubscription = this.socketFeatureService.getLatestCoin().subscribe({
      next: (coin: any) => {
        this.ngZone.run(() => {
          if (coin && this.animate) {
            const currentCoins = this.coinsSubject.value;
            const newCoins = [coin, ...currentCoins].slice(0, 148);
            this.coinsSubject.next(newCoins);
          }
        });
      },
      error: (error) => {
        console.error('Erreur lors de la réception des nouvelles pièces:', error);
      }
    });
    
    // Ajouter à la liste des abonnements
    this.subscriptions.push(this.coinSubscription);
  }

  reconnect() {
    // Nettoyer les abonnements actuels
    if (this.historySubscription) {
      this.historySubscription.unsubscribe();
      this.historySubscription = null;
    }
    
    if (this.coinSubscription) {
      this.coinSubscription.unsubscribe();
      this.coinSubscription = null;
    }
    
    // Réinitialiser les états
    this.loading = true;
    this.connectionError = null;
    
    // Déconnecter puis reconnecter
    this.socketFeatureService.disconnect();
    setTimeout(() => this.connectToSocket(), 1000);
  }

  trackByFn(index: number, item: any): string {
    return item.mint || item.id || index; // Utiliser mint ou id comme identifiant unique
  }

  changeSort(sort: any) {
    // Votre logique de tri ici
  }

  ngOnDestroy() {
    // Nettoyer tous les abonnements
    if (this.subscriptions) {
      this.subscriptions.forEach(sub => {
        if (sub && !sub.closed) {
          sub.unsubscribe();
        }
      });
      this.subscriptions = [];
    }
    
    // Déconnecter le WebSocket
    this.socketFeatureService.disconnect();
    
    // Nettoyer le BehaviorSubject
    this.coinsSubject.complete();
  }
}
