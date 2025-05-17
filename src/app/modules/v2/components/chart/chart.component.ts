import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { animate, query, stagger, state, style, transition, trigger } from '@angular/animations';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { TradingViewComponent } from './tradingview/tradingview.component';
import { SolanaService } from '@shared/services/solana.service';
import { NotificationService } from 'src/app/notification.service';
import { TopHolderComponent } from './top-holder/top-holder.component';

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss'],
  animations: [
    trigger('fadeInOutChart', [
      state('void', style({
        opacity: 0,
        display: 'none'
      })),
      state('*', style({
        opacity: 1,
        display: 'block'
      })),
      transition('void => *', [
        style({ display: 'block', opacity: 0 }),
        animate('300ms ease-out')
      ]),
      transition('* => void', [
        animate('300ms ease-out', style({ opacity: 0 }))
      ])
    ]),
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0 }))
      ])
    ]),
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
  ]
})
export class ChartComponent implements OnInit, OnDestroy {
  // ViewChild
  @ViewChild(TradingViewComponent) tradingViewComponent?: TradingViewComponent;
  @ViewChild(TopHolderComponent) TopHolderComponent?: TopHolderComponent;

  // Constants
  private readonly API_URL = 'http://127.0.0.1:3000';
  private readonly THROTTLE_DELAY = 5000;

  // Public properties
  public token: any;
  public loading = true;
  public view = 0;
  public selectedCurrency = 'USD';
  public selectedType = 'mcap';
  public stateCurve: any;
  public tradingViewLoaded = false;
  public coinId!: string;
  public isProcessing = false;

  // Private properties
  private destroy$ = new Subject<void>();
  private lastUpdateTime = 0;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private notificationService: NotificationService,
    public solanaService: SolanaService,
  ) { }

  async ngOnInit(): Promise<void> {
    try {
      window.scrollTo(0, 0);
      this.coinId = this.route.snapshot.paramMap.get('id') || '';
      await this.loadToken();
      this.loading = false;
    } catch (error) {
      this.notificationService.showError('Erreur lors du chargement');
      console.error('Init error:', error);
    }
  }



  private async loadToken(): Promise<boolean> {
    try {
      const response = await this.http.get<any>(`${this.API_URL}/coin/coin?mint=${this.coinId}`).toPromise();
      if (response?.data) {
        this.token = this.mapTokenData(response.data);
        return true;
      }
      return false;
    } catch (error) {
      console.log(error);
      console.error('Token loading error:', error);
      return false;
    }
  }

  eventChat(e: any) {
    if (e.type == 'stream_status_update') {
      this.token.is_currently_live = e.isLive;
    }
    if (e.type == 'viewer_count') {
      this.token.current_viewers = e.count
    }
  }

  private mapTokenData(data: any) {
    const tokenData = {
      id: data.id,
      name: data.name,
      symbol: data.symbol,
      mc: this.token?.mc ?? data.usd_market_cap,
      logoURI: this.processLogoURI(this.token?.logoURI ?? data.image_uri),
      description: data.description,
      reply_count: data.reply_count,
      creator: data.creator,
      king_of_the_hill_timestamp: data.king_of_the_hill_timestamp,
      decimals: this.token?.decimals ?? 6,
      supply: this.calculateSupply(data),
      source: data.source,
      is_currently_live: data.is_currently_live,
      current_viewers: data.current_viewers,
      extensions: {
        description: this.token?.extensions?.description ?? data.description,
        telegram: this.token?.extensions?.telegram ?? data.telegram,
        twitter: this.token?.extensions?.twitter ?? data.twitter,
        website: this.token?.extensions?.website ?? data.website
      }
    };

    // Traitement spécifique pour pump.fun
    if (data.source === 'https://pump.fun') {
      this.processPumpFunData(data);
    }

    return tokenData;
  }

  private processLogoURI(uri: string | undefined): string {
    if (!uri) return '';
    return uri.replace(/cf-ipfs\.com/g, 'ipfs.io');
  }

  private calculateSupply(data: any): string {
    if (data.source === 'https://pump.fun') {
      return String(Number(data.tokenTotalSupply) / Math.pow(10, 6));
    }
    return data.tokenTotalSupply;
  }

  private processPumpFunData(data: any): void {
    this.stateCurve = {
      bonding_curve: data.bonding_curve || null,
      associated_bonding_curve: data.associated_bonding_curve || null,
      tokenTotalSupply: data.tokenTotalSupply || null,
      virtualTokenReserves: data.virtualTokenReserves || null,
      virtualSolReserves: data.virtualSolReserves || null,
      realTokenReserves: data.realTokenReserves || null,
      realSolReserves: data.realSolReserves || null,
      solPrice: data.solPrice || null,
      complete: data.complete
    };
  }

  private async processUpdate(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    if (this.token.source === 'raydium') {
      this.isProcessing = false;
      return;
    }

    await this.checkCurve(this.coinId);
    this.TopHolderComponent?.fetchHolders();

    // Attendre 30 secondes avant de permettre la prochaine exécution
    setTimeout(() => {
      this.isProcessing = false;
    }, this.THROTTLE_DELAY);
  }

  async checkCurve(mintAddress: string): Promise<void> {
    try {
      const response = await fetch(`${this.API_URL}/coin/bonding?mint=` + mintAddress, {
        method: 'get'
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      this.stateCurve = result.data;


      if (this.token.source == 'https://pump.fun' && this.stateCurve.complete) {
        this.token.source = 'raydium';

      }
    } catch (error) {
      console.error('Error checking curve progress:', error)
      throw error
    }
  }




  ngOnDestroy(): void {
    this.cleanup();
  }

  updateData(event: any, type: any) {
    this.processUpdate();
    if (type == 'chart') {
      this.tradingViewComponent?.updateChartData(event);
      return
    }
    if (type == 'price') {
      {
        this.token.mc = event.marketCap;
      }
    }

  }

  private cleanup(): void {
    try {
      this.destroy$.next();
      this.destroy$.complete();
      // Réinitialisation des propriétés
      this.resetProperties();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  private resetProperties(): void {
    this.tradingViewLoaded = false;
    this.loading = true;
    this.token = null;
    this.view = 0;
  }
}
